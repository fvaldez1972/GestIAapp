import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
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
    ],
  },
  { path: '**', redirectTo: '' },
];
