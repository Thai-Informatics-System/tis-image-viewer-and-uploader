// ============================================================================
// FILE: services/mock-socket-adapter.service.ts
// 
// This is a MOCK adapter for testing the TisImageAndFileUploadAndView 
// library's remote upload feature without a real socket connection.
// ============================================================================

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of } from 'rxjs';
import { TisSocketAdapter } from '@servicemind.tis/tis-image-and-file-upload-and-view';

@Injectable({
  providedIn: 'root'
})
export class MockSocketAdapterService implements TisSocketAdapter, OnDestroy {

  private readonly destroy$ = new Subject<void>();
  private readonly connectionStatus$$ = new BehaviorSubject<boolean>(true);

  // Cache for device ID (resolved once)
  private cachedDeviceId: string | null = null;
  private cachedUserId: string = 'mock-user-123';
  private cachedAccessToken: string = 'mock-access-token';
  private cachedRefreshToken: string = 'mock-refresh-token';

  // Map to track our channel subscriptions for cleanup
  private adapterChannels = new Map<string, Subject<any>>();

  constructor() {
    console.log('[MockSocketAdapter] Initialized - Mock mode active');
  }

  // ===========================================================================
  // REQUIRED: TisSocketAdapter Interface Methods
  // ===========================================================================

  /**
   * Subscribe to a channel and return an Observable of messages.
   * MOCK: Returns an observable that can be used for testing.
   */
  subscribeToChannel(channelName: string): Observable<any> {
    console.log('[MockSocketAdapter] Subscribe to channel:', channelName);
    
    // Check if we already have this channel
    if (this.adapterChannels.has(channelName)) {
      return this.adapterChannels.get(channelName)!.asObservable();
    }

    // Create a new subject for this channel
    const channelSubject = new Subject<any>();
    this.adapterChannels.set(channelName, channelSubject);

    // In a real implementation, you would subscribe to your socket service here
    // For mock purposes, this channel is ready to receive test messages

    return channelSubject.asObservable();
  }

  /**
   * Subscribe to channels matching a prefix.
   * MOCK: Returns an empty observable.
   */
  subscribeToChannelPrefix(prefix: string): Observable<any> {
    console.log('[MockSocketAdapter] Subscribe to channel prefix:', prefix);
    return new Subject<any>().asObservable();
  }

  /**
   * Unsubscribe from a channel.
   */
  unsubscribeFromChannel(channelName: string): void {
    console.log('[MockSocketAdapter] Unsubscribe from channel:', channelName);
    
    // Clean up our adapter's subject
    const subject = this.adapterChannels.get(channelName);
    if (subject) {
      subject.complete();
      this.adapterChannels.delete(channelName);
    }
  }

  /**
   * Get unique device/browser ID for pairing.
   * MOCK: Returns a consistent mock device ID.
   */
  async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }

    // Generate a mock device ID
    this.cachedDeviceId = 'mock-device-' + Math.random().toString(36).substring(7);
    console.log('[MockSocketAdapter] Generated device ID:', this.cachedDeviceId);
    return this.cachedDeviceId;
  }

  /**
   * Check if socket is currently connected.
   * MOCK: Always returns true.
   */
  isConnected(): boolean {
    return true;
  }

  /**
   * Observable that emits connection status changes.
   * MOCK: Returns observable that emits true.
   */
  get connectionStatus$(): Observable<boolean> {
    return this.connectionStatus$$.asObservable();
  }

  // ===========================================================================
  // RECOMMENDED: Additional TisSocketAdapter Methods
  // ===========================================================================

  /**
   * Get the current user ID.
   * MOCK: Returns a mock user ID.
   */
  getUserId(): string {
    return this.cachedUserId;
  }

  /**
   * Get the API base URL.
   * MOCK: Returns a mock API URL.
   */
  getApiUrl(): string {
    return 'http://localhost:4200/api';
  }

  /**
   * Get the WebSocket URL (optional).
   * MOCK: Returns a mock socket URL.
   */
  getSocketUrl(): string {
    return 'ws://localhost:4200/socket';
  }

  /**
   * Get current auth token.
   * MOCK: Returns a mock token.
   */
  getAuthToken(): string | null {
    return this.cachedAccessToken;
  }

  /**
   * Get current refresh token.
   * MOCK: Returns a mock refresh token.
   */
  getRefreshToken(): string | null {
    return this.cachedRefreshToken;
  }

  /**
   * Call API via socket.
   * MOCK: Returns a mock response.
   */
  callApiViaSocket(route: string, body: any): Observable<any> {
    console.log('[MockSocketAdapter] Call API via socket:', route, body);
    
    // Return mock response based on the route
    if (route.includes('mobile-upload-link-token')) {
      return of({
        success: true,
        data: {
          token: 'mock-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        }
      });
    }
    
    return of({
      success: true,
      data: {}
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
