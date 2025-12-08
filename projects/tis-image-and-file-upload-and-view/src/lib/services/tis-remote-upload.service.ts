import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, of, throwError } from 'rxjs';
import { catchError, filter, map, take, takeUntil, tap, timeout } from 'rxjs/operators';
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
const DEFAULT_STORAGE_KEY = 'tis-remote-upload-pairing';
const DEFAULT_QR_EXPIRY = 300; // 5 minutes

@Injectable({
  providedIn: 'root'
})
export class TisRemoteUploadService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private channelSubscription: Subscription | null = null;

  private config: TisRemoteUploadConfig | null = null;
  private socketAdapter: TisSocketAdapter | null = null;

  // State observables
  private pairingSession$ = new BehaviorSubject<TisPairingSession | null>(null);
  private connectionStatus$ = new BehaviorSubject<'disconnected' | 'pending' | 'connected'>('disconnected');
  private remoteUpload$ = new Subject<TisRemoteUploadEvent>();
  private error$ = new Subject<string>();

  constructor(private http: HttpClient) {
    // Try to restore session from storage on init
    this.restoreSession();
  }

  /**
   * Configure the remote upload service
   */
  configure(config: TisRemoteUploadConfig): void {
    this.config = config;
    this.socketAdapter = config.socketAdapter || null;

    if (config.enabled && this.socketAdapter) {
      // Subscribe to socket connection status
      this.socketAdapter.connectionStatus$
        .pipe(takeUntil(this.destroy$))
        .subscribe(connected => {
          if (connected && this.pairingSession$.value?.status === 'connected') {
            // Re-subscribe to channel on reconnection
            this.subscribeToChannel(this.pairingSession$.value.channel);
          }
        });

      // Auto-reconnect if pairing exists
      if (config.pairing?.autoReconnect !== false) {
        const session = this.pairingSession$.value;
        if (session && session.status === 'connected' && !this.isSessionExpired(session)) {
          this.subscribeToChannel(session.channel);
        }
      }
    }
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
   * Check if currently paired with a mobile device
   */
  isPaired(): boolean {
    const session = this.pairingSession$.value;
    return !!(session && session.status === 'connected' && !this.isSessionExpired(session));
  }

  /**
   * Generate a new pairing code and QR data
   */
  async generatePairingCode(): Promise<{ qrData: string; pairingCode: string; expiresAt: number }> {
    if (!this.isAvailable()) {
      throw new Error('Remote upload is not available. Check configuration and socket connection.');
    }

    const deviceId = await this.getDeviceId();
    const endpoint = this.config!.apiEndpoints?.generatePairingCode;

    if (!endpoint) {
      throw new Error('generatePairingCode endpoint not configured');
    }

    try {
      // Call API to generate pairing code
      const response = await this.callApi<{
        pairingCode: string;
        channel: string;
        expiresAt: number;
      }>(endpoint, { deviceId });

      const expirySeconds = this.config?.qrCode?.expirySeconds || DEFAULT_QR_EXPIRY;
      const expiresAt = response.expiresAt || Date.now() + expirySeconds * 1000;

      // Create pairing session
      const session: TisPairingSession = {
        pairingCode: response.pairingCode,
        desktopDeviceId: deviceId,
        channel: response.channel,
        createdAt: Date.now(),
        expiresAt,
        status: 'pending'
      };

      // Save session
      this.pairingSession$.next(session);
      this.saveSession(session);
      this.connectionStatus$.next('pending');

      // Subscribe to the channel
      this.subscribeToChannel(session.channel);

      // Generate QR data URL
      const mobileUrl = this.config?.qrCode?.mobileUploadUrl || '';
      const qrData = `${mobileUrl}?code=${response.pairingCode}&deviceId=${deviceId}`;

      return {
        qrData,
        pairingCode: response.pairingCode,
        expiresAt
      };
    } catch (error: any) {
      this.error$.next(`Failed to generate pairing code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate a pairing code (used by mobile app)
   */
  async validatePairingCode(pairingCode: string): Promise<{
    valid: boolean;
    desktopDeviceId?: string;
    channel?: string;
  }> {
    const endpoint = this.config?.apiEndpoints?.validatePairingCode;

    if (!endpoint) {
      throw new Error('validatePairingCode endpoint not configured');
    }

    try {
      const response = await this.callApi<{
        valid: boolean;
        desktopDeviceId?: string;
        channel?: string;
      }>(endpoint, { pairingCode });

      return response;
    } catch (error: any) {
      this.error$.next(`Failed to validate pairing code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect and clear pairing
   */
  disconnect(): void {
    const session = this.pairingSession$.value;

    if (session && this.channelSubscription) {
      // Unsubscribe from channel
      if (this.socketAdapter?.unsubscribeFromChannel) {
        this.socketAdapter.unsubscribeFromChannel(session.channel);
      }
      this.channelSubscription.unsubscribe();
      this.channelSubscription = null;
    }

    // Clear session
    this.pairingSession$.next(null);
    this.connectionStatus$.next('disconnected');
    this.clearStoredSession();
  }

  /**
   * Notify desktop about uploaded file (called by mobile)
   */
  async notifyUpload(
    channel: string,
    uploadedFile: TisRemoteUploadedFile,
    sessionId?: string
  ): Promise<void> {
    const endpoint = this.config?.apiEndpoints?.notifyUpload;
    const deviceId = await this.getDeviceId();

    const message: TisRemoteUploadMessage = {
      type: 'upload_complete',
      channel,
      payload: {
        file: uploadedFile,
        sessionId
      },
      senderId: deviceId,
      timestamp: Date.now()
    };

    if (endpoint) {
      // Use HTTP API to notify
      await this.callApi(endpoint, message);
    } else if (this.socketAdapter?.callApi) {
      // Use socket to notify directly
      this.socketAdapter.callApi('remote-upload/notify', message);
    }
  }

  /**
   * Get device ID from socket adapter
   */
  private async getDeviceId(): Promise<string> {
    if (!this.socketAdapter) {
      throw new Error('Socket adapter not configured');
    }

    const deviceId = this.socketAdapter.getDeviceId();
    return deviceId instanceof Promise ? await deviceId : deviceId;
  }

  /**
   * Subscribe to a channel for receiving remote upload messages
   */
  private subscribeToChannel(channel: string): void {
    if (this.channelSubscription) {
      this.channelSubscription.unsubscribe();
    }

    if (!this.socketAdapter) {
      return;
    }

    this.channelSubscription = this.socketAdapter.subscribeToChannel(channel)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message: TisRemoteUploadMessage | any) => {
          this.handleChannelMessage(message);
        },
        error: (error) => {
          console.error('[TisRemoteUploadService] Channel subscription error:', error);
          this.error$.next(`Channel subscription error: ${error.message}`);
        }
      });
  }

  /**
   * Handle incoming channel messages
   */
  private handleChannelMessage(message: TisRemoteUploadMessage | any): void {
    console.log('[TisRemoteUploadService] Received message:', message);

    // Handle both wrapped and direct message formats
    const msg = message.payload ? message : { type: message.type, payload: message };

    switch (msg.type || message.type) {
      case 'pairing_accepted':
        this.handlePairingAccepted(message);
        break;

      case 'upload_started':
        console.log('[TisRemoteUploadService] Upload started from mobile');
        break;

      case 'upload_progress':
        console.log('[TisRemoteUploadService] Upload progress:', message.payload?.progress);
        break;

      case 'upload_complete':
        this.handleUploadComplete(message);
        break;

      case 'upload_error':
        this.error$.next(`Remote upload error: ${message.payload?.error}`);
        break;

      case 'disconnect':
        this.handleMobileDisconnect(message);
        break;

      default:
        // Try to handle as upload complete if it has file data
        if (message.payload?.file || message.file) {
          this.handleUploadComplete(message);
        }
    }
  }

  /**
   * Handle pairing accepted from mobile
   */
  private handlePairingAccepted(message: any): void {
    const session = this.pairingSession$.value;
    if (session) {
      const updatedSession: TisPairingSession = {
        ...session,
        mobileDeviceId: message.senderId || message.payload?.mobileDeviceId,
        status: 'connected',
        lastActivity: Date.now()
      };

      this.pairingSession$.next(updatedSession);
      this.saveSession(updatedSession);
      this.connectionStatus$.next('connected');

      console.log('[TisRemoteUploadService] Pairing accepted, mobile connected');
    }
  }

  /**
   * Handle upload complete from mobile
   */
  private handleUploadComplete(message: any): void {
    const session = this.pairingSession$.value;
    const file = message.payload?.file || message.file;

    if (file) {
      const event: TisRemoteUploadEvent = {
        file,
        mobileDeviceId: message.senderId || session?.mobileDeviceId || 'unknown',
        timestamp: message.timestamp || Date.now(),
        sessionId: message.payload?.sessionId
      };

      // Update last activity
      if (session) {
        const updatedSession = { ...session, lastActivity: Date.now() };
        this.pairingSession$.next(updatedSession);
        this.saveSession(updatedSession);
      }

      this.remoteUpload$.next(event);
      console.log('[TisRemoteUploadService] Remote upload received:', event);
    }
  }

  /**
   * Handle mobile disconnect
   */
  private handleMobileDisconnect(message: any): void {
    const session = this.pairingSession$.value;
    if (session) {
      const updatedSession: TisPairingSession = {
        ...session,
        status: 'disconnected',
        lastActivity: Date.now()
      };

      this.pairingSession$.next(updatedSession);
      this.saveSession(updatedSession);
      this.connectionStatus$.next('disconnected');

      console.log('[TisRemoteUploadService] Mobile disconnected');
    }
  }

  /**
   * Call API endpoint
   */
  private callApi<T>(endpoint: string, data: any): Promise<T> {
    // If socket adapter has callApi, prefer that for consistency
    if (this.socketAdapter?.callApi) {
      return new Promise((resolve, reject) => {
        this.socketAdapter!.callApi!(endpoint, data)
          .pipe(
            take(1),
            timeout(30000),
            catchError(err => {
              reject(err);
              return throwError(() => err);
            })
          )
          .subscribe({
            next: (response: any) => {
              if (response.status === 200 || response.statusCode === 200) {
                resolve(response.payload || response.body || response);
              } else {
                reject(new Error(response.message || 'API call failed'));
              }
            },
            error: reject
          });
      });
    }

    // Fallback to HTTP
    return new Promise((resolve, reject) => {
      this.http.post<T>(endpoint, data)
        .pipe(take(1), timeout(30000))
        .subscribe({
          next: resolve,
          error: reject
        });
    });
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: TisPairingSession): boolean {
    const pairingTTL = this.config?.pairing?.pairingTTL ?? DEFAULT_PAIRING_TTL;

    if (pairingTTL === 0) {
      // Session-only pairing - always valid until disconnect
      return false;
    }

    return Date.now() > session.expiresAt;
  }

  /**
   * Save session to localStorage
   */
  private saveSession(session: TisPairingSession): void {
    if (this.config?.pairing?.persistInStorage === false) {
      return;
    }

    try {
      const storageKey = this.config?.pairing?.storageKey || DEFAULT_STORAGE_KEY;
      localStorage.setItem(storageKey, JSON.stringify(session));
    } catch (error) {
      console.warn('[TisRemoteUploadService] Failed to save session to storage:', error);
    }
  }

  /**
   * Restore session from localStorage
   */
  private restoreSession(): void {
    try {
      const storageKey = this.config?.pairing?.storageKey || DEFAULT_STORAGE_KEY;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const session: TisPairingSession = JSON.parse(stored);

        if (!this.isSessionExpired(session)) {
          this.pairingSession$.next(session);

          if (session.status === 'connected') {
            this.connectionStatus$.next('connected');
          } else if (session.status === 'pending') {
            this.connectionStatus$.next('pending');
          }
        } else {
          // Clear expired session
          this.clearStoredSession();
        }
      }
    } catch (error) {
      console.warn('[TisRemoteUploadService] Failed to restore session from storage:', error);
    }
  }

  /**
   * Clear stored session
   */
  private clearStoredSession(): void {
    try {
      const storageKey = this.config?.pairing?.storageKey || DEFAULT_STORAGE_KEY;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('[TisRemoteUploadService] Failed to clear stored session:', error);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.channelSubscription) {
      this.channelSubscription.unsubscribe();
    }
  }
}
