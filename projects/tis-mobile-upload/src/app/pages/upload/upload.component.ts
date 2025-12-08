import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { MobileUploadService, UploadedFile, PairingInfo } from '../../services/mobile-upload.service';

interface FileUploadState {
  file: File;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  result?: UploadedFile;
  error?: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  private destroy$ = new Subject<void>();

  // State
  isValidating = true;
  isValid = false;
  errorMessage: string | null = null;
  pairingInfo: PairingInfo | null = null;

  // Upload state
  uploadQueue: FileUploadState[] = [];
  isUploading = false;
  totalUploaded = 0;

  // Params from QR code
  pairingCode: string | null = null;
  desktopDeviceId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private uploadService: MobileUploadService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Get params from URL (from QR code)
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.pairingCode = params['code'];
        this.desktopDeviceId = params['deviceId'];

        if (this.pairingCode) {
          this.validatePairing();
        } else {
          // Try to load stored pairing
          const stored = this.uploadService.loadStoredPairing();
          if (stored) {
            this.isValidating = false;
            this.isValid = true;
            this.pairingInfo = stored;
          } else {
            this.isValidating = false;
            this.errorMessage = 'No pairing code provided. Please scan the QR code again.';
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Cleanup previews
    this.uploadQueue.forEach(item => {
      if (item.preview) {
        URL.revokeObjectURL(item.preview);
      }
    });
  }

  validatePairing(): void {
    if (!this.pairingCode) return;

    this.isValidating = true;
    this.errorMessage = null;

    this.uploadService.validatePairingCode(this.pairingCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (info) => {
          this.isValidating = false;
          if (info.valid) {
            this.isValid = true;
            this.pairingInfo = info;
          } else {
            this.errorMessage = 'Invalid or expired pairing code. Please try again.';
          }
        },
        error: (err) => {
          this.isValidating = false;
          this.errorMessage = err.message || 'Failed to validate pairing code.';
        }
      });
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  openCamera(): void {
    this.cameraInput?.nativeElement?.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (files && files.length > 0) {
      this.addFilesToQueue(Array.from(files));
    }

    // Reset input
    input.value = '';
  }

  private addFilesToQueue(files: File[]): void {
    const maxFiles = this.pairingInfo?.maxFiles || 10;
    const remaining = maxFiles - this.uploadQueue.length;

    if (remaining <= 0) {
      this.snackBar.open(`Maximum ${maxFiles} files allowed`, 'OK', { duration: 3000 });
      return;
    }

    const filesToAdd = files.slice(0, remaining);

    filesToAdd.forEach(file => {
      const state: FileUploadState = {
        file,
        progress: 0,
        status: 'pending'
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        state.preview = URL.createObjectURL(file);
      }

      this.uploadQueue.push(state);
    });

    // Auto-start upload
    if (!this.isUploading) {
      this.processUploadQueue();
    }
  }

  removeFile(index: number): void {
    const item = this.uploadQueue[index];
    
    if (item.status === 'uploading') {
      return; // Can't remove while uploading
    }

    if (item.preview) {
      URL.revokeObjectURL(item.preview);
    }

    this.uploadQueue.splice(index, 1);
  }

  retryUpload(index: number): void {
    const item = this.uploadQueue[index];
    item.status = 'pending';
    item.progress = 0;
    item.error = undefined;

    if (!this.isUploading) {
      this.processUploadQueue();
    }
  }

  private async processUploadQueue(): Promise<void> {
    this.isUploading = true;

    for (const item of this.uploadQueue) {
      if (item.status !== 'pending') continue;

      item.status = 'uploading';

      try {
        const result = await this.uploadService.uploadFile(
          item.file,
          (progress) => {
            item.progress = progress;
          }
        );

        item.status = 'complete';
        item.result = result;
        this.totalUploaded++;

        this.snackBar.open(`Uploaded: ${item.file.name}`, 'OK', { duration: 2000 });
      } catch (error: any) {
        item.status = 'error';
        item.error = error.message || 'Upload failed';
        console.error('[Upload] Error:', error);
      }
    }

    this.isUploading = false;

    // Check if all done
    const allComplete = this.uploadQueue.every(i => i.status === 'complete');
    if (allComplete && this.uploadQueue.length > 0) {
      this.showSuccessMessage();
    }
  }

  private showSuccessMessage(): void {
    this.snackBar.open(
      `Successfully uploaded ${this.totalUploaded} file(s) to desktop`,
      'Done',
      { duration: 5000 }
    );
  }

  getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'videocam';
    if (file.type === 'application/pdf') return 'picture_as_pdf';
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'table_chart';
    if (file.type.includes('document') || file.type.includes('word')) return 'description';
    return 'insert_drive_file';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  get pendingCount(): number {
    return this.uploadQueue.filter(i => i.status === 'pending').length;
  }

  get completedCount(): number {
    return this.uploadQueue.filter(i => i.status === 'complete').length;
  }

  get errorCount(): number {
    return this.uploadQueue.filter(i => i.status === 'error').length;
  }

  disconnect(): void {
    this.uploadService.disconnect();
    this.isValid = false;
    this.pairingInfo = null;
    this.uploadQueue = [];
    this.totalUploaded = 0;
  }
}
