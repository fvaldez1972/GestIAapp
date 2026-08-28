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
        path: 'solicitudes',
        title: 'GestIA | Solicitudes',
        loadComponent: () =>
          import('./features/requests/pages/requests-page/requests-page').then(
            (component) => component.RequestsPage,
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
        path: 'planeacion',
        title: 'GestIA | Planeación',
        loadComponent: () =>
          import('./features/planning/pages/planning-page/planning-page').then(
            (component) => component.PlanningPage,
          ),
      },
      {
        path: 'operacion',
        redirectTo: 'operacion/asistencia',
        pathMatch: 'full',
      },
      {
        path: 'operacion/:section',
        title: 'GestIA | Operación',
        loadComponent: () =>
          import('./features/operations/pages/operations-page/operations-page').then(
            (component) => component.OperationsPage,
          ),
      },
      {
        path: 'seguridad',
        title: 'GestIA | Seguridad',
        loadComponent: () =>
          import('./features/security/pages/security-page/security-page').then(
            (component) => component.SecurityPage,
          ),
      },
      {
        path: 'reportes',
        title: 'GestIA | Reportes',
        loadComponent: () =>
          import('./features/reports/pages/reports-page/reports-page').then(
            (component) => component.ReportsPage,
          ),
      },
      {
        path: 'auditoria',
        title: 'GestIA | Auditoría',
        loadComponent: () =>
          import('./features/audit/pages/audit-page/audit-page').then(
            (component) => component.AuditPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
