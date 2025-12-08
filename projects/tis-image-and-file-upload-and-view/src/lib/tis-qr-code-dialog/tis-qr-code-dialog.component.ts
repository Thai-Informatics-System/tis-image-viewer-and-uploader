import { Component, Inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, Subscription, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TisRemoteUploadService } from '../services/tis-remote-upload.service';
import { TisPairingSession, TisRemoteUploadEvent } from '../interfaces/socket-adapter.interface';

export interface TisQrCodeDialogData {
  title?: string;
  subtitle?: string;
  qrSize?: number;
  showCountdown?: boolean;
  autoCloseOnUpload?: boolean;
}

@Component({
  selector: 'tis-qr-code-dialog',
  standalone: false,
  templateUrl: './tis-qr-code-dialog.component.html',
  styleUrls: ['./tis-qr-code-dialog.component.css']
})
export class TisQrCodeDialogComponent implements OnInit, OnDestroy {
  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef<HTMLCanvasElement>;

  qrData: string = '';
  pairingCode: string = '';
  expiresAt: number = 0;
  remainingTime: string = '';
  
  isLoading = true;
  isExpired = false;
  isConnected = false;
  errorMessage: string | null = null;

  connectionStatus: 'disconnected' | 'pending' | 'connected' = 'disconnected';
  uploadedFiles: TisRemoteUploadEvent[] = [];

  private destroy$ = new Subject<void>();
  private countdownSubscription: Subscription | null = null;

  constructor(
    public dialogRef: MatDialogRef<TisQrCodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TisQrCodeDialogData,
    private remoteUploadService: TisRemoteUploadService
  ) {}

  ngOnInit(): void {
    this.generateQrCode();
    this.subscribeToEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
  }

  private async generateQrCode(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      const result = await this.remoteUploadService.generatePairingCode();
      this.qrData = result.qrData;
      this.pairingCode = result.pairingCode;
      this.expiresAt = result.expiresAt;

      this.isLoading = false;
      this.startCountdown();

      // Generate QR code after view is ready
      setTimeout(() => this.renderQrCode(), 100);
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

  private renderQrCode(): void {
    if (!this.qrCanvas || !this.qrData) return;

    const canvas = this.qrCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = this.data.qrSize || 200;
    canvas.width = size;
    canvas.height = size;

    // Use a QR code generation library or simple placeholder
    // For now, we'll create a simple visual that can be replaced with actual QR library
    this.generateQrCodeOnCanvas(ctx, this.qrData, size);
  }

  /**
   * Simple QR code generator using canvas
   * In production, you'd use a library like qrcode or qrcode-generator
   */
  private generateQrCodeOnCanvas(ctx: CanvasRenderingContext2D, data: string, size: number): void {
    // This is a simplified QR-like pattern generator
    // Replace with actual QR code library for production
    
    const moduleCount = 25; // Standard QR code size
    const moduleSize = size / moduleCount;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Generate pattern based on data hash
    const pattern = this.generatePattern(data, moduleCount);

    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (pattern[row][col]) {
          ctx.fillRect(
            col * moduleSize,
            row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }

    // Draw finder patterns (corners)
    this.drawFinderPattern(ctx, 0, 0, moduleSize);
    this.drawFinderPattern(ctx, (moduleCount - 7) * moduleSize, 0, moduleSize);
    this.drawFinderPattern(ctx, 0, (moduleCount - 7) * moduleSize, moduleSize);
  }

  private generatePattern(data: string, size: number): boolean[][] {
    const pattern: boolean[][] = [];
    
    // Simple hash-based pattern generation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash;
    }

    const seed = Math.abs(hash);
    let current = seed;

    for (let row = 0; row < size; row++) {
      pattern[row] = [];
      for (let col = 0; col < size; col++) {
        // Skip finder pattern areas
        if (
          (row < 8 && col < 8) ||
          (row < 8 && col >= size - 8) ||
          (row >= size - 8 && col < 8)
        ) {
          pattern[row][col] = false;
        } else {
          current = (current * 1103515245 + 12345) & 0x7fffffff;
          pattern[row][col] = (current % 2) === 0;
        }
      }
    }

    return pattern;
  }

  private drawFinderPattern(ctx: CanvasRenderingContext2D, x: number, y: number, moduleSize: number): void {
    const s = moduleSize;

    // Outer black square (7x7)
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, 7 * s, 7 * s);

    // White square (5x5)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + s, y + s, 5 * s, 5 * s);

    // Inner black square (3x3)
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
  }

  refreshQrCode(): void {
    this.isExpired = false;
    this.uploadedFiles = [];
    this.generateQrCode();
  }

  disconnect(): void {
    this.remoteUploadService.disconnect();
    this.dialogRef.close({ disconnected: true });
  }

  close(): void {
    this.dialogRef.close({ 
      uploaded: this.uploadedFiles.length > 0, 
      files: this.uploadedFiles 
    });
  }

  copyPairingCode(): void {
    if (navigator.clipboard && this.pairingCode) {
      navigator.clipboard.writeText(this.pairingCode);
    }
  }
}
