import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Subject, Observable, firstValueFrom } from 'rxjs';
import { take, timeout, catchError } from 'rxjs/operators';
import { FingerprintService } from './fingerprint.service';

// =============================================================================
// Types
// =============================================================================

export type ConnectionState = 
  | 'IDLE'
  | 'VALIDATING_TOKEN'
  | 'CONNECTING'
  | 'ESTABLISHING_LINK'
  | 'WAITING_FOR_DESKTOP'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR'
  | 'DISCONNECTED';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Parameters from QR code
 */
export interface QrCodeParams {
  token: string;        // UUID token for authentication
  deviceId: string;     // Desktop device ID
  userId: string;       // User ID
  apiUrl: string;       // API base URL
}

/**
 * Stored session data in localStorage
 */
export interface StoredSession {
  token: string;
  deviceId: string;
  userId: string;
  apiUrl: string;
  socketUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  storedAt: number;
}

/**
 * Response from generate-login-and-refresh-token API
 */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  socketUrl: string;
  expiresIn?: number;
}

/**
 * Desktop message received via socket
 */
export interface DesktopMessage {
  type: string;
  state?: string;
  connectionState?: string;
  desktopDeviceId?: string;
  [key: string]: any;
}

// =============================================================================
// Service
// =============================================================================

@Injectable({ providedIn: 'root' })
export class MobileSocketService implements OnDestroy {
  private static readonly COMPONENT = 'MobileSocketService';
  private static readonly STORAGE_KEY = 'tis-mobile-session';
  private static readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private readonly http = inject(HttpClient);
  private readonly fingerprintService = inject(FingerprintService);

  // Configuration
  private qrParams: QrCodeParams | null = null;
  private mobileDeviceId: string = '';
  private desktopDeviceId: string = '';
  private userId: string = '';
  private apiUrl: string = '';
  private socketUrl: string = '';
  private accessToken: string = '';
  private refreshToken: string = '';
  private channelName: string = '';

  // Socket
  private socket: WebSocket | null = null;
  private connectionState: ConnectionState = 'IDLE';

  // Observables
  private readonly _connectionState$ = new BehaviorSubject<ConnectionState>('IDLE');
  private readonly _connectionStatus$ = new BehaviorSubject<ConnectionStatus>('disconnected');
  private readonly _desktopMessages$ = new Subject<DesktopMessage>();
  private readonly _error$ = new BehaviorSubject<string | null>(null);
  private readonly destroy$ = new Subject<void>();

  // Public observables
  readonly connectionState$ = this._connectionState$.asObservable();
  readonly connectionStatus$ = this._connectionStatus$.asObservable();
  readonly desktopMessages$ = this._desktopMessages$.asObservable();
  readonly error$ = this._error$.asObservable();

  // Reconnection
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeoutId: any = null;

  // Heartbeat
  private heartbeatInterval: any = null;
  private lastPongReceived = 0;

  // Channel subscriptions
  private channels = new Map<string, Subject<any>>();

