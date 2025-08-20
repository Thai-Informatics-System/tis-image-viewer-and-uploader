import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { TisErrorDialogComponent } from '../tis-error-dialog/tis-error-dialog.component';
import { Observable } from 'rxjs';


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

  async compressFile(image: any, mimeType: string): Promise<Blob> {

    let imageData = image;

    let imageBlob: Blob = this.dataURItoBlob(imageData.split(',')[1], mimeType);
    return imageBlob;
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

  putFile(url: string, file: File, contentType?: string): Observable<any> {
    const headers = new HttpHeaders({ "content-type": contentType ? contentType : "binary/octet-stream"}).set('X-Skip-Auth-Interceptor', "");
    return this.http.put(url, file, { headers });
  }

  deleteUploadedFile(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

}