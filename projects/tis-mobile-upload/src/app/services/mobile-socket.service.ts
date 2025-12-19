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
  mobileDeviceId?: string;
  storedAt: number;
}

/**
 * Response from generate-login-and-refresh-token API
 */
interface TokenResponse {
  success?: boolean;
  accessToken: string;
  refreshToken: string;
  socketUrl: string;
  expiresIn?: number;
  uploadChannelPrefix?: string;
  desktopDeviceId?: string;
  mobileDeviceId?: string;
  data?: TokenResponse; // API may wrap response in data field
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

/**
 * Channel stream for subscriptions
 */
export interface ChannelStream {
  channelName: string;
  data$: Subject<any>;
  responseCount: number;
  closeAfterFirstResponse: boolean;
}

/**
 * Channel subscription info
 */
interface ChannelSubscriptionInfo {
  subject: Subject<any>;
  closeAfterFirstResponse: boolean;
  isActive: boolean;
}

/**
 * Device online status
 */
export interface DeviceOnlineStatus {
  isOnline: boolean;
  deviceId: string;
  lastPing?: number;
  connectionId?: string;
}

/**
 * Combined device status for both desktop and mobile
 */
export interface DevicesOnlineStatus {
  desktop: DeviceOnlineStatus;
  mobile: DeviceOnlineStatus;
  lastChecked: number;
  isReadyForTransfer: boolean;
}

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// =============================================================================
// Service
// =============================================================================

@Injectable({ providedIn: 'root' })
export class MobileSocketService implements OnDestroy {
  private static readonly COMPONENT = 'MobileSocketService';
  private static readonly STORAGE_KEY = 'tis-mobile-session';
  private static readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly TOKEN_EXPIRY_BUFFER = 60 * 1000; // 1 minute buffer before expiry

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

  // Health check
  private healthCheckInterval: any = null;
  private readonly _devicesStatus$ = new BehaviorSubject<DevicesOnlineStatus | null>(null);
  private readonly _isCheckingStatus$ = new BehaviorSubject<boolean>(false);
  readonly devicesStatus$ = this._devicesStatus$.asObservable();
  readonly isCheckingStatus$ = this._isCheckingStatus$.asObservable();

  // Channel subscriptions
  private channels = new Map<string, ChannelStream>();
  private activeChannelSubscriptions = new Map<string, ChannelSubscriptionInfo>();
  private activePrefixes = new Set<string>();

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
      mobileDeviceId: this.mobileDeviceId,
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
      
