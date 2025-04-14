import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
// import { SkipAuthInterceptorHeader } from '@app/interceptors/authorize-request-interceptor';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  constructor(private http: HttpClient) { }

  getUploadUrl(url: string, filename: string, mimeType: string, type: string): Observable<any> {
    return this.http.post(url, { filename, mimeType, type });
  }

  attachFilesToEntity(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

  putFile(url: string, file: File): Observable<any> {
    // const headers = new HttpHeaders({ "content-type": "binary/octet-stream"}).set(SkipAuthInterceptorHeader, "");
    const headers = new HttpHeaders({ "content-type": "binary/octet-stream"});
    return this.http.put(url, file, { headers });
  }

  deleteUploadedFile(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

  // getDownloadUrl(url: string, filepath: string , expiryInHours: number): Observable<any> {
  //   return this.http.post(url, { filepath, expiryInHours });
  // }

}
