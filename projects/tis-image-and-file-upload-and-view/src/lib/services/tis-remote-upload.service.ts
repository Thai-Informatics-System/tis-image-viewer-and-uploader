import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, throwError } from 'rxjs';
import { catchError, take, takeUntil, timeout } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import {
  TisSocketAdapter,
  TisRemoteUploadConfig,
  TisPairingSession,
  TisRemoteUploadEvent,
  TisRemoteUploadMessage,
  TisRemoteUploadedFile
} from '../interfaces/socket-adapter.interface';

const DEFAULT_PAIRING_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_STORAGE_KEY = 'tis-remote-upload-session';
const DEFAULT_QR_EXPIRY = 300; // 5 minutes

/**
 * Mobile connection info stored in localStorage
 */
interface MobileConnectionInfo {
  mobileDeviceId: string;
  connectedAt: number;
  lastActivity: number;
}

@Injectable({
  providedIn: 'root'
})
export class TisRemoteUploadService implements OnDestroy {
  private static readonly COMPONENT = 'TisRemoteUploadService';
  private static readonly MOBILE_CONNECTION_KEY = 'tis-mobile-connection';

  private destroy$ = new Subject<void>();
  private channelSubscription: Subscription | null = null;

  private config: TisRemoteUploadConfig | null = null;
  private socketAdapter: TisSocketAdapter | null = null;

  // Cached values
  private deviceId: string = '';
  private userId: string = '';
  private apiUrl: string = '';
  private channelName: string = '';

  // State observables
  private pairingSession$ = new BehaviorSubject<TisPairingSession | null>(null);
  private connectionStatus$ = new BehaviorSubject<'disconnected' | 'pending' | 'connected'>('disconnected');
  private mobileConnection$ = new BehaviorSubject<MobileConnectionInfo | null>(null);
  private remoteUpload$ = new Subject<TisRemoteUploadEvent>();
  private error$ = new Subject<string>();

