import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TisRemoteUploadService, DevicesOnlineStatus } from '../services/tis-remote-upload.service';
import { Subject, takeUntil } from 'rxjs';

// MobileConnectionInfo is internal to the service, so we use any for now
// or we could export it from the service
interface MobileConnectionInfo {
  mobileDeviceId: string;
  connectedAt: number;
  lastActivity: number;
}

export interface TisViewConnectionDialogData {
  title?: string;
}

@Component({
  selector: 'tis-view-connection-dialog',
  standalone: false,
  templateUrl: './tis-view-connection-dialog.component.html',
  styleUrl: './tis-view-connection-dialog.component.css'
})
export class TisViewConnectionDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  mobileConnection: MobileConnectionInfo | null = null;
  devicesStatus: DevicesOnlineStatus | null = null;
  isCheckingStatus = false;
  disconnecting = false;

  constructor(
    public dialogRef: MatDialogRef<TisViewConnectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TisViewConnectionDialogData,
    private remoteUploadService: TisRemoteUploadService
  ) {}

  ngOnInit(): void {
    // Subscribe to mobile connection info
    this.remoteUploadService.getMobileConnection()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connection => {
        this.mobileConnection = connection;
        
        // If connection is lost, close dialog
        if (!connection) {
          this.dialogRef.close('disconnected');
        }
      });

    // Subscribe to devices status
    this.remoteUploadService.getDevicesStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.devicesStatus = status;
      });

    // Subscribe to checking status
    this.remoteUploadService.getIsCheckingStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(checking => {
        this.isCheckingStatus = checking;
      });

    // Refresh status on open
    this.refreshStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Refresh device online status
   */
  async refreshStatus(): Promise<void> {
    await this.remoteUploadService.refreshDevicesStatus();
  }

  /**
   * Disconnect from mobile device
   */
  async disconnect(): Promise<void> {
    this.disconnecting = true;
    try {
      await this.remoteUploadService.disconnect();
      this.dialogRef.close('disconnected');
    } catch (error) {
      console.error('Disconnect failed:', error);
      this.disconnecting = false;
    }
  }

  /**
   * Close dialog without disconnecting
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Get formatted connection time
   */
  getConnectionDuration(): string {
    if (!this.mobileConnection?.connectedAt) {
      return 'Unknown';
    }

    const duration = Date.now() - this.mobileConnection.connectedAt;
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Just now';
    }
  }

  /**
   * Get last ping time formatted
   */
  getLastPing(timestamp: number | undefined): string {
    if (!timestamp) {
      return 'Never';
    }

    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    
    if (secondsAgo < 10) {
      return 'Just now';
    } else if (secondsAgo < 60) {
      return `${secondsAgo}s ago`;
    } else {
      const minutesAgo = Math.floor(secondsAgo / 60);
      return `${minutesAgo}m ago`;
    }
  }
}
