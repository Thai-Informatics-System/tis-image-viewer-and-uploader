import { Component, OnInit, OnDestroy, signal, computed, inject, effect, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { NgxScannerQrcodeComponent, ScannerQRCodeResult } from 'ngx-scanner-qrcode';

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
    MatProgressBarModule,
    MatSnackBarModule,
    NgxScannerQrcodeComponent
  ],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('scanner') scanner!: NgxScannerQrcodeComponent;

  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly socketService = inject(MobileSocketService);
  private readonly uploadService = inject(MobileUploadService);
  private readonly snackBar = inject(MatSnackBar);

  private destroy$ = new Subject<void>();
  private scannerStartPending = false;

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
  
  // API URL from QR params
  readonly apiUrl = signal<string>('');
  
  // Desktop info received via socket (field configuration)
  readonly desktopFieldInfo = signal<DesktopFieldInfo | null>(null);
  
  // Computed states
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');
  readonly isReady = computed(() => this.isConnected() && !this.isInitializing() && !!this.apiUrl());

  // Upload tracking
  readonly totalUploaded = this.uploadService.totalUploaded;
  readonly hasUploads = this.uploadService.hasUploads;
  
  // Upload progress
  readonly isUploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadedFiles = signal<UploadedFile[]>([]);

  // QR scanning state
  readonly isScanning = signal(false);
  readonly scanError = signal<string | null>(null);

  // File type config
  readonly acceptTypes = computed(() => {
    const fieldInfo = this.desktopFieldInfo();
    return fieldInfo?.accept || 'image/*,.pdf';
  });

  readonly uploadType = computed<'image' | 'file'>(() => {
    const fieldInfo = this.desktopFieldInfo();
    return fieldInfo?.type || 'image';
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
    // Stop scanner if running
    if (this.scanner) {
      this.scanner.stop();
    }
  }

  ngAfterViewChecked(): void {
    // Start scanner after view is ready
    if (this.scannerStartPending && this.scanner) {
      this.scannerStartPending = false;
      // Give the scanner a moment to initialize
      setTimeout(() => {
        if (this.scanner && this.isScanning()) {
          console.log('[QR Scanner] Starting scanner...');
          this.scanner.start().subscribe({
            next: (result) => {
              console.log('[QR Scanner] Scanner started:', result);
            },
            error: (error) => {
              console.error('[QR Scanner] Failed to start:', error);
              this.scanError.set('Failed to access camera. Please check permissions.');
            }
          });
        }
      }, 100);
    }
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
  // File Upload
  // -------------------------------------------------------------------------

  openFileSelector(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    
    for (const file of files) {
      await this.uploadFile(file);
    }

    // Clear input for next selection
    input.value = '';
  }

  private async uploadFile(file: File): Promise<void> {
    if (!this.apiUrl()) {
      this.snackBar.open('Not connected to server', '', { duration: 2000 });
      return;
    }

    this.isUploading.set(true);
    this.uploadProgress.set(0);

    try {
      // Step 1: Get presigned upload URL
      const uploadUrlResponse = await firstValueFrom(
        this.http.post<GetUploadUrlResponse>(`${this.apiUrl()}/file-upload/getUploadUrl`, {
          fileName: file.name,
          contentType: file.type
        })
      );

      if (!uploadUrlResponse?.uploadUrl || !uploadUrlResponse?.s3Url) {
        throw new Error('Failed to get upload URL');
      }

      // Step 2: Upload to S3
      await this.uploadToS3(uploadUrlResponse.uploadUrl, file);

      // Step 3: Create uploaded file record
      const uploadedFile: UploadedFile = {
        s3Url: uploadUrlResponse.s3Url,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadData: uploadUrlResponse.uploadData
      };

      // Add to local list
      this.uploadedFiles.update(files => [...files, uploadedFile]);

      // Step 4: Send to desktop via socket
      this.uploadService.sendToDesktop(uploadedFile);

      this.snackBar.open('File sent to desktop!', '', { duration: 2000 });

    } catch (error: any) {
      console.error('[UploadComponent] Upload failed:', error);
      this.snackBar.open('Upload failed. Please try again.', '', { duration: 3000 });
    } finally {
      this.isUploading.set(false);
      this.uploadProgress.set(0);
    }
  }

  private uploadToS3(uploadUrl: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type
        },
        reportProgress: true,
        observe: 'events'
      }).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = event.total 
              ? Math.round((event.loaded / event.total) * 100) 
              : 0;
            this.uploadProgress.set(progress);
          } else if (event.type === HttpEventType.Response) {
            resolve();
          }
        },
        error: (err) => reject(err)
      });
    });
  }

  removeFile(index: number): void {
    this.uploadedFiles.update(files => files.filter((_, i) => i !== index));
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async retryConnection(): Promise<void> {
    // Check if we have a stored session to retry
    if (!this.socketService.hasStoredSession()) {
      this.snackBar.open('No previous session found. Please scan a QR code.', '', { duration: 3000 });
      return;
    }

    this.isInitializing.set(true);
    this.initError.set(null);

    try {
      await this.socketService.retryFromStoredSession();
      
      this.mobileDeviceId.set(this.socketService.getMobileDeviceId());
      this.desktopDeviceId.set(this.socketService.getDesktopDeviceId());
      this.apiUrl.set(this.socketService.getApiUrl());
      this.isInitializing.set(false);
      this.snackBar.open('Reconnected to desktop!', '', { duration: 2000 });
    } catch (error: any) {
      console.error('[UploadComponent] Retry connection failed:', error);
      this.isInitializing.set(false);
      this.initError.set(error.message || 'Failed to reconnect. Please scan a new QR code.');
      this.snackBar.open('Reconnection failed', '', { duration: 2000 });
    }
  }

  disconnect(): void {
    this.socketService.disconnect();
    this.uploadService.clearUploads();
    this.connectionStatus.set('disconnected');
    this.mobileDeviceId.set('');
    this.desktopDeviceId.set('');
    this.apiUrl.set('');
    this.desktopFieldInfo.set(null);
    this.uploadedFiles.set([]);
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

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  // -------------------------------------------------------------------------
  // QR Scanning Methods
  // -------------------------------------------------------------------------

  startScanning(): void {
    this.scanError.set(null);
    this.isScanning.set(true);
    // Set pending flag - scanner will be started in ngAfterViewChecked
    // because the scanner component needs to be rendered first
    this.scannerStartPending = true;
  }

  stopScanning(): void {
    this.isScanning.set(false);
    this.scannerStartPending = false;
    if (this.scanner) {
      this.scanner.stop().subscribe();
    }
  }

  onScanSuccess(results: ScannerQRCodeResult[]): void {
    if (results && results.length > 0) {
      const result = results[0];
      const scannedValue = result.value;
      
      console.log('[QR Scanner] Scanned:', scannedValue);
      
      // Parse the QR code data
      const params = this.parseQrCodeData(scannedValue);
      
      if (params) {
        this.stopScanning();
        this.connectWithParams(params);
      } else {
        this.scanError.set('Invalid QR code. Please scan the QR code from the desktop app.');
      }
    }
  }

  onScanError(error: any): void {
    console.error('[QR Scanner] Error:', error);
    this.scanError.set('Camera access denied or not available. Please check permissions.');
    this.stopScanning();
  }

  /**
   * Parse QR code data - handles both URL format and direct JSON
   * Expected URL format: https://app.example.com/mobile-upload?data=BASE64_ENCODED_JSON
   * Where JSON contains: { token, deviceId, userId, apiUrl }
   */
  private parseQrCodeData(scannedValue: string): QrCodeParams | null {
    try {
      // Check if it's a URL
      if (scannedValue.startsWith('http://') || scannedValue.startsWith('https://')) {
        const url = new URL(scannedValue);
        
        // Try to get the 'data' param (base64 encoded JSON)
        const dataParam = url.searchParams.get('data');
        if (dataParam) {
          try {
            const decoded = atob(dataParam);
            const params = JSON.parse(decoded) as QrCodeParams;
            if (this.isValidQrParams(params)) {
              return params;
            }
          } catch (e) {
            console.warn('[QR Scanner] Failed to decode data param:', e);
          }
        }
        
        // Try to get individual params from URL
        const token = url.searchParams.get('token');
        const deviceId = url.searchParams.get('deviceId');
        const userId = url.searchParams.get('userId');
        const apiUrl = url.searchParams.get('apiUrl');
        
        if (token && deviceId && userId && apiUrl) {
          return { token, deviceId, userId, apiUrl: decodeURIComponent(apiUrl) };
        }
      }
      
      // Try to parse as direct JSON
      try {
        const params = JSON.parse(scannedValue) as QrCodeParams;
        if (this.isValidQrParams(params)) {
          return params;
        }
      } catch (e) {
        // Not JSON, continue
      }
      
      return null;
    } catch (e) {
      console.error('[QR Scanner] Parse error:', e);
      return null;
    }
  }

  private isValidQrParams(params: any): params is QrCodeParams {
    return params && 
           typeof params.token === 'string' && 
           typeof params.deviceId === 'string' && 
           typeof params.userId === 'string' && 
           typeof params.apiUrl === 'string';
  }

  private connectWithParams(params: QrCodeParams): void {
    console.log('[QR Scanner] Connecting with params:', { 
      deviceId: params.deviceId, 
      userId: params.userId,
      apiUrl: params.apiUrl 
    });
    
    this.snackBar.open('QR code scanned successfully! Connecting...', 'OK', { duration: 2000 });
    
    // Store API URL
    this.apiUrl.set(params.apiUrl);
    this.desktopDeviceId.set(params.deviceId);
    
    // Connect via socket service - use the initialize method
    this.socketService.initialize(params).catch((error) => {
      console.error('[QR Scanner] Connection failed:', error);
      this.snackBar.open('Connection failed. Please try again.', 'OK', { duration: 3000 });
    });
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

interface GetUploadUrlResponse {
  uploadUrl: string;
  s3Url: string;
  uploadData?: any;
}

interface UploadedFile {
  s3Url: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadData?: any;
}
