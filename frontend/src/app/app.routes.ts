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
    ],
  },
  { path: '**', redirectTo: '' },
];
