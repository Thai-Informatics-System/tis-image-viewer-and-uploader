import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';

import { environment as env } from '../../environments/environment';
import { Observable } from 'rxjs';
export const SkipBaseUrlHeader = 'X-Skip-Base-Url';


/** Pass the request after appending origin url with protocol. */
@Injectable()
export class CorrectUrlInterceptor implements HttpInterceptor {

  constructor() { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (req.headers.has(SkipBaseUrlHeader)) {
      const headers = req.headers.delete(SkipBaseUrlHeader);
      return next.handle(req.clone({ headers }));
    }

    if (req.url.indexOf('http://') > -1 || req.url.indexOf('https://') > -1) {
      return next.handle(req);
    } else {
      const secureReq = req.clone({
        url: env.origin.concat(req.url),
      });
      return next.handle(secureReq);
    }
  }
}
