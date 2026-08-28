import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AppShell } from './core/layout/app-shell/app-shell';

export const routes: Routes = [
  {
    path: 'login',
    title: 'GestIA | Acceso',
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page').then(
        (component) => component.LoginPage,
      ),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        title: 'GestIA | Plataforma operativa',
        loadComponent: () =>
          import('./features/overview/pages/overview-page/overview-page').then(
            (component) => component.OverviewPage,
          ),
      },
      {
        path: 'clientes',
        title: 'GestIA | Clientes',
        loadComponent: () =>
          import('./features/clients/pages/clients-page/clients-page').then(
            (component) => component.ClientsPage,
          ),
      },
      {
        path: 'personal',
        title: 'GestIA | Personal',
        loadComponent: () =>
          import('./features/workforce/pages/workforce-page/workforce-page').then(
            (component) => component.WorkforcePage,
          ),
      },
      {
        path: 'operacion',
        title: 'GestIA | Operación',
        loadComponent: () =>
          import('./features/operations/pages/operations-page/operations-page').then(
            (component) => component.OperationsPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
