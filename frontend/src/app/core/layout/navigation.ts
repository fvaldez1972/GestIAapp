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
  readonly platformOnly?: boolean;
  readonly hideForPlatformAdmin?: boolean;
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
    label: 'Operación',
    items: [
      { label: 'Monitor global', icon: 'report', route: '/monitor', permission: 'REPORTS.READ', platformOnly: true },
      { label: 'Planeación', icon: 'calendar', route: '/planeacion', permission: 'PLANNING.READ' },
      { label: 'Asistencia', icon: 'attendance', route: '/operacion/asistencia', permission: 'OPERATIONS.READ' },
      { label: 'Incidencias', icon: 'incident', route: '/operacion/incidencias', permission: 'OPERATIONS.READ' },
      { label: 'Cobertura', icon: 'coverage', route: '/operacion/cobertura', permission: 'OPERATIONS.READ' },
    ],
  },
  {
    label: 'Control',
    items: [
      { label: 'Solicitudes', icon: 'request', route: '/solicitudes', permission: 'REQUESTS.READ' },
      { label: 'Reportes', icon: 'report', route: '/reportes', permission: 'REPORTS.READ' },
      { label: 'Auditoría', icon: 'audit', route: '/auditoria', permission: 'AUDIT.READ' },
      { label: 'Seguridad', icon: 'security', route: '/seguridad', permission: 'PLATFORM.ADMIN', platformOnly: true },
      { label: 'Seguridad', icon: 'security', route: '/usuarios', permission: 'USERS.READ', hideForPlatformAdmin: true },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { label: 'Organizaciones', icon: 'security', route: '/plataforma/organizaciones', permission: 'PLATFORM.ADMIN', platformOnly: true },
      { label: 'Clientes', icon: 'customer', route: '/clientes', permission: 'CLIENTS.READ', hideForPlatformAdmin: true },
      { label: 'Servicios', icon: 'coverage', route: '/servicios', permission: 'CLIENTS.READ', hideForPlatformAdmin: true },
      { label: 'Personal', icon: 'people', route: '/personal', permission: 'WORKFORCE.READ', hideForPlatformAdmin: true },
      { label: 'Catálogos', icon: 'catalog', route: '/catalogos', permission: 'CATALOGS.READ', hideForPlatformAdmin: true },
      { label: 'Reglas documentales', icon: 'document', route: '/configuracion/documentos', permission: 'CATALOGS.READ', hideForPlatformAdmin: true },
    ],
  },
];
