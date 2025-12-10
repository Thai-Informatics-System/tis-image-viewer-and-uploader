import { Component, OnInit, OnDestroy, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import { TisImageAndFileUploadAndViewModule } from '@servicemind.tis/tis-image-and-file-upload-and-view';
import type { UrlConfig, OptionConfig } from '@servicemind.tis/tis-image-and-file-upload-and-view';

import { MobileSocketService, QrCodeParams, ConnectionStatus, DesktopMessage } from '../../services/mobile-socket.service';
import { MobileUploadService } from '../../services/mobile-upload.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TisImageAndFileUploadAndViewModule
  ],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly socketService = inject(MobileSocketService);
  private readonly uploadService = inject(MobileUploadService);
  private readonly snackBar = inject(MatSnackBar);

  private destroy$ = new Subject<void>();

  // -------------------------------------------------------------------------
  // State Signals
  // -------------------------------------------------------------------------
  
  // Initialization state
  readonly isInitializing = signal(true);
  readonly initError = signal<string | null>(null);
  
  // Connection state
  readonly connectionStatus = signal<ConnectionStatus>('disconnected');
  
  // Device IDs
  readonly mobileDeviceId = signal<string>('');
  readonly desktopDeviceId = signal<string>('');
  
  // API URL from QR params (used for library urlConfig)
  readonly apiUrl = signal<string>('');
  
  // Desktop info received via socket (field configuration)
  readonly desktopFieldInfo = signal<DesktopFieldInfo | null>(null);
  
  // Computed states
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');
  readonly isReady = computed(() => this.isConnected() && !this.isInitializing() && !!this.apiUrl());

  // Upload tracking from service
  readonly totalUploaded = this.uploadService.totalUploaded;
  readonly hasUploads = this.uploadService.hasUploads;

  // -------------------------------------------------------------------------
  // Library Configuration (computed)
  // -------------------------------------------------------------------------

  /**
   * URL configuration for the library
   * Uses apiUrl from QR params as base
   */
  readonly urlConfig = computed<UrlConfig>(() => {
    const base = this.apiUrl();
    if (!base) {
      return {
        getUploadUrl: '',
        attachToEntity: null,
        updateTag: null,
        updateSequence: null,
        removeImage: ''
      };
    }

    return {
      getUploadUrl: `${base}/file-upload/getUploadUrl`,
      attachToEntity: `${base}/file-upload/attachToEntity`,
      updateTag: `${base}/file-upload/updateTag`,
      updateSequence: `${base}/file-upload/updateSequence`,
      removeImage: `${base}/file-upload/remove`
    };
  });

  /**
   * Options configuration for the library
   */
  readonly options = computed<OptionConfig>(() => {
    const fieldInfo = this.desktopFieldInfo();
    return {
      selectorId: `mobile-upload-${this.mobileDeviceId() || 'default'}`,
      isMultiple: fieldInfo?.isMultiple ?? true,
      limit: fieldInfo?.limit ?? 10,
      isCompressed: fieldInfo?.isCompressed ?? true,
      hiddenDeleteBtn: false,
      hiddenPreview: false
    };
  });

  /**
   * Accept types for the library
   */
  readonly acceptTypes = computed(() => {
    const fieldInfo = this.desktopFieldInfo();
    return fieldInfo?.accept || '.png,.jpeg,.jpg,.pdf';
  });

  /**
   * Upload type (image or file)
   */
  readonly uploadType = computed<'image' | 'file'>(() => {
    const fieldInfo = this.desktopFieldInfo();
    return fieldInfo?.type || 'image';
  });

  /**
   * Entity type for upload
   */
  readonly entityType = computed(() => {
    const fieldInfo = this.desktopFieldInfo();
    return fieldInfo?.entityType || 'mobile_upload';
  });

  constructor() {
    // Effect to watch connection status changes
    effect(() => {
      const status = this.connectionStatus();
      if (status === 'disconnected' && !this.isInitializing()) {
        this.snackBar.open('Connection lost. Reconnecting...', '', { duration: 2000 });
      }
    });
  }

  ngOnInit(): void {
    // Subscribe to socket connection status
    this.socketService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.connectionStatus.set(status);
      });

    // Subscribe to desktop messages
    this.socketService.desktopMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => this.handleDesktopMessage(message));

    // Initialize from URL params or stored session
    this.initializeFromUrl();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  private async initializeFromUrl(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    
    const token = params.get('token');
    const deviceId = params.get('deviceId');
    const userId = params.get('userId');
    const apiUrl = params.get('apiUrl');

    // Decode apiUrl if present
    const decodedApiUrl = apiUrl ? decodeURIComponent(apiUrl) : null;

    // Check if we have QR params
    if (token && deviceId && userId && decodedApiUrl) {
      await this.initializeConnection({
        token,
        deviceId,
        userId,
        apiUrl: decodedApiUrl
      });
      return;
    }

    // Try to restore from stored session
    if (this.socketService.hasStoredSession()) {
      try {
        this.isInitializing.set(true);
        this.initError.set(null);
        
        await this.socketService.retryFromStoredSession();
        
        this.mobileDeviceId.set(this.socketService.getMobileDeviceId());
        this.desktopDeviceId.set(this.socketService.getDesktopDeviceId());
        this.apiUrl.set(this.socketService.getApiUrl());
        this.isInitializing.set(false);
        this.snackBar.open('Reconnected to desktop!', '', { duration: 2000 });
        return;
      } catch (error: any) {
        console.error('[UploadComponent] Session restore failed:', error);
        // Fall through to show error
      }
    }

    // No params and no stored session
    this.isInitializing.set(false);
    this.initError.set('Please scan the QR code from the desktop app to connect.');
  }

  private async initializeConnection(params: QrCodeParams): Promise<void> {
    this.isInitializing.set(true);
    this.initError.set(null);

    try {
      await this.socketService.initialize(params);
      
      this.mobileDeviceId.set(this.socketService.getMobileDeviceId());
      this.desktopDeviceId.set(this.socketService.getDesktopDeviceId());
      this.apiUrl.set(params.apiUrl);
      this.isInitializing.set(false);
      this.snackBar.open('Connected to desktop!', '', { duration: 2000 });

    } catch (error: any) {
      console.error('[UploadComponent] Initialization failed:', error);
      this.isInitializing.set(false);
      this.initError.set(error.message || 'Failed to connect. Please scan a new QR code.');
    }
  }

  // -------------------------------------------------------------------------
  // Desktop Message Handling
  // -------------------------------------------------------------------------

  private handleDesktopMessage(message: DesktopMessage): void {
    if (!message) return;

    console.log('[UploadComponent] Desktop message:', message);

    switch (message.type) {
      case 'connectionState':
        if (message.state === 'DISCONNECTED' || message.connectionState === 'DISCONNECTED') {
          this.snackBar.open('Disconnected by desktop', '', { duration: 3000 });
          this.connectionStatus.set('disconnected');
        }
        break;

      case 'field-info':
        // Desktop sends field configuration when user selects an upload field
        this.desktopFieldInfo.set({
          label: message['label'],
          accept: message['accept'],
          type: message['fieldType'] || 'image',
          entityType: message['entityType'],
          entityId: message['entityId'],
          isMultiple: message['isMultiple'],
          limit: message['limit'],
          isCompressed: message['isCompressed']
        });
        if (message['label']) {
          this.snackBar.open(`Ready to upload: ${message['label']}`, '', { duration: 3000 });
        }
        break;

      case 'session-ended':
        this.snackBar.open('Session ended by desktop', '', { duration: 3000 });
        this.router.navigate(['/error'], { queryParams: { type: 'session-expired' } });
        break;

      case 'file-received':
      case 'image-received':
        this.snackBar.open('File received on desktop!', '', { duration: 2000 });
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Library Event Handlers
  // -------------------------------------------------------------------------

  /**
   * Called when library successfully uploads a file
   * Send the upload data to desktop via socket
   */
  onUploaded(event: any): void {
    console.log('[UploadComponent] File uploaded:', event);
    
    // Send to desktop via socket
    this.uploadService.sendToDesktop(event);
    
    this.snackBar.open('File sent to desktop!', '', { duration: 2000 });
  }

  /**
   * Called when upload is in progress
   */
  onUploadInProgress(event: any): void {
    console.log('[UploadComponent] Upload in progress:', event);
  }

  /**
   * Called when there's an upload error
   */
  onError(event: any): void {
    console.error('[UploadComponent] Upload error:', event);
    this.snackBar.open('Upload failed. Please try again.', '', { duration: 3000 });
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  retryConnection(): void {
    this.initializeFromUrl();
  }

  disconnect(): void {
    this.socketService.disconnect();
    this.uploadService.clearUploads();
    this.connectionStatus.set('disconnected');
    this.mobileDeviceId.set('');
    this.desktopDeviceId.set('');
    this.apiUrl.set('');
    this.desktopFieldInfo.set(null);
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  formatDeviceId(id: string): string {
    if (!id) return '---';
    // Show first 8 and last 4 characters
    if (id.length > 16) {
      return `${id.slice(0, 8)}...${id.slice(-4)}`;
    }
    return id;
  }
}

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

interface DesktopFieldInfo {
  label?: string;
  accept?: string;
  type?: 'image' | 'file';
  entityType?: string;
  entityId?: any;
  isMultiple?: boolean;
  limit?: number;
  isCompressed?: boolean;
}
