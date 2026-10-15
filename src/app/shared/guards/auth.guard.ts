import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authenticatedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    return await auth.waitForSession() ? true : router.createUrlTree(['/']);
  } catch {
    return router.createUrlTree(['/']);
  }
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    return await auth.waitForSession() ? router.createUrlTree(['/home']) : true;
  } catch {
    return true;
  }
};
