import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { LoginPage } from './pages/login/login.page';
import { authenticatedGuard, guestGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LoginPage, canActivate: [guestGuard] },
  { path: 'login', redirectTo: '', pathMatch: 'full' },
  { path: 'home', component: HomePage, canActivate: [authenticatedGuard] },
  { path: '**', redirectTo: '' },
];
