import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, Subscription, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TisRemoteUploadService } from '../services/tis-remote-upload.service';
import { TisPairingSession, TisRemoteUploadEvent } from '../interfaces/socket-adapter.interface';

export interface FieldInfo {
  label?: string;
  accept?: string;
  type?: 'image' | 'file';
  entityType?: string;
  entityId?: any;
  isMultiple?: boolean;
  limit?: number;
  isCompressed?: boolean;
}

export interface TisQrCodeDialogData {
  title?: string;
  subtitle?: string;
  qrSize?: number;
  showCountdown?: boolean;
  autoCloseOnUpload?: boolean;
  fieldInfo?: FieldInfo;
}

@Component({
  selector: 'tis-qr-code-dialog',
  standalone: false,
  templateUrl: './tis-qr-code-dialog.component.html',
  styleUrls: ['./tis-qr-code-dialog.component.css']
})
export class TisQrCodeDialogComponent implements OnInit, OnDestroy {
  qrData: string = '';
  expiresAt: number = 0;
  remainingTime: string = '';
  
  isLoading = true;
  isExpired = false;
  isConnected = false;
  errorMessage: string | null = null;

  connectionStatus: 'disconnected' | 'pending' | 'connected' = 'disconnected';
  uploadedFiles: TisRemoteUploadEvent[] = [];

  // Device IDs
  desktopDeviceId: string = '';
  mobileDeviceId: string | null = null;

  private destroy$ = new Subject<void>();
  private countdownSubscription: Subscription | null = null;

  constructor(
    public dialogRef: MatDialogRef<TisQrCodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TisQrCodeDialogData,
    private remoteUploadService: TisRemoteUploadService
  ) {}

  ngOnInit(): void {
    // Get desktop device ID
    this.desktopDeviceId = this.remoteUploadService.getDesktopDeviceId();
    
    // Subscribe to events first
    this.subscribeToEvents();
    
    // Check if already connected to mobile
    this.checkExistingConnection();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
  }

  /**
   * Check if there's an existing mobile connection
   */
  private checkExistingConnection(): void {
    this.mobileDeviceId = this.remoteUploadService.getMobileDeviceId();
    
    if (this.remoteUploadService.isConnectedToMobile()) {
      this.isConnected = true;
      this.connectionStatus = 'connected';
      this.isLoading = false;
    } else {
      // No existing connection, generate QR code
      this.generateQrCode();
    }
  }

  private async generateQrCode(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.isExpired = false;

    try {
      const result = await this.remoteUploadService.generateQrCode();
      this.qrData = result.qrData;
      this.expiresAt = result.expiresAt;

      this.isLoading = false;
      this.startCountdown();
    } catch (error: any) {
      this.isLoading = false;
      this.errorMessage = error.message || 'Failed to generate QR code';
    }
  }

  private subscribeToEvents(): void {
    // Connection status
    this.remoteUploadService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.connectionStatus = status;
        this.isConnected = status === 'connected';
      });

    // Mobile connection changes
    this.remoteUploadService.getMobileConnection()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connection => {
        this.mobileDeviceId = connection?.mobileDeviceId || null;
      });

    // Remote uploads
    this.remoteUploadService.getRemoteUploads()
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.uploadedFiles.push(event);
        
        if (this.data.autoCloseOnUpload) {
          this.dialogRef.close({ uploaded: true, files: this.uploadedFiles });
        }
      });

    // Errors
    this.remoteUploadService.getErrors()
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        console.error('[TisQrCodeDialog] Error:', error);
      });
  }

  private startCountdown(): void {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }

    this.countdownSubscription = interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const now = Date.now();
        const remaining = Math.max(0, this.expiresAt - now);

        if (remaining <= 0) {
          this.isExpired = true;
          this.remainingTime = 'Expired';
          this.countdownSubscription?.unsubscribe();
        } else {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          this.remainingTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  /**
   * Format device ID for display
   */
  formatDeviceId(id: string | null): string {
    if (!id) return '---';
    if (id.length > 16) {
      return `${id.slice(0, 8)}...${id.slice(-4)}`;
    }
    return id;
  }

  /**
   * Refresh QR code
   */
  refreshQrCode(): void {
    this.isExpired = false;
    this.uploadedFiles = [];
    this.generateQrCode();
  }

  /**
   * Connect to mobile (show QR if disconnected)
   */
  connectToMobile(): void {
    this.generateQrCode();
  }

  /**
   * Disconnect from mobile
   */
  disconnect(): void {
    this.remoteUploadService.disconnect();
    this.mobileDeviceId = null;
    this.isConnected = false;
    this.connectionStatus = 'disconnected';
  }

  /**
   * Close dialog
   */
  close(): void {
    this.dialogRef.close({ 
      uploaded: this.uploadedFiles.length > 0, 
      files: this.uploadedFiles 
    });
  }
}
