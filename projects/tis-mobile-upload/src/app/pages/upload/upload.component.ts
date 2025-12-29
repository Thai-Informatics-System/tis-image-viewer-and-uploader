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

import { MobileSocketService, QrCodeParams, ConnectionStatus, DesktopMessage, DevicesOnlineStatus } from '../../services/mobile-socket.service';
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
  
  // Upload URLs fetched from backend
  readonly uploadUrls = signal<UploadUrls | null>(null);
  
  // Desktop info received via socket (field configuration)
  readonly desktopFieldInfo = signal<DesktopFieldInfo | null>(null);
  
  // Computed states
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');
  readonly isReady = computed(() => this.isConnected() && !this.isInitializing() && !!this.apiUrl() && !!this.uploadUrls());

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
  
  // Available camera devices
  readonly availableCameras = signal<any[]>([]);
  readonly hasMultipleCameras = computed(() => this.availableCameras().length > 1);

  // Device online status
  readonly devicesStatus = signal<DevicesOnlineStatus | null>(null);
  readonly isCheckingStatus = signal(false);

  // Check if previous session exists
  readonly hasPreviousSession = computed(() => this.socketService.hasStoredSession());

  // Track if disconnect was intentional (user-initiated)
  readonly isIntentionalDisconnect = signal(false);

  // Track if disconnecting is in progress
  private isDisconnecting = false;

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
        // Ignore status updates if we're in the middle of disconnecting
        if (!this.isDisconnecting) {
          this.connectionStatus.set(status);
        }
      });

    // Subscribe to desktop messages
    this.socketService.desktopMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => this.handleDesktopMessage(message));

    // Subscribe to devices online status
    this.socketService.devicesStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.devicesStatus.set(status);
      });

    // Subscribe to checking status (for blinking indicator)
    this.socketService.isCheckingStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(checking => {
        this.isCheckingStatus.set(checking);
      });

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
          
          // Subscribe to available devices
          this.scanner.devices.subscribe({
            next: (devices) => {
              console.log('[QR Scanner] Available devices:', devices);
              this.availableCameras.set(devices);
            },
            error: (error) => {
              console.error('[QR Scanner] Failed to get devices:', error);
            }
          });
          
          // Start scanner with back camera preference
          this.startScannerWithBackCamera();
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
      console.log('[UploadComponent] Restoring from stored session...');
      try {
        this.isInitializing.set(true);
        this.initError.set(null);
        
        await this.socketService.retryFromStoredSession();
        await this.setConnectionState();
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
      await this.setConnectionState();
      this.snackBar.open('Connected to desktop!', '', { duration: 2000 });

    } catch (error: any) {
      console.error('[UploadComponent] Initialization failed:', error);
      this.isInitializing.set(false);
      this.initError.set(error.message || 'Failed to connect. Please scan a new QR code.');
    }
  }

  private async setConnectionState(): Promise<void> {
    this.mobileDeviceId.set(await this.socketService.getMobileDeviceId());
    this.desktopDeviceId.set(this.socketService.getDesktopDeviceId());
    this.apiUrl.set(this.socketService.getApiUrl());
    this.isInitializing.set(false);
  }

  // -------------------------------------------------------------------------
  // Desktop Message Handling
  // -------------------------------------------------------------------------

  private handleDesktopMessage(message: DesktopMessage): void {
    if (!message) return;

    console.log('[UploadComponent] Desktop message:', message);

    switch (message.type) {
      case 'mobile-link-established':
        // Mobile link established - connection is ready
        this.connectionStatus.set('connected');
        this.isInitializing.set(false);
        this.initError.set(null); // Clear any error state
        this.isIntentionalDisconnect.set(false); // Reset disconnect flag
        this.snackBar.open('Connected to desktop!', '', { duration: 2000 });
        // Fetch upload URLs from backend
        this.fetchUploadUrls();
        break;

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

      case 'field-request':
        // Desktop requests upload for a specific field - show upload UI
        const field = message['field'];
        if (field) {
          // Clear previously uploaded files for new field request
          this.uploadedFiles.set([]);
          
          this.desktopFieldInfo.set({
            label: field.label,
            accept: field.accept,
            type: field.type || 'image',
            entityType: field.entityType,
            entityId: field.entityId,
            isMultiple: field.isMultiple,
            limit: field.remainingSlots || field.limit,
            isCompressed: field.isCompressed
          });
          this.snackBar.open(`Upload requested: ${field.label}`, '', { duration: 3000 });
        }
        break;

      case 'field-request-cancel':
        // Desktop cancelled the field request
        this.desktopFieldInfo.set(null);
        this.snackBar.open('Upload request cancelled', '', { duration: 2000 });
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
  // Upload URLs
  // -------------------------------------------------------------------------

  /**
   * Fetch upload URLs from backend via socket API
   * Called after mobile-link-established
   */
  private async fetchUploadUrls(): Promise<void> {
    try {
      console.log('[UploadComponent] Fetching upload URLs from backend...');
      
      const response = await this.socketService.callApiViaSocketPromise('tis-image-mobile-uploader/get-upload-urls', {
        mobileDeviceId: this.mobileDeviceId(),
        desktopDeviceId: this.desktopDeviceId()
      });

      console.log('[UploadComponent] Upload URLs response:', response);

      // Response structure: { success: true, data: { filePresignedUrlGenerator: '/file/get-upload-url', imagePresignedUrlGenerator: '/image/get-upload-url' } }
      const data = response?.body?.data || response?.data || response;
      
      if (data?.filePresignedUrlGenerator && data?.imagePresignedUrlGenerator) {
        this.uploadUrls.set({
          filePresignedUrlGenerator: data.filePresignedUrlGenerator,
          imagePresignedUrlGenerator: data.imagePresignedUrlGenerator
        });
        console.log('[UploadComponent] Upload URLs configured:', this.uploadUrls());
      } else {
        console.warn('[UploadComponent] Invalid upload URLs response:', data);
        this.snackBar.open('Failed to get upload configuration', '', { duration: 3000 });
      }
    } catch (error: any) {
      console.error('[UploadComponent] Failed to fetch upload URLs:', error);
      this.snackBar.open('Failed to get upload configuration', '', { duration: 3000 });
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

    const fieldInfo = this.desktopFieldInfo();
    const currentCount = this.uploadedFiles().length;
    const limit = fieldInfo?.limit;

    let files = Array.from(input.files);
    
    // Validate file types against accept types
    const acceptTypes = this.acceptTypes();
    if (acceptTypes) {
      const invalidFiles = files.filter(file => !this.isFileTypeAccepted(file, acceptTypes));
      if (invalidFiles.length > 0) {
        this.snackBar.open(
          `Invalid file type(s). Accepted: ${acceptTypes}`, 
          '', 
          { duration: 4000 }
        );
        input.value = '';
        return;
      }
    }
    
    // Enforce limit if specified
    if (limit !== undefined && limit !== null) {
      const remaining = limit - currentCount;
      
      if (remaining <= 0) {
        this.snackBar.open(`Upload limit reached (${limit} file${limit !== 1 ? 's' : ''})`, '', { duration: 3000 });
        input.value = '';
        return;
      }
      
      if (files.length > remaining) {
        files = files.slice(0, remaining);
        this.snackBar.open(`Only ${remaining} more file${remaining !== 1 ? 's' : ''} allowed (limit: ${limit})`, '', { duration: 4000 });
      }
    }
    
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

    if (!this.uploadUrls()) {
      this.snackBar.open('Upload configuration not ready', '', { duration: 2000 });
      return;
    }

    this.isUploading.set(true);
    this.uploadProgress.set(0);

    try {
      // Determine which endpoint to use based on file type
      const isImage = this.isImageFile(file.type);
      const uploadType = this.uploadType();
      const urls = this.uploadUrls()!;
      
      // Use type from desktop field config if available, otherwise detect from file
      const endpoint = (uploadType === 'image' || isImage) 
        ? urls.imagePresignedUrlGenerator 
        : urls.filePresignedUrlGenerator;

      console.log('[UploadComponent] Using upload endpoint:', endpoint, 'for type:', uploadType, 'isImage:', isImage);

      // Get entityType from desktop field info
      const fieldInfo = this.desktopFieldInfo();
      const entityType = fieldInfo?.entityType;

      // Step 1: Get presigned upload URL
      const requestBody: any = {
        filename: file.name,
        mimeType: file.type
      };

      // Add entityType if available
      if (entityType) {
        requestBody.type = entityType;
      }

      console.log('[UploadComponent] Requesting presigned URL with:', requestBody);

      const uploadUrlResponse = await firstValueFrom(
        this.http.post<GetUploadUrlResponse>(`${this.apiUrl()}${endpoint}`, requestBody)
      );

      console.log('[UploadComponent] Upload URL response:', uploadUrlResponse);

      // Extract upload data from response
      const uploadData = uploadUrlResponse?.data?.uploadUrlData || uploadUrlResponse?.uploadUrlData;
      
      if (!uploadData?.uploadURL) {
        console.error('[UploadComponent] Invalid upload URL response:', uploadUrlResponse);
        throw new Error('Failed to get upload URL');
      }

      // Step 2: Upload to S3
      await this.uploadToS3(uploadData.uploadURL, file);

      // Step 3: Create uploaded file record
      const uploadedFile: UploadedFile = {
        s3Url: uploadData.resourceUrl,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadData: uploadData
      };

      // Add to local list
      this.uploadedFiles.update(files => [...files, uploadedFile]);

      // Step 4: Send to desktop via API
      console.log('[UploadComponent] 🔵 Calling sendToDesktop with:', uploadedFile);
      await this.uploadService.sendToDesktop(uploadedFile);
      console.log('[UploadComponent] ✅ sendToDesktop completed');

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
      await this.setConnectionState();
      this.snackBar.open('Reconnected to desktop!', '', { duration: 2000 });
    } catch (error: any) {
      console.error('[UploadComponent] Retry connection failed:', error);
      this.isInitializing.set(false);
      this.initError.set(error.message || 'Failed to reconnect. Please scan a new QR code.');
      this.snackBar.open('Reconnection failed', '', { duration: 2000 });
    }
  }

  async disconnect(): Promise<void> {
    // Set disconnecting flag to prevent race conditions
    this.isDisconnecting = true;
    
    // Mark as intentional disconnect
    this.isIntentionalDisconnect.set(true);
    
    // Set error state FIRST to trigger UI transition
    this.initError.set('Disconnected. Please scan the QR code from the desktop app to reconnect.');
    
    // Then update connection state
    this.connectionStatus.set('disconnected');
    
    // Clear all state
    this.mobileDeviceId.set('');
    this.desktopDeviceId.set('');
    this.apiUrl.set('');
    this.uploadUrls.set(null);
    this.desktopFieldInfo.set(null);
    this.uploadedFiles.set([]);
    this.devicesStatus.set(null);
    this.isCheckingStatus.set(false);
    this.isInitializing.set(false);
    
    // Now perform async disconnect operations
    try {
      await this.socketService.disconnect();
    } catch (error) {
      console.error('[UploadComponent] Disconnect error:', error);
    }
    
    // Clear upload service
    this.uploadService.clearUploads();
    
    // Show disconnect notification
    this.snackBar.open('Disconnected from desktop', '', { duration: 3000 });
    
    console.log('[UploadComponent] Disconnected and reset all state');
    
    // Reset disconnecting flag after a short delay
    setTimeout(() => {
      this.isDisconnecting = false;
    }, 500);
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

  /**
   * Validate if file type is accepted based on accept string
   * Supports MIME types, wildcards (image/*, video/*), and extensions (.pdf, .jpg)
   */
  isFileTypeAccepted(file: File, acceptString: string): boolean {
    if (!acceptString) return true;

    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    const acceptTypes = acceptString.toLowerCase().split(',').map(t => t.trim());

    return acceptTypes.some(acceptType => {
      // Handle wildcard MIME types (e.g., image/*, video/*)
      if (acceptType.includes('/*')) {
        const [category] = acceptType.split('/');
        return mimeType.startsWith(category + '/');
      }
      
      // Handle specific MIME types (e.g., image/jpeg, application/pdf)
      if (acceptType.includes('/')) {
        return mimeType === acceptType;
      }
      
      // Handle file extensions (e.g., .pdf, .jpg)
      if (acceptType.startsWith('.')) {
        return fileName.endsWith(acceptType);
      }
      
      return false;
    });
  }

  /**
   * Get mobile online status indicator class
   */
  getMobileStatusClass(): string {
    if (this.isCheckingStatus() && !this.devicesStatus()) {
      return 'checking';
    }
    return this.devicesStatus()?.mobile?.isOnline ? 'online' : 'offline';
  }

  /**
   * Get desktop online status indicator class
   */
  getDesktopStatusClass(): string {
    if (this.isCheckingStatus() && !this.devicesStatus()) {
      return 'checking';
    }
    return this.devicesStatus()?.desktop?.isOnline ? 'online' : 'offline';
  }

  /**
   * Check if ready for transfer (both devices online)
   */
  isReadyForTransfer(): boolean {
    return this.devicesStatus()?.isReadyForTransfer ?? false;
  }

  /**
   * Refresh device status
   */
  refreshStatus(): void {
    this.socketService.refreshDevicesStatus();
  }

  // -------------------------------------------------------------------------
  // QR Scanning Methods
  // -------------------------------------------------------------------------

  startScanning(): void {
    this.scanError.set(null);
    this.isScanning.set(true);
    // Reset intentional disconnect flag when user initiates new connection
    this.isIntentionalDisconnect.set(false);
    // Reset available cameras
    this.availableCameras.set([]);
    // Set pending flag - scanner will be started in ngAfterViewChecked
    // because the scanner component needs to be rendered first
    this.scannerStartPending = true;
  }

  stopScanning(): void {
    this.isScanning.set(false);
    this.scannerStartPending = false;
    this.availableCameras.set([]);
    if (this.scanner) {
      this.scanner.stop().subscribe();
    }
  }

  /**
   * Start scanner with preference for back/rear camera
   */
  private startScannerWithBackCamera(): void {
    this.scanner.start().subscribe({
      next: (result) => {
        console.log('[QR Scanner] Scanner started:', result);
        
        // Try to switch to back camera if available
        const devices = this.scanner.devices.value;
        const backCamera = devices.find(device => 
          /back|rear|environment/gi.test(device.label)
        );
        
        if (backCamera) {
          console.log('[QR Scanner] Switching to back camera:', backCamera.label);
          this.switchCamera(backCamera.deviceId);
        }
      },
      error: (error) => {
        console.error('[QR Scanner] Failed to start:', error);
        this.scanError.set('Failed to access camera. Please check permissions.');
      }
    });
  }

  /**
   * Switch to a different camera device
   */
  switchCamera(deviceId?: string): void {
    if (!this.scanner || !this.isScanning()) {
      return;
    }

    let targetDeviceId: string;

    // If no deviceId provided, switch to next available camera
    if (!deviceId) {
      const devices = this.availableCameras();
      if (devices.length <= 1) {
        return; // No other camera to switch to
      }

      const currentIndex = this.scanner.deviceIndexActive;
      const nextIndex = (currentIndex + 1) % devices.length;
      targetDeviceId = devices[nextIndex].deviceId;
      
      console.log('[QR Scanner] Switching from device', currentIndex, 'to', nextIndex);
    } else {
      targetDeviceId = deviceId;
    }

    this.scanner.playDevice(targetDeviceId).subscribe({
      next: () => {
        console.log('[QR Scanner] Switched to camera:', targetDeviceId);
        const device = this.availableCameras().find(d => d.deviceId === targetDeviceId);
        if (device) {
          this.snackBar.open(`Switched to ${device.label}`, '', { duration: 2000 });
        }
      },
      error: (error) => {
        console.error('[QR Scanner] Failed to switch camera:', error);
        this.scanError.set('Failed to switch camera. Please try again.');
      }
    });
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

  private async connectWithParams(params: QrCodeParams): Promise<void> {
    console.log('[QR Scanner] Connecting with params:', { 
      deviceId: params.deviceId, 
      userId: params.userId,
      apiUrl: params.apiUrl 
    });
    
    // Close scanner
    this.stopScanning();
    
    // Show connecting state
    this.snackBar.open('QR code scanned successfully! Connecting...', 'OK', { duration: 2000 });
    
    // Use the same initialization logic as manual connection
    await this.initializeConnection(params);
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

interface UploadUrls {
  filePresignedUrlGenerator: string;
  imagePresignedUrlGenerator: string;
}

interface GetUploadUrlResponse {
  data?: {
    uploadUrlData?: {
      uploadURL: string;
      resourceUrl: string;
      photoFilename: string;
      fileName: string;
      uploadPath: string;
      headers?: any;
      isBase64Encoded?: boolean;
    };
  };
  uploadUrlData?: {
    uploadURL: string;
    resourceUrl: string;
    photoFilename: string;
    fileName: string;
    uploadPath: string;
    headers?: any;
    isBase64Encoded?: boolean;
  };
  message?: string;
}

interface UploadedFile {
  s3Url: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadData?: any;
}
