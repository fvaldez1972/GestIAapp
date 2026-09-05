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
  readonly route: string;
  readonly permission?: string;

  /**
   * A quién pertenece la entrada, cuando no es de todos.
   *
   * `'platform'` sólo la ve el super administrador. `'organization'` sólo la ve quien **no** lo
   * es: existe para la entrada de Seguridad, que apunta a `/seguridad` para la plataforma y a
   * `/usuarios` dentro de una organización. Sin esta distinción, el super admin dentro de una
   * organización veía las dos y el menú decía "Seguridad" dos veces.
   */
  readonly onlyFor?: 'platform' | 'organization';

  /**
   * La entrada sólo existe dentro de una organización.
   *
   * Antes esto se llamaba `hideForPlatformAdmin`, y el nombre mentía: no ocultaba al super admin,
   * ocultaba mientras no hubiera organización activa. Con el nombre correcto, los tres estados del
   * menú salen de una sola condición en vez de tres sueltas, y se ve de un vistazo cuáles son las
   * entradas que el super admin no debe ver antes de entrar a una organización.
   */
  readonly needsOrganization?: boolean;

  /**
   * Fase del producto en la que la entrada se muestra. Las de fase 2 **no se borran**: su ruta
   * sigue registrada y su pantalla sigue existiendo, sólo no aparecen en el menú. Volver a
   * mostrarlas es quitar esta marca, y hay una prueba que comprueba que las rutas siguen ahí.
   */
  readonly phase?: 1 | 2;
};

/**
 * El menú lateral.
 *
 * <b>Lista plana, sin grupos</b>, como el bosquejo cerrado del componente `SideMenu`. Los títulos
 * de grupo que había antes —Principal, Operación, Control, Configuración— repartían doce entradas
 * en cuatro encabezados y hacían el menú más alto sin decir nada que la entrada no dijera ya. Las
 * migas de la barra superior siguen dando esa jerarquía donde sí sirve: al ubicar la pantalla
 * abierta.
 *
 * El orden es el del bosquejo. Auditoría se agrega al final del bloque de control, por decisión
 * posterior al diseño: el bosquejo cierra en 3/11/10 entradas y con Auditoría visible son 3/12/11.
 */
export const GESTIA_NAVIGATION: readonly NavigationItem[] = [
  { label: 'Inicio', icon: 'home', route: '/' },

  { label: 'Organizaciones', icon: 'security', route: '/plataforma/organizaciones', permission: 'PLATFORM.ADMIN', onlyFor: 'platform' },

  { label: 'Catálogos', icon: 'catalog', route: '/catalogos', permission: 'CATALOGS.READ', needsOrganization: true },
  { label: 'Clientes', icon: 'customer', route: '/clientes', permission: 'CLIENTS.READ', needsOrganization: true },
  { label: 'Servicios', icon: 'coverage', route: '/servicios', permission: 'CLIENTS.READ', needsOrganization: true },
  { label: 'Personal', icon: 'people', route: '/personal', permission: 'WORKFORCE.READ', needsOrganization: true },

  { label: 'Planeación', icon: 'calendar', route: '/planeacion', permission: 'PLANNING.READ', needsOrganization: true },
  { label: 'Asistencia', icon: 'attendance', route: '/operacion/asistencia', permission: 'OPERATIONS.READ', needsOrganization: true },
  { label: 'Incidencias', icon: 'incident', route: '/operacion/incidencias', permission: 'OPERATIONS.READ', needsOrganization: true },
  { label: 'Cobertura', icon: 'coverage', route: '/operacion/cobertura', permission: 'OPERATIONS.READ', needsOrganization: true },

  { label: 'Auditoría', icon: 'audit', route: '/auditoria', permission: 'AUDIT.READ', needsOrganization: true },

  // Las dos caras de la misma entrada. Nunca se muestran juntas: `onlyFor` las hace excluyentes.
  { label: 'Seguridad', icon: 'security', route: '/seguridad', permission: 'PLATFORM.ADMIN', onlyFor: 'platform' },
  { label: 'Seguridad', icon: 'security', route: '/usuarios', permission: 'USERS.READ', onlyFor: 'organization' },

  // ── Fuera de fase 1. Ocultas, no borradas: las rutas y las pantallas siguen en su sitio. ──
  { label: 'Monitor global', icon: 'report', route: '/monitor', permission: 'REPORTS.READ', onlyFor: 'platform', phase: 2 },
  { label: 'Solicitudes', icon: 'request', route: '/solicitudes', permission: 'REQUESTS.READ', needsOrganization: true, phase: 2 },
  { label: 'Reportes', icon: 'report', route: '/reportes', permission: 'REPORTS.READ', needsOrganization: true, phase: 2 },
  { label: 'Reglas documentales', icon: 'document', route: '/configuracion/documentos', permission: 'CATALOGS.READ', needsOrganization: true, phase: 2 },
];

/** Con qué se decide si una entrada se muestra. Lo que el menú sabe del usuario, y nada más. */
export type NavigationAudience = {
  readonly isPlatformAdmin: boolean;
  readonly hasActiveOrganization: boolean;
  readonly hasPermission: (permission: string) => boolean;
};

/**
 * Las entradas visibles para un usuario.
 *
 * <b>El menú dice a dónde puedes ir, no qué puedes hacer ahí.</b> Ocultar una entrada no es
 * autorización: la autorización está en el servidor, en el guard y en el filtro de organización.
 * Esta función sólo evita ofrecer puertas que no llevan a nada.
 */
export function visibleNavigation(
  audience: NavigationAudience,
  items: readonly NavigationItem[] = GESTIA_NAVIGATION,
): readonly NavigationItem[] {
  return items.filter((item) => {
    if (item.phase === 2) {
      return false;
    }

    if (item.onlyFor === 'platform' && !audience.isPlatformAdmin) {
      return false;
    }

    if (item.onlyFor === 'organization' && audience.isPlatformAdmin) {
      return false;
    }

    if (item.needsOrganization && !audience.hasActiveOrganization) {
      return false;
    }

    return !item.permission || audience.hasPermission(item.permission);
  });
}
