import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.accessToken();

  if (!token || request.url.includes('/api/v1/auth/login')) {
    return next(request);
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (auth.isSupportModeActive() && auth.supportSession() && !request.url.includes('/api/v1/support-sessions')) {
    headers['X-GestIA-Support-Session'] = auth.supportSession()!.idSupportSession;
  }

  return next(request.clone({ setHeaders: headers })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
        void router.navigate(['/login'], {
          queryParams: { sessionExpired: '1' },
        });
      }

      return throwError(() => error);
    }),
  );
};
