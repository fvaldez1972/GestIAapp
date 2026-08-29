import { Routes } from '@angular/router';
import { authChildGuard, authGuard } from './core/auth/auth.guard';
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
    canActivateChild: [authChildGuard],
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
        data: { permission: 'CLIENTS.READ' },
        loadComponent: () =>
          import('./features/clients/pages/clients-page/clients-page').then(
            (component) => component.ClientsPage,
          ),
      },
      {
        path: 'solicitudes',
        title: 'GestIA | Solicitudes',
        data: { permission: 'REQUESTS.READ' },
        loadComponent: () =>
          import('./features/requests/pages/requests-page/requests-page').then(
            (component) => component.RequestsPage,
          ),
      },
      {
        path: 'personal',
        title: 'GestIA | Personal',
        data: { permission: 'WORKFORCE.READ' },
        loadComponent: () =>
          import('./features/workforce/pages/workforce-page/workforce-page').then(
            (component) => component.WorkforcePage,
          ),
      },
      {
        path: 'documentos',
        title: 'GestIA | Documentos',
        data: { permission: 'DOCUMENTS.READ' },
        loadComponent: () =>
          import('./features/documents/pages/documents-page/documents-page').then(
            (component) => component.DocumentsPage,
          ),
      },
      {
        path: 'catalogos',
        title: 'GestIA | Catálogos',
        data: { permission: 'CATALOGS.READ' },
        loadComponent: () =>
          import('./features/catalogs/pages/catalogs-page/catalogs-page').then(
            (component) => component.CatalogsPage,
          ),
      },
      {
        path: 'planeacion',
        title: 'GestIA | Planeación',
        data: { permission: 'PLANNING.READ' },
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
        data: { permission: 'OPERATIONS.READ' },
        loadComponent: () =>
          import('./features/operations/pages/operations-page/operations-page').then(
            (component) => component.OperationsPage,
          ),
      },
      {
        path: 'seguridad',
        title: 'GestIA | Seguridad',
        data: { permission: 'PLATFORM.ADMIN' },
        loadComponent: () =>
          import('./features/security/pages/security-page/security-page').then(
            (component) => component.SecurityPage,
          ),
      },
      {
        path: 'reportes',
        title: 'GestIA | Reportes',
        data: { permission: 'REPORTS.READ' },
        loadComponent: () =>
          import('./features/reports/pages/reports-page/reports-page').then(
            (component) => component.ReportsPage,
          ),
      },
      {
        path: 'auditoria',
        title: 'GestIA | Auditoría',
        data: { permission: 'AUDIT.READ' },
        loadComponent: () =>
          import('./features/audit/pages/audit-page/audit-page').then(
            (component) => component.AuditPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
