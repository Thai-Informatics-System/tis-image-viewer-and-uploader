import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
// import { SkipAuthInterceptorHeader } from '@app/interceptors/authorize-request-interceptor';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {

  constructor(private http: HttpClient) { }

  getUploadUrl(url: string, filename: string, mimeType: string, type: string): Observable<any> {
    return this.http.post(url, { filename, mimeType, type });
  }

  attachImagesToEntity(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

  // uploadImageByEntity(url: string, data: any): Observable<any> {
  //   return this.http.post(url, data);
  // }

  putImage(url: string, file: File, contentType?: string): Observable<any> {
    // const headers = new HttpHeaders({ "content-type": contentType ? contentType : "binary/octet-stream"}).set(SkipAuthInterceptorHeader, "");
    const headers = new HttpHeaders({ "content-type": contentType ? contentType : "binary/octet-stream"});
    return this.http.put(url, file, { headers });
  }

  deleteUploadedImage(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

  // removeImageById(url: string, imageId: number): Observable<any> {
  //   return this.http.post(url, { id: imageId });
  // }

}
