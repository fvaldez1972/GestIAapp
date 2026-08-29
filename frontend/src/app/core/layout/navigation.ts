export type NavigationIcon =
  | 'home'
  | 'request'
  | 'customer'
  | 'document'
  | 'catalog'
  | 'people'
  | 'calendar'
  | 'attendance'
  | 'incident'
  | 'coverage'
  | 'report'
  | 'audit'
  | 'security';

export type NavigationItem = {
  readonly label: string;
  readonly icon: NavigationIcon;
  readonly route?: string;
  readonly permission?: string;
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
      { label: 'Solicitudes', icon: 'request', route: '/solicitudes', permission: 'REQUESTS.READ' },
      { label: 'Clientes', icon: 'customer', route: '/clientes', permission: 'CLIENTS.READ' },
      { label: 'Personal', icon: 'people', route: '/personal', permission: 'WORKFORCE.READ' },
      { label: 'Documentos', icon: 'document', route: '/documentos', permission: 'DOCUMENTS.READ' },
      { label: 'Catálogos', icon: 'catalog', route: '/catalogos', permission: 'CATALOGS.READ' },
      { label: 'Planeación', icon: 'calendar', route: '/planeacion', permission: 'PLANNING.READ' },
    ],
  },
  {
    label: 'Operación',
    items: [
      { label: 'Asistencia', icon: 'attendance', route: '/operacion/asistencia', permission: 'OPERATIONS.READ' },
      { label: 'Incidencias', icon: 'incident', route: '/operacion/incidencias', permission: 'OPERATIONS.READ' },
      { label: 'Cobertura', icon: 'coverage', route: '/operacion/cobertura', permission: 'OPERATIONS.READ' },
    ],
  },
  {
    label: 'Control',
    items: [
      { label: 'Reportes', icon: 'report', route: '/reportes', permission: 'REPORTS.READ' },
      { label: 'Auditoría', icon: 'audit', route: '/auditoria', permission: 'AUDIT.READ' },
      { label: 'Seguridad', icon: 'security', route: '/seguridad', permission: 'PLATFORM.ADMIN' },
    ],
  },
];