  constructor() {
    this.initializeMobileDeviceId();
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize mobile device ID using fingerprint
   */
  private async initializeMobileDeviceId(): Promise<void> {
    try {
      this.mobileDeviceId = await this.fingerprintService.getTabFingerprint();
      console.log(`[${MobileSocketService.COMPONENT}] Mobile Device ID:`, this.mobileDeviceId);
    } catch (e) {
      // Fallback
      this.mobileDeviceId = `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
  }

  /**
   * Get mobile device ID
   */
  getMobileDeviceId(): string {
    return this.mobileDeviceId;
  }

  /**
   * Get desktop device ID
   */
  getDesktopDeviceId(): string {
    return this.desktopDeviceId;
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'CONNECTED' && this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Try to restore session from localStorage
   */
  hasStoredSession(): boolean {
    try {
      const stored = localStorage.getItem(MobileSocketService.STORAGE_KEY);
      if (!stored) return false;
      
      const session: StoredSession = JSON.parse(stored);
      return Date.now() - session.storedAt < MobileSocketService.SESSION_TTL;
    } catch {
      return false;
    }
  }

  /**
   * Initialize from QR code parameters
   * Flow:
   * 1. Call API with token, deviceId, userId to get accessToken, refreshToken, socketUrl
   * 2. Connect to WebSocket
   * 3. Call 'establish-mobile-upload-link' via socket
   * 4. Wait for SUCCESS from desktop
   */
  async initialize(params: QrCodeParams): Promise<void> {
    console.log(`[${MobileSocketService.COMPONENT}] Initializing with params:`, params);

    // Store params
    this.qrParams = params;
    this.desktopDeviceId = params.deviceId;
    this.userId = params.userId;
    this.apiUrl = decodeURIComponent(params.apiUrl);
    this.channelName = `tis-mobile-upload-w-dev-${params.deviceId}`;

    // Ensure we have mobile device ID
    if (!this.mobileDeviceId) {
      await this.initializeMobileDeviceId();
    }

    // Save to localStorage for retry
    this.saveSession({
      token: params.token,
      deviceId: params.deviceId,
      userId: params.userId,
      apiUrl: params.apiUrl,
      storedAt: Date.now()
    });

    this._error$.next(null);
    this.reconnectAttempts = 0;

    try {
      // Step 1: Get tokens from API
      await this.fetchTokens(params.token);

      // Step 2: Connect to WebSocket
      await this.connect();

      // Step 3: Establish link with desktop
      await this.establishMobileUploadLink();

      console.log(`[${MobileSocketService.COMPONENT}] Initialization complete!`);

    } catch (error: any) {
      console.error(`[${MobileSocketService.COMPONENT}] Initialization failed:`, error);
      this.transitionTo('ERROR');
      this._error$.next(error.message || 'Initialization failed');
      throw error;
    }
  }

  /**
   * Retry connection using stored session
   */
  async retryFromStoredSession(): Promise<void> {
    const stored = this.getStoredSession();
    if (!stored) {
      throw new Error('No stored session found');
    }

    // If we have valid tokens, try to reconnect directly
    if (stored.accessToken && stored.socketUrl) {
      this.desktopDeviceId = stored.deviceId;
      this.userId = stored.userId;
      this.apiUrl = stored.apiUrl;
      this.socketUrl = stored.socketUrl;
      this.accessToken = stored.accessToken;
      this.refreshToken = stored.refreshToken || '';
      this.channelName = `tis-mobile-upload-w-dev-${stored.deviceId}`;

      await this.connect();
      await this.establishMobileUploadLink();
    } else {
      // Re-initialize with stored params
      await this.initialize({
        token: stored.token,
        deviceId: stored.deviceId,
        userId: stored.userId,
        apiUrl: stored.apiUrl
      });
    }
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  /**
   * Fetch tokens from API using the link token
   */
  private async fetchTokens(token: string): Promise<void> {
    this.transitionTo('VALIDATING_TOKEN');

    const endpoint = `${this.apiUrl}/ease-of-access/generate-login-and-refresh-token-for-mobile-link-app`;
    
    console.log(`[${MobileSocketService.COMPONENT}] Fetching tokens from:`, endpoint);

    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponse>(endpoint, {
          token,
          deviceId: this.desktopDeviceId,
          userId: this.userId,
          mobileDeviceId: this.mobileDeviceId
        }).pipe(
          timeout(30000),
          catchError(err => {
            throw new Error(err.error?.message || 'Failed to validate token');
          })
        )
      );

      this.accessToken = response.accessToken;
      this.refreshToken = response.refreshToken;
      this.socketUrl = response.socketUrl;

      // Update stored session with tokens
      const stored = this.getStoredSession();
      if (stored) {
        this.saveSession({
          ...stored,
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          socketUrl: this.socketUrl
        });
      }

      console.log(`[${MobileSocketService.COMPONENT}] Tokens received, socket URL:`, this.socketUrl);

    } catch (error: any) {
      console.error(`[${MobileSocketService.COMPONENT}] Token fetch failed:`, error);
      throw error;
    }
  }

  // ===========================================================================
  // WebSocket Connection
  // ===========================================================================

  /**
   * Connect to WebSocket
   */
  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.transitionTo('CONNECTING');

      if (!this.socketUrl) {
        reject(new Error('Socket URL not available'));
        return;
      }

      // Add auth token to socket URL
      const url = new URL(this.socketUrl);
      url.searchParams.set('token', this.accessToken);

      console.log(`[${MobileSocketService.COMPONENT}] Connecting to WebSocket...`);

      try {
        this.socket = new WebSocket(url.toString());

        this.socket.onopen = () => {
          console.log(`[${MobileSocketService.COMPONENT}] WebSocket connected`);
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
          console.error(`[${MobileSocketService.COMPONENT}] WebSocket error:`, error);
          reject(new Error('WebSocket connection failed'));
        };

        this.socket.onclose = (event) => {
          console.log(`[${MobileSocketService.COMPONENT}] WebSocket closed:`, event.code, event.reason);
          this.handleDisconnect(event.code);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Establish mobile upload link with desktop
   */
  private async establishMobileUploadLink(): Promise<void> {
    this.transitionTo('ESTABLISHING_LINK');

    console.log(`[${MobileSocketService.COMPONENT}] Establishing link with desktop...`);

    // Subscribe to channel for desktop messages
    this.subscribeToChannel(this.channelName);

    // Call establish-mobile-upload-link action
    this.sendMessage({
      action: 'establish-mobile-upload-link',
      data: {
        desktopDeviceId: this.desktopDeviceId,
        mobileDeviceId: this.mobileDeviceId,
        userId: this.userId,
        channel: this.channelName
      }
    });

    // Also send INITIATED state to the channel
    this.sendToDesktop('connectionState', {
      state: 'INITIATED',
      mobileDeviceId: this.mobileDeviceId
    });

    this.transitionTo('WAITING_FOR_DESKTOP');

    // Wait for SUCCESS from desktop (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Desktop did not respond. Please ensure the desktop app is open.'));
      }, 30000);

      const sub = this._desktopMessages$.subscribe(msg => {
        if (msg.type === 'connectionState' && (msg.state === 'SUCCESS' || msg.connectionState === 'SUCCESS')) {
          clearTimeout(timeout);
          sub.unsubscribe();
          this.transitionTo('CONNECTED');
          resolve();
        }
      });
    });
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  /**
   * Send raw message via socket
   */
  private sendMessage(message: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn(`[${MobileSocketService.COMPONENT}] Cannot send, socket not open`);
      return;
    }

    try {
      this.socket.send(JSON.stringify(message));
    } catch (e) {
      console.error(`[${MobileSocketService.COMPONENT}] Send failed:`, e);
    }
  }

  /**
   * Send message to desktop via channel
   */
  sendToDesktop(type: string, data: any): void {
    this.sendMessage({
      action: 'send-to-channel',
      data: {
        channel: this.channelName,
        type,
        payload: {
          ...data,
          mobileDeviceId: this.mobileDeviceId,
          timestamp: Date.now()
        }
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const parsed = JSON.parse(data);
      console.log(`[${MobileSocketService.COMPONENT}] Received:`, parsed);

      // Handle pong
      if (parsed.action === 'pong' || parsed.channel === 'pong') {
        this.lastPongReceived = Date.now();
        return;
      }

      // Check if this is a desktop message (from our channel)
      if (parsed.channel === this.channelName || 
          (Array.isArray(parsed.channel) && parsed.channel.includes(this.channelName))) {
        const message: DesktopMessage = parsed.data || parsed.payload || parsed;
        this._desktopMessages$.next(message);
      }

      // Route to channel subscribers
      if (parsed.channel) {
        const channels = Array.isArray(parsed.channel) ? parsed.channel : [parsed.channel];
        channels.forEach((ch: string) => {
          const subject = this.channels.get(ch);
          if (subject) {
            subject.next(parsed);
          }
        });
      }

    } catch (e) {
      console.error(`[${MobileSocketService.COMPONENT}] Failed to parse message:`, e);
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribeToChannel(channelName: string): Observable<any> {
    let subject = this.channels.get(channelName);
    if (!subject) {
      subject = new Subject<any>();
      this.channels.set(channelName, subject);

      // Tell server to subscribe
      this.sendMessage({
        action: 'subscribe',
        data: { channel: channelName }
      });
    }
    return subject.asObservable();
  }

  // ===========================================================================
  // API Calls via Socket
  // ===========================================================================

  /**
   * Call API via socket
   */
  callApiViaSocket(route: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `${route}_${Date.now()}`;
      
      // Create temporary channel for response
      const responseChannel = new Subject<any>();
      this.channels.set(requestId, responseChannel);

      const timeout = setTimeout(() => {
        this.channels.delete(requestId);
        reject(new Error('API call timeout'));
      }, 30000);

      responseChannel.pipe(take(1)).subscribe({
        next: (response) => {
          clearTimeout(timeout);
          this.channels.delete(requestId);
          
          if (response.status === 200 || response.statusCode === 200) {
            resolve(response.payload || response.body || response);
          } else {
            reject(new Error(response.message || 'API call failed'));
          }
        },
        error: reject
      });

      this.sendMessage({
        action: route,
        data: {
          ...data,
          requestId
        }
      });
    });
  }

  // ===========================================================================
  // Heartbeat & Reconnection
  // ===========================================================================

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongReceived = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.sendMessage({ action: 'ping' });

        // Check if pong received
        if (Date.now() - this.lastPongReceived > 45000) {
          console.warn(`[${MobileSocketService.COMPONENT}] No pong received, reconnecting...`);
          this.socket?.close();
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleDisconnect(code: number): void {
    this._connectionStatus$.next('disconnected');
    this.stopHeartbeat();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.transitionTo('ERROR');
      this._error$.next('Connection lost. Please scan QR code again.');
    }
  }

  private scheduleReconnect(): void {
    this.transitionTo('RECONNECTING');
    this.reconnectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[${MobileSocketService.COMPONENT}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeoutId = setTimeout(async () => {
      try {
        await this.connect();
        await this.establishMobileUploadLink();
      } catch (err) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.transitionTo('ERROR');
          this._error$.next('Connection lost. Please scan QR code again.');
        }
      }
    }, delay);
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  private transitionTo(state: ConnectionState): void {
    if (this.connectionState === state) return;

    console.log(`[${MobileSocketService.COMPONENT}] State: ${this.connectionState} -> ${state}`);
    this.connectionState = state;
    this._connectionState$.next(state);

    // Map to simple status
    let status: ConnectionStatus;
    switch (state) {
      case 'CONNECTED':
        status = 'connected';
        break;
      case 'ERROR':
        status = 'error';
        break;
      case 'DISCONNECTED':
        status = 'disconnected';
        break;
      default:
        status = 'connecting';
    }
    this._connectionStatus$.next(status);
  }

  // ===========================================================================
  // Storage
  // ===========================================================================

  private saveSession(session: StoredSession): void {
    try {
      localStorage.setItem(MobileSocketService.STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn(`[${MobileSocketService.COMPONENT}] Failed to save session:`, e);
    }
  }

  private getStoredSession(): StoredSession | null {
    try {
      const stored = localStorage.getItem(MobileSocketService.STORAGE_KEY);
      if (!stored) return null;
      
      const session: StoredSession = JSON.parse(stored);
      if (Date.now() - session.storedAt > MobileSocketService.SESSION_TTL) {
        this.clearStoredSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  private clearStoredSession(): void {
    try {
      localStorage.removeItem(MobileSocketService.STORAGE_KEY);
    } catch (e) {
      console.warn(`[${MobileSocketService.COMPONENT}] Failed to clear session:`, e);
    }
  }

  // ===========================================================================
  // Disconnect & Cleanup
  // ===========================================================================

  disconnect(): void {
    console.log(`[${MobileSocketService.COMPONENT}] Disconnecting...`);

    // Notify desktop
    if (this.isConnected()) {
      this.sendToDesktop('disconnect', { reason: 'user_initiated' });
    }

    this.cleanup();
    this.clearStoredSession();
    this.transitionTo('DISCONNECTED');
  }

  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.socket) {
      try {
        this.socket.close(1000, 'Client disconnect');
      } catch {}
      this.socket = null;
    }

    this.channels.forEach(ch => ch.complete());
    this.channels.clear();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }
}
