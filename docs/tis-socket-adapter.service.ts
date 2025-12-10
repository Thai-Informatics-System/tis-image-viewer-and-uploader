// ============================================================================
// FILE: services/tis-socket-adapter.service.ts
// 
// This adapter bridges your existing SocketService with the 
// TisImageAndFileUploadAndView library's remote upload feature.
// ============================================================================

import { Injectable, inject, OnDestroy } from '@angular/core';
import { Observable, Subject, map, filter, takeUntil, BehaviorSubject } from 'rxjs';
import { Store } from '@ngrx/store';
import { TisSocketAdapter } from '@servicemind.tis/tis-image-and-file-upload-and-view';

// Import your existing services
import { SocketService } from './socket.service';
import { AuthService } from './auth.service';
import { FingerprintService } from './fingerprint.service';
import { environment } from '../../environments/environment';

// Import your app state for auth
import * as fromApp from '../modules/core/store/app.state';

@Injectable({
  providedIn: 'root'
})
export class TisSocketAdapterService implements TisSocketAdapter, OnDestroy {
  
  private readonly socketService = inject(SocketService);
  private readonly authService = inject(AuthService);
  private readonly fingerprintService = inject(FingerprintService);
  private readonly store = inject(Store<fromApp.AppState>);

  private readonly destroy$ = new Subject<void>();

  // Cache for device ID (resolved once)
  private cachedDeviceId: string | null = null;
  private cachedUserId: string | null = null;
  private cachedAccessToken: string | null = null;
  private cachedRefreshToken: string | null = null;

  // Map to track our channel subscriptions for cleanup
  private adapterChannels = new Map<string, Subject<any>>();

  constructor() {
    // Subscribe to auth state to cache user ID and tokens
    this.store.select('auth').pipe(
      takeUntil(this.destroy$)
    ).subscribe((authState: any) => {
      this.cachedUserId = authState?.user?.id || authState?.userId || null;
      this.cachedAccessToken = authState?.accessToken || null;
      this.cachedRefreshToken = authState?.refreshToken || null;
    });
  }

  // ===========================================================================
  // REQUIRED: TisSocketAdapter Interface Methods
  // ===========================================================================

  /**
   * Subscribe to a channel and return an Observable of messages.
   * The library uses this to listen for messages from the mobile device.
   * 
   * Channel format for mobile upload: `tis-mobile-upload-w-dev-{deviceId}`
   */
  subscribeToChannel(channelName: string): Observable<any> {
    // Check if we already have this channel
    if (this.adapterChannels.has(channelName)) {
      return this.adapterChannels.get(channelName)!.asObservable();
    }

    // Create a new subject for this channel
    const channelSubject = new Subject<any>();
    this.adapterChannels.set(channelName, channelSubject);

    // Subscribe via SocketService
    const socketChannel = this.socketService.subscribeToChannel(channelName, false);
    
    // Pipe socket messages to our subject
    socketChannel.data$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (message) => {
        // Extract the payload - handle different message formats
        const payload = message?.data || message?.payload || message;
        channelSubject.next(payload);
      },
      error: (err) => channelSubject.error(err),
      complete: () => channelSubject.complete()
    });

    return channelSubject.asObservable();
  }

  /**
   * Subscribe to channels matching a prefix.
   * Useful for listening to multiple related channels.
   */
  subscribeToChannelPrefix(prefix: string): Observable<any> {
    const prefixChannel = this.socketService.subscribeToChannelPrefix(prefix);
    
    return prefixChannel.data$.pipe(
      takeUntil(this.destroy$),
      map(message => message?.data || message?.payload || message)
    );
  }

  /**
   * Unsubscribe from a channel.
   */
  unsubscribeFromChannel(channelName: string): void {
    // Clean up our adapter's subject
    const subject = this.adapterChannels.get(channelName);
    if (subject) {
      subject.complete();
      this.adapterChannels.delete(channelName);
    }

    // Unsubscribe from SocketService
    this.socketService.unsubscribeFromChannel(channelName);
  }

  /**
   * Get unique device/browser ID for pairing.
   * Uses FingerprintService to get a persistent tab fingerprint.
   */
  async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }

    // Use your existing FingerprintService
    this.cachedDeviceId = await this.fingerprintService.getTabFingerprint();
    return this.cachedDeviceId;
  }

  /**
   * Check if socket is currently connected.
   */
  isConnected(): boolean {
    return this.socketService.socketConnectionStatus$.value === true;
  }

  /**
   * Observable that emits connection status changes.
   */
  get connectionStatus$(): Observable<boolean> {
    return this.socketService.socketConnectionStatus$.asObservable();
  }

  // ===========================================================================
  // RECOMMENDED: Additional TisSocketAdapter Methods
  // ===========================================================================

  /**
   * Get the current user ID.
   * Used to include in QR code for mobile authentication.
   */
  getUserId(): string | Promise<string> {
    if (this.cachedUserId) {
      return this.cachedUserId;
    }

    // Fallback: try to get from auth service or store
    return new Promise((resolve) => {
      this.store.select('auth').pipe(
        takeUntil(this.destroy$)
      ).subscribe((authState: any) => {
        const userId = authState?.user?.id || authState?.userId || '';
        this.cachedUserId = userId;
        resolve(userId);
      });
    });
  }

  /**
   * Get the API base URL.
   * Mobile app will use this to call the same backend APIs.
   */
  getApiUrl(): string {
    // Return your API base URL from environment
    return environment.origin || '';
  }

  /**
   * Get the WebSocket URL (optional).
   */
  getSocketUrl(): string {
    return environment.socketOrigin || '';
  }

  /**
   * Get current auth token from store.
   */
  getAuthToken(): string | null {
    return this.cachedAccessToken;
  }

  /**
   * Get current refresh token from store.
   */
  getRefreshToken(): string | null {
    return this.cachedRefreshToken;
  }

  /**
   * Send a message directly via socket.
   * Used for handshake communication with mobile device.
   * 
   * The library calls this to:
   * 1. Send connection acknowledgment to mobile
   * 2. Send disconnect notifications
   */
  sendViaSocket(message: { action: string; data: any }): void {
    // The library sends messages where `action` is the channel name
    // and `data` contains the payload
    
    // For mobile upload, we need to send to a channel
    // Format: { action: 'channel-name', data: { type: 'connectionState', state: 'SUCCESS', ... } }
    
    this.socketService.callApiViaSocket('send-to-channel', {
      channel: message.action,
      payload: message.data
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      error: (err) => console.error('[TisSocketAdapter] sendViaSocket error:', err)
    });
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  ngOnDestroy(): void {
    // Complete all adapter channel subjects
    this.adapterChannels.forEach((subject) => {
      try { subject.complete(); } catch { }
    });
    this.adapterChannels.clear();

    this.destroy$.next();
    this.destroy$.complete();
  }
}


