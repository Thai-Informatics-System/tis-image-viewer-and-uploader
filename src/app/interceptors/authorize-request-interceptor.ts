import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MockSocketAdapterService } from '../services/mock-socket-adapter.service';

export const SkipAuthInterceptorHeader = 'X-Skip-Auth-Interceptor';

/** Pass the request after adding authorization header. */
@Injectable()
export class AuthorizeRequestInterceptor implements HttpInterceptor {
  private mockAdapter = inject(MockSocketAdapterService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip Adding Auth Headers When there is skip header
    if (req.headers.has(SkipAuthInterceptorHeader)) {
      const headers = req.headers.delete(SkipAuthInterceptorHeader);
      return next.handle(req.clone({ headers }));
    }

    const token = this.mockAdapter.getAuthToken();
    if (token) {
      const secureReq = req.clone({
        headers: req.headers.set('Authorization', 'Bearer ' + token)
      });
      return next.handle(secureReq);
    }

    return next.handle(req);
  }
}
