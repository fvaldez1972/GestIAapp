export type NavigationIcon =
  | 'home'
  | 'request'
  | 'customer'
  | 'people'
  | 'calendar'
  | 'attendance'
  | 'incident'
  | 'coverage'
  | 'report';

export type NavigationItem = {
  readonly label: string;
  readonly icon: NavigationIcon;
  readonly route?: string;
  readonly planned?: boolean;
};

export type NavigationGroup = {
  readonly label: string;
  readonly items: readonly NavigationItem[];
};

export const GESTIA_NAVIGATION: readonly NavigationGroup[] = [
  {
    label: 'Principal',
    items: [{ label: 'Inicio', icon: 'home', route: '/' }],
  },
  {
    label: 'Gestión',
    items: [
      { label: 'Solicitudes', icon: 'request', planned: true },
      { label: 'Clientes y servicios', icon: 'customer', planned: true },
      { label: 'Personal', icon: 'people', planned: true },
      { label: 'Planeación', icon: 'calendar', planned: true },
    ],
  },
  {
    label: 'Operación',
    items: [
      { label: 'Asistencia', icon: 'attendance', planned: true },
      { label: 'Incidencias', icon: 'incident', planned: true },
      { label: 'Cobertura', icon: 'coverage', planned: true },
    ],
  },
  {
    label: 'Control',
    items: [{ label: 'Reportes', icon: 'report', planned: true }],
  },
];
