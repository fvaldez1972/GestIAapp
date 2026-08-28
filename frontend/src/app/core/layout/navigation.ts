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
      { label: 'Clientes', icon: 'customer', route: '/clientes' },
      { label: 'Personal', icon: 'people', route: '/personal' },
      { label: 'Planeación', icon: 'calendar', planned: true },
    ],
  },
  {
    label: 'Operación',
    items: [
      { label: 'Asistencia', icon: 'attendance', route: '/operacion' },
      { label: 'Incidencias', icon: 'incident', route: '/operacion' },
      { label: 'Cobertura', icon: 'coverage', route: '/operacion' },
    ],
  },
  {
    label: 'Control',
    items: [{ label: 'Reportes', icon: 'report', planned: true }],
  },
];
