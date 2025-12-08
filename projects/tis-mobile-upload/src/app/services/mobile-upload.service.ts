import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PairingInfo {
  valid: boolean;
  desktopDeviceId: string;
  channel: string;
  entityType?: string;
  entityId?: string;
  accept?: string;
  maxFiles?: number;
}

export interface UploadedFile {
  s3Url: string;
  fileName: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
  uploadData?: any;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  result?: UploadedFile;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MobileUploadService {
  private pairingInfo$ = new BehaviorSubject<PairingInfo | null>(null);
  private uploadProgress$ = new Subject<UploadProgress>();

  constructor(private http: HttpClient) {}

  /**
   * Validate pairing code and get connection info
   */
  validatePairingCode(code: string, deviceId?: string): Observable<PairingInfo> {
    return this.http.post<PairingInfo>(`${environment.apiUrl}/remote-upload/validate-code`, {
      pairingCode: code,
      mobileDeviceId: deviceId || this.generateDeviceId()
    }).pipe(
      tap(info => {
        if (info.valid) {
          this.pairingInfo$.next(info);
          this.storePairingInfo(info);
        }
      }),
      catchError(err => {
        console.error('[MobileUploadService] Validation error:', err);
        return throwError(() => new Error(err.error?.message || 'Failed to validate pairing code'));
      })
    );
  }

  /**
   * Get presigned URL for upload
   */
  getUploadUrl(fileName: string, contentType: string, entityType?: string): Observable<any> {
    const pairing = this.pairingInfo$.value;
    
    return this.http.post(`${environment.apiUrl}/upload/presigned-url`, {
      fileName,
      contentType,
      entityType: entityType || pairing?.entityType || 'mobile-upload',
      channel: pairing?.channel
    });
  }

  /**
   * Upload file to presigned URL
   */
  uploadToPresignedUrl(presignedUrl: string, file: File): Observable<number> {
    return new Observable(observer => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          observer.next(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          observer.next(100);
          observer.complete();
        } else {
          observer.error(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        observer.error(new Error('Upload failed'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }

  /**
   * Notify desktop about uploaded file
   */
  notifyDesktop(uploadedFile: UploadedFile, sessionId?: string): Observable<any> {
    const pairing = this.pairingInfo$.value;
    
    if (!pairing) {
      return throwError(() => new Error('Not paired with desktop'));
    }

    return this.http.post(`${environment.apiUrl}/remote-upload/notify`, {
      channel: pairing.channel,
      desktopDeviceId: pairing.desktopDeviceId,
      mobileDeviceId: this.getDeviceId(),
      file: uploadedFile,
      sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * Complete upload flow: get presigned URL, upload, notify desktop
   */
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadedFile> {
    // 1. Get presigned URL
    const urlResponse = await this.getUploadUrl(file.name, file.type).toPromise();
    
    // 2. Upload to presigned URL
    await new Promise<void>((resolve, reject) => {
      this.uploadToPresignedUrl(urlResponse.uploadURL, file).subscribe({
        next: (progress) => {
          if (onProgress) onProgress(progress);
        },
        error: reject,
        complete: resolve
      });
    });

    // 3. Create uploaded file info
    const uploadedFile: UploadedFile = {
      s3Url: urlResponse.resourceUrl,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadData: urlResponse
    };

    // 4. Notify desktop
    await this.notifyDesktop(uploadedFile).toPromise();

    return uploadedFile;
  }

  /**
   * Get current pairing info
   */
  getPairingInfo(): Observable<PairingInfo | null> {
    return this.pairingInfo$.asObservable();
  }

  /**
   * Get upload progress events
   */
  getUploadProgress(): Observable<UploadProgress> {
    return this.uploadProgress$.asObservable();
  }

  /**
   * Check if paired
   */
  isPaired(): boolean {
    return this.pairingInfo$.value !== null;
  }

  /**
   * Clear pairing
   */
  disconnect(): void {
    this.pairingInfo$.next(null);
    this.clearStoredPairing();
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    let deviceId = localStorage.getItem('tis-mobile-device-id');
    if (!deviceId) {
      deviceId = 'mobile-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('tis-mobile-device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return localStorage.getItem('tis-mobile-device-id') || this.generateDeviceId();
  }

  /**
   * Store pairing info in session storage
   */
  private storePairingInfo(info: PairingInfo): void {
    sessionStorage.setItem('tis-mobile-pairing', JSON.stringify(info));
  }

  /**
   * Load stored pairing info
   */
  loadStoredPairing(): PairingInfo | null {
    const stored = sessionStorage.getItem('tis-mobile-pairing');
    if (stored) {
      try {
        const info = JSON.parse(stored);
        this.pairingInfo$.next(info);
        return info;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Clear stored pairing
   */
  private clearStoredPairing(): void {
    sessionStorage.removeItem('tis-mobile-pairing');
  }
}
