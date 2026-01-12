import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { TisErrorDialogComponent } from '../tis-error-dialog/tis-error-dialog.component';
import { Observable } from 'rxjs';
import imageCompression from 'browser-image-compression';

// Maximum file size after compression (4MB)
const MAX_COMPRESSED_FILE_SIZE_MB = 4;
const MAX_COMPRESSED_FILE_SIZE_BYTES = MAX_COMPRESSED_FILE_SIZE_MB * 1024 * 1024;

// Quality levels for iterative compression (95%, 90%, 85%, ... down to 10%)
const QUALITY_LEVELS = [0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60, 0.55, 0.50, 0.45, 0.40, 0.35, 0.30, 0.25, 0.20, 0.15, 0.10];

@Injectable({
  providedIn: 'root'
})
export class TisHelperService {

  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private http: HttpClient
  ) { }

  showHttpErrorMsg(error: HttpErrorResponse, duration = 5000) {
    console.log('httpError: ', error);

    let errorMessage = 'Some Unknown Error Occurred.';
    let errorCode = 'Unknown Error';
    const httpError = error;

    if (httpError.status >= 400) {
      const errorFromServer = httpError.error?.errors || httpError.error || [];
      if (Array.isArray(errorFromServer) && errorFromServer.length > 0) {
        errorMessage = errorFromServer[0].message;
        errorCode = errorFromServer[0].code;
      }
    } else if (httpError.status < 100) {
      errorMessage = httpError.message;
      errorCode = httpError.statusText;
    }

    if (errorCode == "VALIDATION_ERROR" || errorCode == "NOT_FOUND_ERROR" || errorCode == "THIRD_PARTY_API_ERROR") {
      let confirmBoxData: any = {
        title: "Error !",
        message: errorMessage,
        icon: "error",
        iconClass: "tis-text-danger",
        buttonText: "Ok",
        buttonClass: "tis-btn-primary",
      };

      const dialogRef: MatDialogRef<TisErrorDialogComponent> = this.dialog.open(TisErrorDialogComponent, {
        width: "550px",
        panelClass: ['tis-simple-confirmation'],
        data: confirmBoxData,
        disableClose: false,
      });

      return dialogRef;

    } else {
      const snackbarRef: MatSnackBarRef<TextOnlySnackBar> = this.snackBar.open(errorMessage, 'Error', { duration: duration });
      return snackbarRef;
    }

  }

  showSuccessMsg(message: string, title: string, duration = 5000) {
    this.snackBar.open(message, title, {
      duration: duration
    })
  }

  showErrorMsg(message: string, title: string, duration = 5000) {
    this.snackBar.open(message, title, {
      duration: duration
    })
  }

  /**
   * Compresses an image file to ensure it's under MAX_COMPRESSED_FILE_SIZE_MB.
   * Uses iterative compression with decreasing quality levels while maintaining aspect ratio.
   * @param image - Data URL string or File object
   * @param mimeType - The MIME type of the image (e.g., 'image/jpeg', 'image/png')
   * @returns Promise<Blob> - The compressed image as a Blob
   */
  async compressFile(image: any, mimeType: string): Promise<Blob> {
    const startTime = performance.now();
    let file: File;

    console.log('[ImageCompression] Starting compression process...');
    console.log('[ImageCompression] Input type:', typeof image === 'string' ? 'DataURL' : image?.constructor?.name);
    console.log('[ImageCompression] MIME type:', mimeType);

    // Convert data URL to File if necessary
    if (typeof image === 'string' && image.startsWith('data:')) {
      const blob = this.dataURItoBlob(image.split(',')[1], mimeType);
      file = new File([blob], 'image.' + this.getExtensionFromMimeType(mimeType), { type: mimeType });
      console.log('[ImageCompression] Converted DataURL to File');
    } else if (image instanceof File) {
      file = image;
      console.log('[ImageCompression] Input is already a File:', file.name);
    } else if (image instanceof Blob) {
      file = new File([image], 'image.' + this.getExtensionFromMimeType(mimeType), { type: mimeType });
      console.log('[ImageCompression] Converted Blob to File');
    } else {
      console.error('[ImageCompression] Invalid input type:', typeof image);
      throw new Error('Invalid image input: expected data URL string, File, or Blob');
    }

    const originalSizeBytes = file.size;
    const originalSizeKB = originalSizeBytes / 1024;
    const originalSizeMB = originalSizeKB / 1024;

    console.log('[ImageCompression] ═══════════════════════════════════════');
    console.log('[ImageCompression] Original file size:', this.formatFileSize(originalSizeBytes));
    console.log('[ImageCompression] Max allowed size:', `${MAX_COMPRESSED_FILE_SIZE_MB}MB`);
    console.log('[ImageCompression] ═══════════════════════════════════════');

    // If file is already under the limit, return as-is
    if (file.size <= MAX_COMPRESSED_FILE_SIZE_BYTES) {
      const elapsed = (performance.now() - startTime).toFixed(2);
      console.log('[ImageCompression] ✓ File already under limit, no compression needed');
      console.log(`[ImageCompression] Time elapsed: ${elapsed}ms`);
      return file;
    }

    // Check if the file is an image that can be compressed
    if (!this.isCompressibleImage(mimeType)) {
      console.warn(`[ImageCompression] ⚠ File type ${mimeType} cannot be compressed. Returning original file.`);
      return file;
    }

    console.log('[ImageCompression] Starting iterative compression...');
    console.log('[ImageCompression] Quality levels to try:', QUALITY_LEVELS.map(q => `${q * 100}%`).join(', '));

    // Iteratively compress with decreasing quality until under size limit
    let compressedFile: File = file;
    let attemptCount = 0;

    for (const quality of QUALITY_LEVELS) {
      attemptCount++;
      try {
        const options = {
          maxSizeMB: MAX_COMPRESSED_FILE_SIZE_MB,
          maxWidthOrHeight: undefined, // Maintain original dimensions (aspect ratio preserved)
          useWebWorker: true,
          initialQuality: quality,
          preserveExif: true,
          fileType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | undefined,
        };

        console.log(`[ImageCompression] Attempt ${attemptCount}: Quality ${quality * 100}%...`);
        
        const attemptStart = performance.now();
        compressedFile = await imageCompression(file, options);
        const attemptTime = (performance.now() - attemptStart).toFixed(2);

        const compressedSizeBytes = compressedFile.size;
        const reductionPercent = ((1 - compressedSizeBytes / originalSizeBytes) * 100).toFixed(1);

        console.log(`[ImageCompression]   → Result: ${this.formatFileSize(compressedSizeBytes)} (${reductionPercent}% reduction) in ${attemptTime}ms`);

        // If compressed file is under the limit, we're done
        if (compressedFile.size <= MAX_COMPRESSED_FILE_SIZE_BYTES) {
          const totalTime = (performance.now() - startTime).toFixed(2);
          console.log('[ImageCompression] ═══════════════════════════════════════');
          console.log('[ImageCompression] ✓ COMPRESSION SUCCESSFUL');
          console.log(`[ImageCompression]   Original size:   ${this.formatFileSize(originalSizeBytes)}`);
          console.log(`[ImageCompression]   Compressed size: ${this.formatFileSize(compressedFile.size)}`);
          console.log(`[ImageCompression]   Size reduction:  ${reductionPercent}%`);
          console.log(`[ImageCompression]   Final quality:   ${quality * 100}%`);
          console.log(`[ImageCompression]   Attempts:        ${attemptCount}`);
          console.log(`[ImageCompression]   Total time:      ${totalTime}ms`);
          console.log('[ImageCompression] ═══════════════════════════════════════');
          return compressedFile;
        }
      } catch (error) {
        console.error(`[ImageCompression] ✗ Attempt ${attemptCount} failed at quality ${quality * 100}%:`, error);
      }
    }

    // If we've exhausted all quality levels, return the best we could achieve
    const totalTime = (performance.now() - startTime).toFixed(2);
    const finalReduction = ((1 - compressedFile.size / originalSizeBytes) * 100).toFixed(1);
    
    console.log('[ImageCompression] ═══════════════════════════════════════');
    console.warn('[ImageCompression] ⚠ COMPRESSION LIMIT REACHED');
    console.log(`[ImageCompression]   Original size:   ${this.formatFileSize(originalSizeBytes)}`);
    console.log(`[ImageCompression]   Final size:      ${this.formatFileSize(compressedFile.size)}`);
    console.log(`[ImageCompression]   Size reduction:  ${finalReduction}%`);
    console.log(`[ImageCompression]   Target was:      ${MAX_COMPRESSED_FILE_SIZE_MB}MB`);
    console.log(`[ImageCompression]   Attempts:        ${attemptCount}`);
    console.log(`[ImageCompression]   Total time:      ${totalTime}ms`);
    console.warn(`[ImageCompression]   Could not compress below ${MAX_COMPRESSED_FILE_SIZE_MB}MB, returning best result`);
    console.log('[ImageCompression] ═══════════════════════════════════════');
    
    return compressedFile;
  }

  /**
   * Formats file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }
  }

  /**
   * Checks if the given MIME type is a compressible image format
   */
  private isCompressibleImage(mimeType: string): boolean {
    const compressibleTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'];
    return compressibleTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Gets file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
    };
    return mimeToExt[mimeType.toLowerCase()] || 'bin';
  }

  dataURItoBlob(dataURI: string, mimeType: string): Blob {
    const byteString = window.atob(dataURI);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const int8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      int8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([int8Array], { type: mimeType });
    return blob;
  }

  getDataUrlFromFile(file: any) {
    return new Promise((resolve, reject) => {
      var reader = new FileReader();
      reader.onload = (e: any) => {
        resolve(e.target.result)
      };
      reader.onerror = (e: any) => {
        reject(e.target.error);
      };
      reader.readAsDataURL(file);
    })
  }

  getUploadUrl(url: string, filename: string, mimeType: string, type: string): Observable<any> {
    return this.http.post(url, { filename, mimeType, type });
  }

  attachFilesToEntity(url: string, data: any, limit: number): Observable<any> {
    return this.http.post(`${url}?limit=${limit}`, data);
  }

  updateTag(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

  updateSequence(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

  putFile(url: string, file: File | Blob | ArrayBuffer, contentType?: string): Observable<any> {
    const headers = new HttpHeaders({ "content-type": contentType ? contentType : "binary/octet-stream"}).set('X-Skip-Auth-Interceptor', "");
    return this.http.put(url, file, { headers });
  }

  deleteUploadedFile(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

}