// ============================================================================
// USAGE EXAMPLE IN YOUR COMPONENT
// ============================================================================
/*

import { Component, OnInit, inject } from '@angular/core';
import { TisSocketAdapterService } from '../services/tis-socket-adapter.service';
import type { 
  TisRemoteUploadConfig, 
  TisRemoteUploadEvent,
  UrlConfig 
} from '@servicemind.tis/tis-image-and-file-upload-and-view';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-image-upload',
  template: `
    <tis-image-and-file-upload-and-view
      type="image"
      viewType="card"
      [urlConfig]="urlConfig"
      [entityType]="'your_entity_type'"
      [entityId]="entityId"
      [options]="uploadOptions"
      [remoteUploadConfig]="remoteUploadConfig"
      accept=".png,.jpeg,.jpg"
      label="Upload Image"
      [isEnableCapture]="true"
      (onUploaded)="onUploaded($event)"
      (onRemoteUpload)="onRemoteUpload($event)"
      (onError)="onError($event)">
    </tis-image-and-file-upload-and-view>
  `
})
export class ImageUploadComponent implements OnInit {
  private readonly socketAdapter = inject(TisSocketAdapterService);

  entityId = 123;

  // URL configuration for the library
  urlConfig: UrlConfig = {
    getUploadUrl: `${environment.apiUrl}/file-upload/getUploadUrl`,
    attachToEntity: `${environment.apiUrl}/file-upload/attachToEntity`,
    updateTag: `${environment.apiUrl}/file-upload/updateTag`,
    updateSequence: `${environment.apiUrl}/file-upload/updateSequence`,
    removeImage: `${environment.apiUrl}/file-upload/remove`
  };

  // Upload options
  uploadOptions = {
    selectorId: 'my-upload-field',
    isMultiple: true,
    limit: 10,
    isCompressed: true
  };

  // Remote upload configuration - enables mobile upload feature
  remoteUploadConfig: TisRemoteUploadConfig = {
    enabled: true,
    socketAdapter: this.socketAdapter,
    apiEndpoints: {
      // Backend endpoint to generate UUID token for QR code
      generateMobileLinkToken: `${environment.apiUrl}/ease-of-access/mobile-upload-link-token`,
      uploadChannelPrefix: 'tis-mobile-upload-w-dev-'
    },
    qrCode: {
      // URL of your deployed mobile upload PWA
      mobileUploadUrl: 'https://mobile-upload.yourapp.com',
      expirySeconds: 300, // 5 minutes
      size: 200
    },
    pairing: {
      persistInStorage: true,
      pairingTTL: 24 * 60 * 60 * 1000, // 24 hours
      autoReconnect: true
    }
  };

  ngOnInit(): void {
    // Configuration is automatically done by the library
  }

  // Called when file is uploaded directly (desktop)
  onUploaded(event: any): void {
    console.log('File uploaded:', event);
  }

  // Called when file is uploaded remotely (from mobile)
  onRemoteUpload(event: TisRemoteUploadEvent): void {
    console.log('Remote upload received:', event);
    console.log('File URL:', event.file.s3Url);
    console.log('From mobile device:', event.mobileDeviceId);
    
    // Handle the remotely uploaded file
    // e.g., add to form, save to entity, etc.
  }

  onError(event: any): void {
    console.error('Upload error:', event);
  }
}

*/


// ============================================================================
// BACKEND API ENDPOINT REQUIRED
// ============================================================================
/*

Your backend needs to implement this endpoint:

// POST /ease-of-access/mobile-upload-link-token
// Request body: { deviceId: string, userId: string }
// Response: { token: string, expiresAt: number }

Example Lambda/Express handler:

async function generateMobileLinkToken(req, res) {
  const { deviceId, userId } = req.body;
  
  // Generate a short-lived UUID token
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
  
  // Store token in Redis/DynamoDB with deviceId, userId, expiresAt
  await storeToken(token, { deviceId, userId, expiresAt });
  
  return res.json({ token, expiresAt });
}

// Mobile app will call this endpoint to validate token and get credentials:
// POST /ease-of-access/generate-login-and-refresh-token-for-mobile-link-app
// Request: { token: string, deviceId: string (mobile), userId: string }
// Response: { accessToken: string, refreshToken: string, socketUrl: string }

*/
