import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';

export const SkipJSONInterceptorHeader = 'X-Skip-Content-Type-JSON';

import { Observable } from 'rxjs';

/** Pass the request after appending origin url with protocol. */
@Injectable()
export class AddJsonHeaderInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    // Skip Adding Auth Headers When there is skip header
    if (req.headers.has(SkipJSONInterceptorHeader)) {
      const headers = req.headers.delete(SkipJSONInterceptorHeader);
      return next.handle(req.clone({ headers }));
    }

    if (req.headers.has('Content-Type')) {
      return next.handle(req);
    } else {
      const withDefaultHeader = req.clone({
        setHeaders: { 'Content-Type': 'application/json' }
      });
      return next.handle(withDefaultHeader);
    }
  }
}
