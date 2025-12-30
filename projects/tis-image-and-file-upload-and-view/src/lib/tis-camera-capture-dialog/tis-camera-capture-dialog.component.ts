import { Component, Inject, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface CameraCaptureDialogData {
  stream: MediaStream;
  videoDevices?: MediaDeviceInfo[];
  isMobile: boolean;
}

export interface CameraCaptureResult {
  action: 'capture' | 'upload' | 'cancel';
  file?: File;
}

@Component({
  selector: 'tis-camera-capture-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './tis-camera-capture-dialog.component.html',
  styleUrls: ['./tis-camera-capture-dialog.component.css']
})
export class TisCameraCaptureDialogComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;

  currentStream: MediaStream;
  currentDeviceIndex = 0;
  isCapturing = signal(false);
  isSwitching = signal(false);
  showFlash = signal(false);
  hasMultipleCameras = false;

  constructor(
    public dialogRef: MatDialogRef<TisCameraCaptureDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CameraCaptureDialogData
  ) {
    this.currentStream = data.stream;
    this.hasMultipleCameras = (data.videoDevices?.length ?? 0) > 1;
  }

  ngOnInit(): void {
    // Wait for view to initialize before setting video source
    setTimeout(() => {
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.currentStream;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopStream();
  }

  async switchCamera(): Promise<void> {
    if (!this.data.videoDevices || this.data.videoDevices.length <= 1) {
      return;
    }

    this.isSwitching.set(true);

    try {
      // Stop current stream
      this.stopStream();

      // Move to next camera
      this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.data.videoDevices.length;

      // Get new stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: this.data.videoDevices[this.currentDeviceIndex].deviceId,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      this.currentStream = newStream;
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = newStream;
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      // Could emit an error event here if needed
    } finally {
      // Add a small delay to show the switching state
      setTimeout(() => {
        this.isSwitching.set(false);
      }, 500);
    }
  }

  async capturePhoto(): Promise<void> {
    this.isCapturing.set(true);
    this.showFlash.set(true);

    // Wait for flash animation
    setTimeout(async () => {
      this.showFlash.set(false);

      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        this.isCapturing.set(false);
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0);

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });

            const result: CameraCaptureResult = {
              action: 'capture',
              file
            };

            this.dialogRef.close(result);
          }
          this.isCapturing.set(false);
        },
        'image/jpeg',
        0.9
      );
    }, 300);
  }

  openUpload(): void {
    const result: CameraCaptureResult = {
      action: 'upload'
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    const result: CameraCaptureResult = {
      action: 'cancel'
    };
    this.dialogRef.close(result);
  }

  private stopStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
    }
  }
}