  constructor(private http: HttpClient) {
    // Restore mobile connection from storage on init
    this.restoreMobileConnection();
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Configure the remote upload service
   */
  async configure(config: TisRemoteUploadConfig): Promise<void> {
    this.config = config;
    this.socketAdapter = config.socketAdapter || null;

    if (config.enabled && this.socketAdapter) {
      // Get device ID, user ID, and API URL from adapter
      this.deviceId = await Promise.resolve(this.socketAdapter.getDeviceId());
      this.userId = this.socketAdapter.getUserId 
        ? await Promise.resolve(this.socketAdapter.getUserId()) 
        : '';
      this.apiUrl = this.socketAdapter.getApiUrl?.() || '';
      this.channelName = `tis-mobile-upload-w-dev-${this.deviceId}`;

      // Subscribe to socket connection status
      this.socketAdapter.connectionStatus$
        .pipe(takeUntil(this.destroy$))
        .subscribe(connected => {
          if (connected) {
            // Always subscribe to our channel when connected
            this.subscribeToChannel(this.channelName);
          }
        });

      // Subscribe to channel immediately if already connected
      if (this.socketAdapter.isConnected()) {
        this.subscribeToChannel(this.channelName);
      }

      console.log(`[${TisRemoteUploadService.COMPONENT}] Configured:`, {
        deviceId: this.deviceId,
        userId: this.userId,
        channel: this.channelName
      });
    }
  }

  // ===========================================================================
  // Public Getters
  // ===========================================================================

  /**
   * Get desktop device ID
   */
  getDesktopDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Get current mobile connection info
   */
  getMobileConnection(): Observable<MobileConnectionInfo | null> {
    return this.mobileConnection$.asObservable();
  }

  /**
   * Get current mobile device ID (if connected)
   */
  getMobileDeviceId(): string | null {
    return this.mobileConnection$.value?.mobileDeviceId || null;
  }

  /**
   * Get current pairing session
   */
  getPairingSession(): Observable<TisPairingSession | null> {
    return this.pairingSession$.asObservable();
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): Observable<'disconnected' | 'pending' | 'connected'> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Get remote upload events
   */
  getRemoteUploads(): Observable<TisRemoteUploadEvent> {
    return this.remoteUpload$.asObservable();
  }

  /**
   * Get error events
   */
  getErrors(): Observable<string> {
    return this.error$.asObservable();
  }

  /**
   * Check if remote upload is available (configured and socket connected)
   */
  isAvailable(): boolean {
    return !!(
      this.config?.enabled &&
      this.socketAdapter &&
      this.socketAdapter.isConnected()
    );
  }

  /**
   * Check if currently connected to a mobile device
   */
  isConnectedToMobile(): boolean {
    return this.connectionStatus$.value === 'connected' && !!this.mobileConnection$.value;
  }

  /**
   * Alias for isConnectedToMobile - Check if paired with mobile
   */
  isPaired(): boolean {
    return this.isConnectedToMobile();
  }

  // ===========================================================================
  // QR Code Generation (New Flow)
  // ===========================================================================

  /**
   * Generate QR code data for mobile app
   * Flow:
   * 1. Call API to get a short-lived link token (UUID)
   * 2. Build QR URL with: apiUrl, deviceId, userId, token
   */
  async generateQrCode(): Promise<{ qrData: string; expiresAt: number }> {
    if (!this.isAvailable()) {
      throw new Error('Remote upload is not available. Check configuration and socket connection.');
    }

    if (!this.apiUrl) {
      throw new Error('API URL not configured in socket adapter');
    }

    try {
      // Step 1: Get link token from backend
      const endpoint = this.config?.apiEndpoints?.generateMobileLinkToken 
        || `${this.apiUrl}/ease-of-access/mobile-upload-link-token`;

      const response = await this.callHttpApi<{ token: string; expiresAt: number }>(
        endpoint, 
        { deviceId: this.deviceId, userId: this.userId }
      );

      const expirySeconds = this.config?.qrCode?.expirySeconds || DEFAULT_QR_EXPIRY;
      const expiresAt = response.expiresAt || Date.now() + expirySeconds * 1000;

      // Step 2: Build QR URL
      const mobileUrl = this.config?.qrCode?.mobileUploadUrl || '';
      const qrData = this.buildQrUrl(mobileUrl, {
        token: response.token,
        deviceId: this.deviceId,
        userId: this.userId,
        apiUrl: this.apiUrl
      });

      // Update pairing session
      const session: TisPairingSession = {
        pairingCode: response.token,
        desktopDeviceId: this.deviceId,
        channel: this.channelName,
        createdAt: Date.now(),
        expiresAt,
        status: 'pending'
      };
      this.pairingSession$.next(session);
      this.connectionStatus$.next('pending');

      console.log(`[${TisRemoteUploadService.COMPONENT}] QR code generated, waiting for mobile...`);

      return { qrData, expiresAt };

    } catch (error: any) {
      const msg = `Failed to generate QR code: ${error.message}`;
      console.error(`[${TisRemoteUploadService.COMPONENT}]`, msg);
      this.error$.next(msg);
      throw error;
    }
  }

  /**
   * Build QR URL with minimal parameters
   */
  private buildQrUrl(
    baseUrl: string,
    params: { token: string; deviceId: string; userId: string; apiUrl: string }
  ): string {
    const url = new URL(baseUrl);
    url.searchParams.set('token', params.token);
    url.searchParams.set('deviceId', params.deviceId);
    url.searchParams.set('userId', params.userId);
    url.searchParams.set('apiUrl', encodeURIComponent(params.apiUrl));
    return url.toString();
  }

  // ===========================================================================
  // Mobile Communication
  // ===========================================================================

  /**
   * Send message to mobile device
   */
  sendToMobile(type: string, data: any): void {
    if (!this.socketAdapter?.sendViaSocket) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] sendViaSocket not available`);
      return;
    }

    this.socketAdapter.sendViaSocket({
      action: this.channelName,
      data: {
        type,
        ...data,
        desktopDeviceId: this.deviceId,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Accept mobile connection (send SUCCESS response)
   */
  private acceptMobileConnection(mobileDeviceId: string): void {
    console.log(`[${TisRemoteUploadService.COMPONENT}] Accepting mobile connection:`, mobileDeviceId);

    // Save mobile connection
    const connectionInfo: MobileConnectionInfo = {
      mobileDeviceId,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };
    this.mobileConnection$.next(connectionInfo);
    this.saveMobileConnection(connectionInfo);

    // Update status
    this.connectionStatus$.next('connected');

    // Update session
    const session = this.pairingSession$.value;
    if (session) {
      const updatedSession: TisPairingSession = {
        ...session,
        mobileDeviceId,
        status: 'connected',
        lastActivity: Date.now()
      };
      this.pairingSession$.next(updatedSession);
    }

    // Send SUCCESS to mobile
    this.sendToMobile('connectionState', { state: 'SUCCESS' });
  }

  /**
   * Disconnect from mobile device
   */
  disconnect(): void {
    console.log(`[${TisRemoteUploadService.COMPONENT}] Disconnecting from mobile...`);

    // Notify mobile
    this.sendToMobile('connectionState', { state: 'DISCONNECTED' });

    // Clear state
    this.mobileConnection$.next(null);
    this.connectionStatus$.next('disconnected');
    this.pairingSession$.next(null);
    this.clearMobileConnection();
  }

  // ===========================================================================
  // Channel Subscription & Message Handling
  // ===========================================================================

  /**
   * Subscribe to channel for receiving messages from mobile
   */
  private subscribeToChannel(channel: string): void {
    if (this.channelSubscription) {
      this.channelSubscription.unsubscribe();
    }

    if (!this.socketAdapter) {
      return;
    }

    console.log(`[${TisRemoteUploadService.COMPONENT}] Subscribing to channel:`, channel);

    this.channelSubscription = this.socketAdapter.subscribeToChannel(channel)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message: any) => this.handleChannelMessage(message),
        error: (error) => {
          console.error(`[${TisRemoteUploadService.COMPONENT}] Channel error:`, error);
          this.error$.next(`Channel subscription error: ${error.message}`);
        }
      });
  }

  /**
   * Handle incoming channel messages from mobile
   */
  private handleChannelMessage(message: any): void {
    console.log(`[${TisRemoteUploadService.COMPONENT}] Received:`, message);

    // Extract message type and data
    const type = message.type || message.data?.type;
    const data = message.data || message.payload || message;

    switch (type) {
      case 'connectionState':
        this.handleConnectionState(data);
        break;

      case 'image-uploaded':
      case 'upload_complete':
        this.handleUploadComplete(message);
        break;

      case 'disconnect':
        this.handleMobileDisconnect(data);
        break;

      default:
        // Check if it's an upload event
        if (data.file || data.fileName || data.fileUrl) {
          this.handleUploadComplete(message);
        } else {
          console.log(`[${TisRemoteUploadService.COMPONENT}] Unknown message type:`, type);
        }
    }
  }

  /**
   * Handle connection state messages from mobile
   */
  private handleConnectionState(data: any): void {
    const state = data.state || data.connectionState;
    const mobileDeviceId = data.mobileDeviceId;

    console.log(`[${TisRemoteUploadService.COMPONENT}] Connection state:`, state, 'from:', mobileDeviceId);

    if (state === 'INITIATED' && mobileDeviceId) {
      // Mobile is initiating connection - accept it
      this.acceptMobileConnection(mobileDeviceId);
    }
  }

  /**
   * Handle upload complete from mobile
   */
  private handleUploadComplete(message: any): void {
    const data = message.data || message.payload || message;
    const file = data.file || data;

    if (file) {
      const event: TisRemoteUploadEvent = {
        file,
        mobileDeviceId: data.mobileDeviceId || this.mobileConnection$.value?.mobileDeviceId || 'unknown',
        timestamp: data.timestamp || Date.now(),
        sessionId: data.sessionId
      };

      // Update last activity
      const conn = this.mobileConnection$.value;
      if (conn) {
        const updated = { ...conn, lastActivity: Date.now() };
        this.mobileConnection$.next(updated);
        this.saveMobileConnection(updated);
      }

      this.remoteUpload$.next(event);
      console.log(`[${TisRemoteUploadService.COMPONENT}] Upload received:`, event);
    }
  }

  /**
   * Handle mobile disconnect
   */
  private handleMobileDisconnect(data: any): void {
    console.log(`[${TisRemoteUploadService.COMPONENT}] Mobile disconnected:`, data);
    
    this.mobileConnection$.next(null);
    this.connectionStatus$.next('disconnected');
    this.clearMobileConnection();

    // Update session
    const session = this.pairingSession$.value;
    if (session) {
      this.pairingSession$.next({
        ...session,
        status: 'disconnected',
        lastActivity: Date.now()
      });
    }
  }

  // ===========================================================================
  // Storage
  // ===========================================================================

  /**
   * Save mobile connection to localStorage
   */
  private saveMobileConnection(info: MobileConnectionInfo): void {
    try {
      localStorage.setItem(
        TisRemoteUploadService.MOBILE_CONNECTION_KEY, 
        JSON.stringify(info)
      );
    } catch (e) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Failed to save connection:`, e);
    }
  }

  /**
   * Restore mobile connection from localStorage
   */
  private restoreMobileConnection(): void {
    try {
      const stored = localStorage.getItem(TisRemoteUploadService.MOBILE_CONNECTION_KEY);
      if (stored) {
        const info: MobileConnectionInfo = JSON.parse(stored);
        // Only restore if connected within last 24 hours
        if (Date.now() - info.lastActivity < DEFAULT_PAIRING_TTL) {
          this.mobileConnection$.next(info);
          // Note: actual connection status will be updated when mobile reconnects
        } else {
          this.clearMobileConnection();
        }
      }
    } catch (e) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Failed to restore connection:`, e);
    }
  }

  /**
   * Clear mobile connection from localStorage
   */
  private clearMobileConnection(): void {
    try {
      localStorage.removeItem(TisRemoteUploadService.MOBILE_CONNECTION_KEY);
    } catch (e) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Failed to clear connection:`, e);
    }
  }

  // ===========================================================================
  // HTTP API
  // ===========================================================================

  /**
   * Call HTTP API endpoint
   */
  private callHttpApi<T>(endpoint: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.http.post<T>(endpoint, data)
        .pipe(take(1), timeout(30000))
        .subscribe({
          next: resolve,
          error: reject
        });
    });
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.channelSubscription) {
      this.channelSubscription.unsubscribe();
    }
  }
}
