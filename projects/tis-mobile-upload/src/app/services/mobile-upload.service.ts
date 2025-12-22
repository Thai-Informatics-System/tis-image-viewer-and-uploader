import { Injectable, inject, signal, computed } from '@angular/core';
import { MobileSocketService } from './mobile-socket.service';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Structure of uploaded file data from the library
 */
export interface UploadedFileData {
  s3Url: string;
  tempId?: string;
  title?: string;
  name?: string;
  filename?: string;
  s3Path?: string;
  id?: any;
  uploadData?: {
    uploadURL?: string;
    photoFilename?: string;
    fileName?: string;
    uploadPath?: string;
    resourceUrl?: string;
  };
  tags?: any;
  sequence?: number;
}

/**
 * Message sent to desktop when file is uploaded
 */
export interface FileUploadedMessage {
  type: 'file-uploaded';
  files: UploadedFileData[];
  totalCount: number;
  uploadedAt: number;
  mobileDeviceId: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Simplified Mobile Upload Service
 * 
 * This service only handles sending uploaded file data to the desktop.
 * The actual upload is handled by the TisImageAndFileUploadAndView library component.
 * 
 * Flow:
 * 1. Mobile uses <tis-image-and-file-upload-and-view> component for upload
 * 2. Library handles presigned URL generation and S3 upload
 * 3. When library emits (onUploaded), this service sends the data to desktop
 */
@Injectable({
  providedIn: 'root'
})
export class MobileUploadService {
  private readonly socketService = inject(MobileSocketService);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  private readonly _uploadedFiles = signal<UploadedFileData[]>([]);
  private readonly _lastSentAt = signal<number | null>(null);
  private readonly _sendError = signal<string | null>(null);

  // ---------------------------------------------------------------------------
  // Public Signals (readonly)
  // ---------------------------------------------------------------------------

  readonly uploadedFiles = this._uploadedFiles.asReadonly();
  readonly lastSentAt = this._lastSentAt.asReadonly();
  readonly sendError = this._sendError.asReadonly();
  
  readonly totalUploaded = computed(() => this._uploadedFiles().length);
  readonly hasUploads = computed(() => this._uploadedFiles().length > 0);

  // ---------------------------------------------------------------------------
  // Send to Desktop
  // ---------------------------------------------------------------------------

  /**
   * Send uploaded file data to desktop via API
   * Called when the library's onUploaded event fires
   * 
   * @param uploadedData - The data from library's onUploaded event
   */
  async sendToDesktop(uploadedData: any): Promise<void> {
    try {
      // Normalize the data (library can emit single file or array)
      const files = this.normalizeUploadedData(uploadedData);
      
      if (files.length === 0) {
        console.warn('[MobileUploadService] No files to send');
        return;
      }

      // Store locally
      this._uploadedFiles.update(current => [...current, ...files]);

      // Send to desktop via API call
      await this.socketService.callApiViaSocketPromise('tis-image-mobile-uploader/file-uploaded', {
        mobileDeviceId: this.socketService.getMobileDeviceId(),
        desktopDeviceId: this.socketService.getDesktopDeviceId(),
        channel: this.socketService.getChannelName(),
        files,
        totalCount: files.length,
        uploadedAt: Date.now()
      });

      this._lastSentAt.set(Date.now());
      this._sendError.set(null);

      console.log('[MobileUploadService] Sent to desktop:', files);

    } catch (error: any) {
      console.error('[MobileUploadService] Failed to send to desktop:', error);
      this._sendError.set(error.message || 'Failed to send to desktop');
    }
  }

  /**
   * Normalize uploaded data from library
   * The library can emit data in different formats
   */
  private normalizeUploadedData(data: any): UploadedFileData[] {
    if (!data) return [];

    // If it's already an array
    if (Array.isArray(data)) {
      return data.map(item => this.extractFileData(item)).filter(Boolean) as UploadedFileData[];
    }

    // Single file object
    const fileData = this.extractFileData(data);
    return fileData ? [fileData] : [];
  }

  /**
   * Extract relevant file data from various formats
   */
  private extractFileData(item: any): UploadedFileData | null {
    if (!item) return null;

    // Handle different response structures
    return {
      s3Url: item.s3Url || item.tempS3Url || item.uploadData?.resourceUrl || item.resourceUrl || item.url,
      tempId: item.tempId,
      title: item.title || item.name || item.filename,
      name: item.name || item.title,
      filename: item.filename || item.name,
      s3Path: item.s3Path || item.uploadData?.uploadPath,
      id: item.id,
      uploadData: item.uploadData ? {
        uploadURL: item.uploadData.uploadURL,
        photoFilename: item.uploadData.photoFilename,
        fileName: item.uploadData.fileName,
        uploadPath: item.uploadData.uploadPath,
        resourceUrl: item.uploadData.resourceUrl
      } : undefined,
      tags: item.tags,
      sequence: item.sequence
    };
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Clear all uploaded files from local state
   */
  clearUploads(): void {
    this._uploadedFiles.set([]);
    this._sendError.set(null);
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socketService.isConnected();
  }
}