      // Restore mobileDeviceId from stored session, or initialize if not available
      if (stored.mobileDeviceId) {
        this.mobileDeviceId = stored.mobileDeviceId;
      } else if (!this.mobileDeviceId) {
        await this.initializeMobileDeviceId();
      }

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
      const apiResponse = await firstValueFrom(
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

      // Handle both direct response and data-wrapped response
      const response = apiResponse.data || apiResponse;
      
      console.log(`[${MobileSocketService.COMPONENT}] API Response:`, JSON.stringify(apiResponse, null, 2));

      if (!response.accessToken || !response.socketUrl) {
        throw new Error('Invalid token response: missing accessToken or socketUrl');
      }

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
          socketUrl: this.socketUrl,
          mobileDeviceId: this.mobileDeviceId
        });
      }

      console.log(`[${MobileSocketService.COMPONENT}] Tokens received, socket URL:`, this.socketUrl);

    } catch (error: any) {
      console.error(`[${MobileSocketService.COMPONENT}] Token fetch failed:`, error);
      throw error;
    }
  }

  // ===========================================================================
  // Token Validation & Refresh
  // ===========================================================================

  /**
   * Decode JWT token payload (without verification)
   */
  private decodeJwtPayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (e) {
      console.warn(`[${MobileSocketService.COMPONENT}] Failed to decode JWT:`, e);
      return null;
    }
  }

  /**
   * Check if JWT token is expired or about to expire
   */
  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJwtPayload(token);
    if (!payload || !payload.exp) {
      // If we can't decode or no exp claim, assume expired
      return true;
    }

    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const isExpired = now >= (expiryTime - MobileSocketService.TOKEN_EXPIRY_BUFFER);
    
    if (isExpired) {
      console.log(`[${MobileSocketService.COMPONENT}] Token expired or expiring soon. Expiry: ${new Date(expiryTime).toISOString()}, Now: ${new Date(now).toISOString()}`);
    }
    
    return isExpired;
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const endpoint = `${this.apiUrl}/ease-of-access/refresh-token-for-mobile-link-app`;
    
    console.log(`[${MobileSocketService.COMPONENT}] Refreshing access token...`);

    try {
      const apiResponse = await firstValueFrom(
        this.http.post<TokenResponse>(endpoint, {
          refreshToken: this.refreshToken,
          mobileDeviceId: this.mobileDeviceId,
          desktopDeviceId: this.desktopDeviceId
        }).pipe(
          timeout(30000),
          catchError(err => {
            throw new Error(err.error?.message || 'Failed to refresh token');
          })
        )
      );

      // Handle both direct response and data-wrapped response
      const response = apiResponse.data || apiResponse;

      if (!response.accessToken) {
        throw new Error('Invalid refresh token response: missing accessToken');
      }

      this.accessToken = response.accessToken;
      
      // Update refresh token if provided
      if (response.refreshToken) {
        this.refreshToken = response.refreshToken;
      }

      // Update stored session with new tokens
      const stored = this.getStoredSession();
      if (stored) {
        this.saveSession({
          ...stored,
          accessToken: this.accessToken,
          refreshToken: this.refreshToken
        });
      }

      console.log(`[${MobileSocketService.COMPONENT}] Access token refreshed successfully`);

    } catch (error: any) {
      console.error(`[${MobileSocketService.COMPONENT}] Token refresh failed:`, error);
      throw error;
    }
  }

  /**
   * Validate access token and refresh if expired
   */
  private async validateAndRefreshToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    if (this.isTokenExpired(this.accessToken)) {
      console.log(`[${MobileSocketService.COMPONENT}] Access token expired, attempting refresh...`);
      
      if (!this.refreshToken) {
        throw new Error('Access token expired and no refresh token available. Please scan QR code again.');
      }

      try {
        await this.refreshAccessToken();
      } catch (error: any) {
        // If refresh fails, clear session and throw
        this.clearStoredSession();
        throw new Error('Session expired. Please scan QR code again.');
      }
    } else {
      console.log(`[${MobileSocketService.COMPONENT}] Access token is valid`);
    }
  }

  // ===========================================================================
  // WebSocket Connection
  // ===========================================================================

  /**
   * Connect to WebSocket
   */
  private async connect(): Promise<void> {
    // Ensure mobileDeviceId is available
    if (!this.mobileDeviceId) {
      await this.initializeMobileDeviceId();
    }

    // Validate and refresh token if needed before connecting
    await this.validateAndRefreshToken();
    
    return new Promise((resolve, reject) => {
      this.transitionTo('CONNECTING');

      if (!this.socketUrl) {
        reject(new Error('Socket URL not available'));
        return;
      }
      
      if (!this.mobileDeviceId) {
        reject(new Error('Mobile device ID not available'));
        return;
      }

      // Add auth token and device ID to socket URL
      const url = new URL(this.socketUrl);
      url.searchParams.set('Auth', this.accessToken);
      url.searchParams.set('deviceId', this.mobileDeviceId);

      console.log(`[${MobileSocketService.COMPONENT}] Connecting to WebSocket with deviceId:`, this.mobileDeviceId);

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

    // Set up the response listener BEFORE making the API call
    // This ensures we don't miss the mobile-link-established message
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`[${MobileSocketService.COMPONENT}] Connection timeout - desktop did not respond in 30s`);
        reject(new Error('Desktop did not respond. Please ensure the desktop app is open.'));
      }, 30000);

      const sub = this._desktopMessages$.subscribe(msg => {
        // Handle mobile-link-established from backend (via desktop channel)
        if (msg.type === 'mobile-link-established') {
          console.log(`[${MobileSocketService.COMPONENT}] ✅ Mobile link established`);
          clearTimeout(timeout);
          sub.unsubscribe();
          this.transitionTo('CONNECTED');
          resolve();
        }
        // Also handle legacy SUCCESS response
        if (msg.type === 'connectionState' && (msg.state === 'SUCCESS' || msg.connectionState === 'SUCCESS')) {
          console.log(`[${MobileSocketService.COMPONENT}] ✅ Connection confirmed (legacy)`);
          clearTimeout(timeout);
          sub.unsubscribe();
          this.transitionTo('CONNECTED');
          resolve();
        }
        // Handle disconnect from desktop
        if (msg.type === 'mobile-link-disconnected' || msg.type === 'disconnect') {
          console.log(`[${MobileSocketService.COMPONENT}] Desktop disconnected`);
          clearTimeout(timeout);
          sub.unsubscribe();
          this.handleRemoteDisconnect();
          reject(new Error('Desktop disconnected the session.'));
        }
      });
    });

    try {
      // Call establish-mobile-upload-link action via proper API route
      const response = await this.callApiViaSocketPromise('tis-image-mobile-uploader/establish-mobile-upload-link', {
        desktopDeviceId: this.desktopDeviceId,
        mobileDeviceId: this.mobileDeviceId,
        userId: this.userId,
        channel: this.channelName
      });

      console.log(`[${MobileSocketService.COMPONENT}] Establish link response:`, response);

    } catch (error: any) {
      console.warn(`[${MobileSocketService.COMPONENT}] Establish link API call failed:`, error);
      // Continue anyway - the channel subscription should still work
    }

    // Only transition to WAITING_FOR_DESKTOP if we haven't already connected
    // (the mobile-link-established message might arrive before the API response)
    if (this.connectionState !== 'CONNECTED') {
      this.transitionTo('WAITING_FOR_DESKTOP');
    }

    // Wait for the connection response
    return connectionPromise;
  }

  /**
   * Handle disconnect initiated from remote (desktop) side
   */
  private handleRemoteDisconnect(): void {
    console.log(`[${MobileSocketService.COMPONENT}] Handling remote disconnect...`);
    this.cleanup();
    this.clearStoredSession();
    this.transitionTo('DISCONNECTED');
    this._error$.next('Connection was ended by the desktop app.');
  }

  /**
   * Disconnect from desktop - call API and clear local state
   */
  async disconnectFromDesktop(): Promise<void> {
    console.log(`[${MobileSocketService.COMPONENT}] Disconnecting from desktop...`);

    try {
      // Call disconnect API
      await this.callApiViaSocketPromise('tis-image-mobile-uploader/disconnect-mobile-link', {
        mobileDeviceId: this.mobileDeviceId,
        desktopDeviceId: this.desktopDeviceId,
        initiatedBy: 'mobile'
      });
    } catch (error: any) {
      console.warn(`[${MobileSocketService.COMPONENT}] Disconnect API call failed:`, error);
      // Continue with local cleanup anyway
    }

    // Clear local state
    this.cleanup();
    this.clearStoredSession();
    this.transitionTo('DISCONNECTED');
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  /**
   * Send raw message via socket (internal use only - for ping/pong and callApiViaSocket)
   */
  private sendRawMessage(message: any): void {
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
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const parsed = JSON.parse(data);
      // Only log non-ping/pong messages to reduce noise
      if (parsed.channel !== 'pong' && parsed.action !== 'pong') {
        console.log(`[${MobileSocketService.COMPONENT}] Message received:`, parsed.channel || parsed.action, parsed.payload?.type || '');
      }

      // Handle pong
      if (parsed.action === 'pong' || parsed.channel === 'pong') {
        this.lastPongReceived = Date.now();
        return;
      }

      // Check if this is a desktop message (from our channel)
      if (parsed.channel === this.channelName || 
          (Array.isArray(parsed.channel) && parsed.channel.includes(this.channelName))) {
        const message: DesktopMessage = parsed.data || parsed.payload || parsed;
        console.log(`[${MobileSocketService.COMPONENT}] ✅ Desktop message received:`, message);
        this._desktopMessages$.next(message);
      }
      // Note: Other channels (API responses, subscribe confirmations, welcome) are handled by channel routing below

      // Route to channel subscribers (including API responses)
      if (parsed.channel) {
        const channels = Array.isArray(parsed.channel) ? parsed.channel : [parsed.channel];
        channels.forEach((ch: string) => {
          // First try exact match
          let channelStream = this.channels.get(ch);
          
          // If no exact match, try to find a channel that starts with this route (for API responses)
          if (!channelStream) {
            for (const [key, value] of this.channels.entries()) {
              if (key.startsWith(ch + '_') || ch.startsWith(key)) {
                channelStream = value;
                break;
              }
            }
          }
          
          // Also check prefix subscriptions
          if (!channelStream) {
            for (const prefix of this.activePrefixes) {
              if (ch.startsWith(prefix)) {
                channelStream = this.channels.get(`_prefix_${prefix}`);
                break;
              }
            }
          }
          
          if (channelStream) {
            channelStream.data$.next(parsed);
            channelStream.responseCount++;
            
            // Auto-close channel after first response if configured
            if (channelStream.closeAfterFirstResponse && channelStream.responseCount >= 1) {
              this.unsubscribeFromChannel(ch);
            }
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
  subscribeToChannel(channelName: string, closeChannelAfterFirstResponse = false): ChannelStream {
    let info = this.activeChannelSubscriptions.get(channelName);
    const isNew = !info;

    if (!info) {
      info = { subject: new Subject<any>(), closeAfterFirstResponse: closeChannelAfterFirstResponse, isActive: true };
      this.activeChannelSubscriptions.set(channelName, info);
    } else {
      info.isActive = true;
      info.closeAfterFirstResponse = closeChannelAfterFirstResponse;
    }

    // Send subscription to server for new channels (not prefix channels)
    // Check if socket is open instead of connection state, because we need to subscribe
    // during establishMobileUploadLink() before connection state is 'CONNECTED'
    const isSocketOpen = this.socket?.readyState === WebSocket.OPEN;
    if (isSocketOpen && isNew && !channelName.startsWith('_prefix_')) {
      this.sendChannelSubscription(channelName);
    } else if (!isSocketOpen && isNew) {
      console.warn(`[${MobileSocketService.COMPONENT}] Socket not open, cannot send subscription for: ${channelName}`);
    }

    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = { channelName, data$: info.subject, responseCount: 0, closeAfterFirstResponse: closeChannelAfterFirstResponse };
      this.channels.set(channelName, channel);
    }
    return channel;
  }

  /**
   * Subscribe to a channel prefix (for receiving messages on multiple channels with same prefix)
   */
  subscribeToChannelPrefix(prefix: string): ChannelStream {
    if (!this.activePrefixes.has(prefix)) {
      this.activePrefixes.add(prefix);
    }
    
    const tempChannelName = `_prefix_${prefix}`;
    let info = this.activeChannelSubscriptions.get(tempChannelName);
    if (!info) {
      info = { subject: new Subject<any>(), closeAfterFirstResponse: false, isActive: true };
      this.activeChannelSubscriptions.set(tempChannelName, info);
    } else {
      info.isActive = true;
    }
    
    let existing = this.channels.get(tempChannelName);
    if (!existing) {
      existing = { channelName: tempChannelName, data$: info.subject, responseCount: 0, closeAfterFirstResponse: false };
      this.channels.set(tempChannelName, existing);
    }
    return existing;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribeFromChannel(channelName: string): void {
    const channelInfo = this.activeChannelSubscriptions.get(channelName);
    if (channelInfo) {
      channelInfo.isActive = false;
      try { channelInfo.subject.complete(); } catch { }
      this.activeChannelSubscriptions.delete(channelName);
      this.channels.delete(channelName);

      // Notify server of unsubscription
      if (this.connectionState === 'CONNECTED' && !channelName.startsWith('_prefix_')) {
        // this.sendRawMessage({ action: 'unsubscribe', data: { channel: channelName } });
      }

      // Handle prefix channels
      if (channelName.startsWith('_prefix_')) {
        const prefix = channelName.slice('_prefix_'.length);
        this.activePrefixes.delete(prefix);
      }
      
      console.log(`[${MobileSocketService.COMPONENT}] Unsubscribed from channel: ${channelName}`);
    }
  }

  /**
   * Unsubscribe from a channel prefix
   */
  unsubscribeFromChannelPrefix(prefix: string): void {
    console.log(`[${MobileSocketService.COMPONENT}] Unsubscribe prefix "${prefix}"`);
    const tempName = `_prefix_${prefix}`;
    this.unsubscribeFromChannel(tempName);
  }

  /**
   * Send channel subscription to server
   */
  private sendChannelSubscription(channelName: string): void {
    const socketBodyPayload = { route: 'tis-image-mobile-uploader/subscribe', body: { channel: channelName } };
    this.sendRawMessage({ action: 'api', data: socketBodyPayload });
  }

  // ===========================================================================
  // API Calls via Socket
  // ===========================================================================

  /**
   * Call API via socket - returns Observable for the response
   */
  callApiViaSocket(url: string, body: any = null): Observable<any> {
    const socketBodyPayload = { route: url, body };
    this.verifyConnectionStatus();
    this.sendRawMessage({ action: 'api', data: socketBodyPayload });
    const channel = this.subscribeToChannel(url, true);
    return channel.data$.asObservable();
  }

  /**
   * Call API via socket - returns Promise for convenience
   */
  callApiViaSocketPromise(url: string, body: any = null): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('API call timeout'));
      }, 30000);

      this.callApiViaSocket(url, body).pipe(take(1)).subscribe({
        next: (response) => {
          clearTimeout(timeout);
          if (response.status === 200 || response.statusCode === 200) {
            resolve(response.payload || response.body || response);
          } else {
            reject(new Error(response.message || response.body?.message || 'API call failed'));
          }
        },
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  /**
   * Verify connection status before sending
   */
  private verifyConnectionStatus(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn(`[${MobileSocketService.COMPONENT}] Socket not connected, message may not be delivered`);
    }
  }

  // ===========================================================================
  // Heartbeat & Reconnection
  // ===========================================================================

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongReceived = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        const now = Date.now();
        
        // Check if pong received from last ping (before sending new one)
        if (now - this.lastPongReceived > 45000) {
          console.warn(`[${MobileSocketService.COMPONENT}] No pong received in 45s, reconnecting...`);
          this.socket?.close();
          return;
        }

        // Send ping via API route and wait for response
        this.callApiViaSocket('ping', { timestamp: now }).pipe(take(1)).subscribe({
          next: () => {
            this.lastPongReceived = Date.now();
          },
          error: (err: any) => {
            console.warn(`[${MobileSocketService.COMPONENT}] Heartbeat ping error:`, err);
          }
        });
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ===========================================================================
  // Device Health Check
  // ===========================================================================

  /**
   * Start periodic health check for device online status
   */
  startHealthCheck(): void {
    this.stopHealthCheck();

    if (!this.desktopDeviceId || !this.mobileDeviceId) {
      console.warn(`[${MobileSocketService.COMPONENT}] Cannot start health check - missing device IDs`);
      return;
    }

    console.log(`[${MobileSocketService.COMPONENT}] Starting health check (every ${HEALTH_CHECK_INTERVAL / 1000}s)`);

    // Set initial checking state (blinking)
    this._isCheckingStatus$.next(true);

    // Run first check immediately
    this.checkDevicesOnline();

    // Then run periodically
    this.healthCheckInterval = setInterval(() => {
      this.checkDevicesOnline();
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health check
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this._devicesStatus$.next(null);
    this._isCheckingStatus$.next(false);
  }

  /**
   * Check if both devices are online via API
   */
  async checkDevicesOnline(): Promise<DevicesOnlineStatus | null> {
    if (!this.desktopDeviceId || !this.mobileDeviceId) {
      console.warn(`[${MobileSocketService.COMPONENT}] Cannot check devices - missing device IDs`);
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.callApiViaSocket('tis-image-mobile-uploader/check-devices-online', {
          desktopDeviceId: this.desktopDeviceId,
          mobileDeviceId: this.mobileDeviceId
        }).pipe(take(1), timeout(15000))
      );

      // Response structure: { body: { data: { desktop: {...}, mobile: {...} } } }
      const data = response?.body?.data || response?.data || response;
      
      const status: DevicesOnlineStatus = {
        desktop: {
          isOnline: data?.desktop?.isOnline ?? false,
          deviceId: data?.desktop?.deviceId || this.desktopDeviceId,
          lastPing: data?.desktop?.lastPing,
          connectionId: data?.desktop?.connectionId
        },
        mobile: {
          isOnline: data?.mobile?.isOnline ?? false,
          deviceId: data?.mobile?.deviceId || this.mobileDeviceId,
          lastPing: data?.mobile?.lastPing,
          connectionId: data?.mobile?.connectionId
        },
        lastChecked: Date.now(),
        isReadyForTransfer: (data?.desktop?.isOnline ?? false) && (data?.mobile?.isOnline ?? false)
      };

      this._devicesStatus$.next(status);
      this._isCheckingStatus$.next(false);

      console.log(`[${MobileSocketService.COMPONENT}] Devices status:`, {
        desktop: status.desktop.isOnline ? '🟢' : '🔴',
        mobile: status.mobile.isOnline ? '🟢' : '🔴',
        readyForTransfer: status.isReadyForTransfer
      });

      // If mobile device (this device) is offline, send immediate ping to update status
      if (!status.mobile.isOnline && this.socket?.readyState === WebSocket.OPEN) {
        console.log(`[${MobileSocketService.COMPONENT}] Mobile detected as offline, sending immediate ping...`);
        this.callApiViaSocket('ping', { timestamp: Date.now() }).pipe(take(1)).subscribe({
          next: () => {
            console.log(`[${MobileSocketService.COMPONENT}] Immediate ping sent, rechecking status...`);
            // Recheck status after a short delay
            setTimeout(() => this.checkDevicesOnline(), 1000);
          },
          error: (err: any) => {
            console.warn(`[${MobileSocketService.COMPONENT}] Immediate ping failed:`, err);
          }
        });
      }

      return status;
    } catch (error: any) {
      console.warn(`[${MobileSocketService.COMPONENT}] Health check failed:`, error?.message || error);
      
      // On error, mark both as unknown/offline
      const status: DevicesOnlineStatus = {
        desktop: { isOnline: false, deviceId: this.desktopDeviceId },
        mobile: { isOnline: false, deviceId: this.mobileDeviceId },
        lastChecked: Date.now(),
        isReadyForTransfer: false
      };
      this._devicesStatus$.next(status);
      this._isCheckingStatus$.next(false);
      
      return status;
    }
  }

  /**
   * Force an immediate health check
   */
  async refreshDevicesStatus(): Promise<DevicesOnlineStatus | null> {
    this._isCheckingStatus$.next(true);
    return this.checkDevicesOnline();
  }

  /**
   * Get current devices status value
   */
  getDevicesStatusValue(): DevicesOnlineStatus | null {
    return this._devicesStatus$.value;
  }

  /**
   * Check if both devices are online and ready for transfer
   */
  isReadyForTransfer(): boolean {
    return this._devicesStatus$.value?.isReadyForTransfer ?? false;
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
        // Start health check when connected
        this.startHealthCheck();
        break;
      case 'ERROR':
        status = 'error';
        this.stopHealthCheck();
        break;
      case 'DISCONNECTED':
        status = 'disconnected';
        this.stopHealthCheck();
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

  async disconnect(): Promise<void> {
    console.log(`[${MobileSocketService.COMPONENT}] Disconnecting...`);

    // Notify backend via API
    if (this.isConnected()) {
      try {
        await this.callApiViaSocketPromise('tis-image-mobile-uploader/disconnect-mobile-link', {
          mobileDeviceId: this.mobileDeviceId,
          desktopDeviceId: this.desktopDeviceId,
          initiatedBy: 'mobile'
        });
      } catch (error: any) {
        console.warn(`[${MobileSocketService.COMPONENT}] Disconnect API call failed:`, error);
        // Continue with local cleanup anyway
      }
    }

    this.cleanup();
    this.clearStoredSession();
    this.transitionTo('DISCONNECTED');
  }

  private cleanup(): void {
    this.stopHeartbeat();
    this.stopHealthCheck();

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

    // Close all channel subscriptions
    this.activeChannelSubscriptions.forEach((info, channelName) => {
      try { info.subject.complete(); } catch {}
    });
    this.activeChannelSubscriptions.clear();
    this.channels.clear();
    this.activePrefixes.clear();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }
}
