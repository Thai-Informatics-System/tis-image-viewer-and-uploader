import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, throwError, interval } from 'rxjs';
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
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Mobile connection info stored in localStorage
 */
interface MobileConnectionInfo {
  mobileDeviceId: string;
  connectedAt: number;
  lastActivity: number;
}

/**
 * Field request info for tracking current upload request
 */
export interface FieldRequestInfo {
  label: string;
  accept: string;
  type: 'image' | 'file';
  entityType?: string;
  entityId?: any;
  isMultiple?: boolean;
  limit?: number;
  remainingSlots?: number;
  isCompressed?: boolean;
  requestId?: string;
  requestedAt: number;
}

/**
 * Device online status from health check API
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
  isReadyForTransfer: boolean; // true only if both are online
}

@Injectable({
  providedIn: 'root'
})
export class TisRemoteUploadService implements OnDestroy {
  private static readonly COMPONENT = 'TisRemoteUploadService';
  private static readonly MOBILE_CONNECTION_KEY = 'tis-mobile-connection';

  private destroy$ = new Subject<void>();
  private channelSubscription: Subscription | null = null;
  private healthCheckSubscription: Subscription | null = null;

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
  
  // Pending files from mobile - waiting for user to accept/reject
  private pendingFiles$ = new BehaviorSubject<TisRemoteUploadEvent[]>([]);
  // Flag to track if we're waiting for mobile upload
  private isWaitingForUpload$ = new BehaviorSubject<boolean>(false);
  // Current field request info
  private currentFieldRequest$ = new BehaviorSubject<FieldRequestInfo | null>(null);
  
  // Device online status - 'checking' means initial check in progress (blinking dot)
  private devicesStatus$ = new BehaviorSubject<DevicesOnlineStatus | null>(null);
  private isCheckingStatus$ = new BehaviorSubject<boolean>(false);

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
            
            // If we have a restored connection, start health check
            if (this.isConnectedToMobile()) {
              this.startHealthCheck();
            }
          }
        });

      // Subscribe to channel immediately if already connected
      if (this.socketAdapter.isConnected()) {
        this.subscribeToChannel(this.channelName);
        
        // If we have a restored connection, start health check
        if (this.isConnectedToMobile()) {
          this.startHealthCheck();
        }
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

  /**
   * Get devices online status (both desktop and mobile)
   */
  getDevicesStatus(): Observable<DevicesOnlineStatus | null> {
    return this.devicesStatus$.asObservable();
  }

  /**
   * Get current devices status value
   */
  getDevicesStatusValue(): DevicesOnlineStatus | null {
    return this.devicesStatus$.value;
  }

  /**
   * Check if currently verifying connection status (for blinking indicator)
   */
  getIsCheckingStatus(): Observable<boolean> {
    return this.isCheckingStatus$.asObservable();
  }

  /**
   * Check if both devices are online and ready for transfer
   */
  isReadyForTransfer(): boolean {
    return this.devicesStatus$.value?.isReadyForTransfer ?? false;
  }

  /**
   * Get pending files from mobile (waiting to be accepted/rejected)
   */
  getPendingFiles(): Observable<TisRemoteUploadEvent[]> {
    return this.pendingFiles$.asObservable();
  }

  /**
   * Get current pending files value
   */
  getPendingFilesValue(): TisRemoteUploadEvent[] {
    return this.pendingFiles$.value;
  }

  /**
   * Check if waiting for mobile upload
   */
  getIsWaitingForUpload(): Observable<boolean> {
    return this.isWaitingForUpload$.asObservable();
  }

  /**
   * Get current field request info
   */
  getCurrentFieldRequest(): Observable<FieldRequestInfo | null> {
    return this.currentFieldRequest$.asObservable();
  }

  /**
   * Accept a pending file (emit to remoteUpload$ and call onFileAccept callback)
   */
  acceptPendingFile(file: TisRemoteUploadEvent): void {
    // Remove from pending
    const currentPending = this.pendingFiles$.value;
    this.pendingFiles$.next(currentPending.filter(f => f !== file));

    // Emit to remoteUpload$ so component can add it
    this.remoteUpload$.next(file);

    // Call onFileAccept callback if provided
    if (this.config?.onFileAccept) {
      this.config.onFileAccept(file.file);
    }

    console.log(`[${TisRemoteUploadService.COMPONENT}] File accepted:`, file.file.fileName);
  }

  /**
   * Reject/delete a pending file
   */
  rejectPendingFile(file: TisRemoteUploadEvent): void {
    const currentPending = this.pendingFiles$.value;
    this.pendingFiles$.next(currentPending.filter(f => f !== file));
    console.log(`[${TisRemoteUploadService.COMPONENT}] File rejected:`, file.file.fileName);
  }

  /**
   * Clear all pending files
   */
  clearPendingFiles(): void {
    this.pendingFiles$.next([]);
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

      const apiResponse = await this.callHttpApi<{ success: boolean; data: { token: string; expiresAt: number; deviceId?: string; userId?: string; apiUrl?: string } }>(
        endpoint, 
        { deviceId: this.deviceId, userId: this.userId }
      );

      // Unwrap the data from API response
      const response = apiResponse.data || apiResponse as any;

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
  // Mobile Communication (via API calls)
  // ===========================================================================

  /**
   * Call API via socket with timeout - helper method
   */
  private callApiWithTimeout(route: string, body: any, timeoutMs = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socketAdapter?.callApiViaSocket) {
        reject(new Error('callApiViaSocket not available'));
        return;
      }

      const timeout = setTimeout(() => reject(new Error(`API call timeout: ${route}`)), timeoutMs);
      const callApi = this.socketAdapter.callApiViaSocket.bind(this.socketAdapter);

      callApi(route, body).pipe(take(1)).subscribe({
        next: (res) => {
          clearTimeout(timeout);
          resolve(res);
        },
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  /**
   * Send field request to mobile - tells mobile to show upload UI for this field
   */
  async sendFieldRequest(fieldInfo: {
    label: string;
    accept: string;
    type: 'image' | 'file';
    entityType?: string;
    entityId?: any;
    isMultiple?: boolean;
    limit?: number;
    remainingSlots?: number;
    isCompressed?: boolean;
  }): Promise<void> {
    if (!this.isConnectedToMobile()) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Not connected to mobile, cannot send field request`);
      return;
    }

    const mobileDeviceId = this.mobileConnection$.value?.mobileDeviceId;
    const requestId = `field-${Date.now()}`;
    console.log(`[${TisRemoteUploadService.COMPONENT}] Sending field request to mobile:`, fieldInfo);

    // Set waiting state and store field request info
    this.isWaitingForUpload$.next(true);
    this.currentFieldRequest$.next({
      ...fieldInfo,
      requestId,
      requestedAt: Date.now()
    });

    try {
      const response = await this.callApiWithTimeout('tis-image-mobile-uploader/field-request', {
        desktopDeviceId: this.deviceId,
        mobileDeviceId: mobileDeviceId,
        channel: this.channelName,
        field: fieldInfo,
        requestId
      });
      console.log(`[${TisRemoteUploadService.COMPONENT}] Field request sent:`, response);
    } catch (error: any) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Field request failed:`, error);
      // Reset waiting state on error
      this.isWaitingForUpload$.next(false);
      this.currentFieldRequest$.next(null);
    }
  }

  /**
   * Cancel current field request
   */
  async cancelFieldRequest(): Promise<void> {
    // Reset waiting state
    this.isWaitingForUpload$.next(false);
    this.currentFieldRequest$.next(null);

    if (!this.isConnectedToMobile()) {
      return;
    }

    const mobileDeviceId = this.mobileConnection$.value?.mobileDeviceId;
    console.log(`[${TisRemoteUploadService.COMPONENT}] Canceling field request`);

    try {
      await this.callApiWithTimeout('tis-image-mobile-uploader/cancel-field-request', {
        desktopDeviceId: this.deviceId,
        mobileDeviceId: mobileDeviceId,
        channel: this.channelName
      });
    } catch (error: any) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Cancel field request failed:`, error);
    }
  }

  /**
   * Accept mobile connection - update local state
   * Note: Backend already broadcasts mobile-link-established to both parties
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
  }

  /**
   * Disconnect from mobile device - call API and clear local state
   */
  async disconnect(): Promise<void> {
    console.log(`[${TisRemoteUploadService.COMPONENT}] Disconnecting from mobile...`);

    const mobileDeviceId = this.mobileConnection$.value?.mobileDeviceId;

    // Call disconnect API via socket
    if (this.socketAdapter?.callApiViaSocket && mobileDeviceId) {
      try {
        const callApi = this.socketAdapter.callApiViaSocket.bind(this.socketAdapter);
        const response = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Disconnect API timeout')), 10000);
          
          callApi('tis-image-mobile-uploader/disconnect-mobile-link', {
            desktopDeviceId: this.deviceId,
            mobileDeviceId: mobileDeviceId,
            initiatedBy: 'desktop'
          }).pipe(take(1)).subscribe({
            next: (res) => {
              clearTimeout(timeout);
              resolve(res);
            },
            error: (err) => {
              clearTimeout(timeout);
              reject(err);
            }
          });
        });
        console.log(`[${TisRemoteUploadService.COMPONENT}] Disconnect API response:`, response);
      } catch (error: any) {
        console.warn(`[${TisRemoteUploadService.COMPONENT}] Disconnect API call failed:`, error);
        // Continue with local cleanup anyway
      }
    }

    // Clear state
    this.mobileConnection$.next(null);
    this.connectionStatus$.next('disconnected');
    this.pairingSession$.next(null);
    this.clearMobileConnection();
    
    // Stop health check
    this.stopHealthCheck();
  }

  /**
   * Handle disconnect initiated from remote (mobile) side
   */
  private handleRemoteDisconnect(data: any): void {
    console.log(`[${TisRemoteUploadService.COMPONENT}] Mobile disconnected:`, data);
    
    // Clear state without calling API (mobile already initiated)
    this.mobileConnection$.next(null);
    this.connectionStatus$.next('disconnected');
    this.pairingSession$.next(null);
    this.clearMobileConnection();
    
    // Stop health check when disconnected
    this.stopHealthCheck();
  }

  // ===========================================================================
  // Device Health Check
  // ===========================================================================

  /**
   * Start periodic health check for device online status
   * Should be called when connection is established
   */
  startHealthCheck(): void {
    // Stop any existing health check
    this.stopHealthCheck();

    const mobileDeviceId = this.mobileConnection$.value?.mobileDeviceId;
    if (!mobileDeviceId || !this.deviceId) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Cannot start health check - missing device IDs`);
      return;
    }

    console.log(`[${TisRemoteUploadService.COMPONENT}] Starting health check (every ${HEALTH_CHECK_INTERVAL / 1000}s)`);

    // Set initial checking state (blinking)
    this.isCheckingStatus$.next(true);

    // Run first check immediately
    this.checkDevicesOnline();

    // Then run periodically
    this.healthCheckSubscription = interval(HEALTH_CHECK_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkDevicesOnline();
      });
  }

  /**
   * Stop health check
   */
  stopHealthCheck(): void {
    if (this.healthCheckSubscription) {
      this.healthCheckSubscription.unsubscribe();
      this.healthCheckSubscription = null;
    }
    this.devicesStatus$.next(null);
    this.isCheckingStatus$.next(false);
  }

  /**
   * Check if both devices are online via API
   */
  async checkDevicesOnline(): Promise<DevicesOnlineStatus | null> {
    const mobileDeviceId = this.mobileConnection$.value?.mobileDeviceId;
    
    if (!mobileDeviceId || !this.deviceId) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Cannot check devices - missing device IDs`);
      return null;
    }

    try {
      const response = await this.callApiWithTimeout('socket/check-devices-online', {
        desktopDeviceId: this.deviceId,
        mobileDeviceId: mobileDeviceId
      }, 15000);

      const data = response.data || response;
      
      const status: DevicesOnlineStatus = {
        desktop: {
          isOnline: data.desktop?.isOnline ?? false,
          deviceId: data.desktop?.deviceId || this.deviceId,
          lastPing: data.desktop?.lastPing,
          connectionId: data.desktop?.connectionId
        },
        mobile: {
          isOnline: data.mobile?.isOnline ?? false,
          deviceId: data.mobile?.deviceId || mobileDeviceId,
          lastPing: data.mobile?.lastPing,
          connectionId: data.mobile?.connectionId
        },
        lastChecked: Date.now(),
        isReadyForTransfer: (data.desktop?.isOnline ?? false) && (data.mobile?.isOnline ?? false)
      };

      this.devicesStatus$.next(status);
      this.isCheckingStatus$.next(false); // Stop blinking after first successful check

      console.log(`[${TisRemoteUploadService.COMPONENT}] Devices status:`, {
        desktop: status.desktop.isOnline ? '🟢' : '🔴',
        mobile: status.mobile.isOnline ? '🟢' : '🔴',
        readyForTransfer: status.isReadyForTransfer
      });

      return status;
    } catch (error: any) {
      console.warn(`[${TisRemoteUploadService.COMPONENT}] Health check failed:`, error.message);
      
      // On error, mark both as unknown/offline
      const status: DevicesOnlineStatus = {
        desktop: { isOnline: false, deviceId: this.deviceId },
        mobile: { isOnline: false, deviceId: mobileDeviceId },
        lastChecked: Date.now(),
        isReadyForTransfer: false
      };
      this.devicesStatus$.next(status);
      this.isCheckingStatus$.next(false);
      
      return status;
    }
  }

  /**
   * Force an immediate health check
   */
  async refreshDevicesStatus(): Promise<DevicesOnlineStatus | null> {
    this.isCheckingStatus$.next(true);
    return this.checkDevicesOnline();
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

    // Extract message type and data - handle nested payload structure
    const payload = message.payload || message.data || message;
    const type = payload.type || message.type;
    const data = payload;

    switch (type) {
      case 'connectionState':
        this.handleConnectionState(data);
        break;

      case 'mobile-link-established':
        this.handleMobileLinkEstablished(data);
        break;

      case 'file-uploaded':
      case 'image-uploaded':
      case 'upload_complete':
        this.handleUploadComplete(message);
        break;

      case 'disconnect':
      case 'mobile-link-disconnected':
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
   * Handle mobile-link-established message
   * This is sent when mobile successfully connects via the backend
   */
  private handleMobileLinkEstablished(data: any): void {
    const mobileDeviceId = data.mobileDeviceId;
    const mobileConnectionId = data.mobileConnectionId;
    const userId = data.userId;

    console.log(`[${TisRemoteUploadService.COMPONENT}] Mobile link established:`, {
      mobileDeviceId,
      mobileConnectionId,
      userId
    });

    if (mobileDeviceId) {
      // Save mobile connection
      const connectionInfo: MobileConnectionInfo = {
        mobileDeviceId,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      };
      this.mobileConnection$.next(connectionInfo);
      this.saveMobileConnection(connectionInfo);

      // Update status to connected
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

      // Start health check to monitor device online status
      this.startHealthCheck();

      console.log(`[${TisRemoteUploadService.COMPONENT}] Connection established with mobile device:`, mobileDeviceId);
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
   * Files are added to pending queue for user to accept/reject
   */
  private handleUploadComplete(message: any): void {
    const data = message.data || message.payload || message;
    
    // Handle both single file and files array
    const files = data.files || (data.file ? [data.file] : [data]);

    for (const file of files) {
      if (file && (file.s3Url || file.s3Path || file.resourceUrl)) {
        // Normalize the file object
        const normalizedFile: TisRemoteUploadedFile = {
          s3Url: file.s3Url || file.resourceUrl || file.uploadData?.resourceUrl || '',
          fileName: file.fileName || file.filename || file.name || file.title || 'unknown',
          mimeType: file.mimeType || file.type || 'application/octet-stream',
          size: file.size || 0,
          thumbnailUrl: file.thumbnailUrl,
          metadata: file.metadata,
          uploadData: file.uploadData
        };

        const event: TisRemoteUploadEvent = {
          file: normalizedFile,
          mobileDeviceId: data.mobileDeviceId || this.mobileConnection$.value?.mobileDeviceId || 'unknown',
          timestamp: data.timestamp || Date.now(),
          sessionId: data.sessionId
        };

        // Add to pending files (user will accept/reject)
        const currentPending = this.pendingFiles$.value;
        this.pendingFiles$.next([...currentPending, event]);

        console.log(`[${TisRemoteUploadService.COMPONENT}] File added to pending:`, normalizedFile.fileName);
      }
    }

    // Update last activity
    const conn = this.mobileConnection$.value;
    if (conn) {
      const updated = { ...conn, lastActivity: Date.now() };
      this.mobileConnection$.next(updated);
      this.saveMobileConnection(updated);
    }

    // Reset waiting state - files received
    this.isWaitingForUpload$.next(false);
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
          // Also restore connection status so UI shows connected state
          this.connectionStatus$.next('connected');
          console.log(`[${TisRemoteUploadService.COMPONENT}] Restored mobile connection from localStorage:`, info.mobileDeviceId);
        } else {
          console.log(`[${TisRemoteUploadService.COMPONENT}] Stored connection expired, clearing`);
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
    
    if (this.healthCheckSubscription) {
      this.healthCheckSubscription.unsubscribe();
    }
  }
}
