import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route) => authorizeRoute(route);
export const authChildGuard: CanActivateChildFn = (childRoute) => authorizeRoute(childRoute);

function authorizeRoute(route: ActivatedRouteSnapshot) {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const permission = route.data['permission'] as string | undefined;
  const platformOnly = route.data['platformOnly'] === true;
  const isPlatformAdmin = auth.session()?.permissions.includes('PLATFORM.ADMIN') ?? false;

  if (platformOnly && !isPlatformAdmin) {
    return router.createUrlTree(['/']);
  }

  if (!permission || auth.hasPermission(permission)) {
    return true;
  }

  return router.createUrlTree(['/']);
}
