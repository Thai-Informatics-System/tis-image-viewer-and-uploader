/* "Barrel" of Http Interceptors */
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { CorrectUrlInterceptor } from './correct-url-interceptor';
import { AuthorizeRequestInterceptor } from './authorize-request-interceptor';
import { AddJsonHeaderInterceptor } from './add-json-header-interceptor';


/** Http interceptor providers in outside-in order */
export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: CorrectUrlInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: AddJsonHeaderInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: AuthorizeRequestInterceptor, multi: true }
];
