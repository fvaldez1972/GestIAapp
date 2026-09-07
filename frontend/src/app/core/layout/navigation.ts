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
 * Un encabezado del menú con sus entradas.
 *
 * El grupo **no** es una ruta ni un permiso: no se puede hacer clic en él y no decide nada sobre
 * lo que el usuario puede ver. Es sólo el rótulo que separa bloques de entradas.
 */
export type NavigationGroup = {
  readonly label: string;
  readonly items: readonly NavigationItem[];
};

/**
 * El menú lateral, en cuatro grupos.
 *
 * <b>Nota para quien compare con el bosquejo.</b> `docs/design/fase-1/pantallas/componentes/
 * side-menu.html` dibuja una lista plana, y en la tanda 1 el menú se aplanó para seguirlo. Los
 * grupos volvieron después por decisión explícita, ya con las once entradas en pantalla: una lista
 * plana de diez o doce renglones obliga a leerlos todos para encontrar uno, y los cuatro rótulos
 * cuestan menos altura que esa lectura. El bosquejo quedó atrás en este punto y no hay que
 * "corregir" el código para volver a él.
 *
 * El orden dentro de cada grupo es el pedido, no el alfabético: Configuración empieza por
 * Organizaciones y Clientes porque es el orden en que se configura una organización nueva.
 */
export const GESTIA_NAVIGATION: readonly NavigationGroup[] = [
  {
    label: 'Principal',
    items: [{ label: 'Inicio', icon: 'home', route: '/' }],
  },

  {
    label: 'Operación',
    items: [
      { label: 'Planeación', icon: 'calendar', route: '/planeacion', permission: 'PLANNING.READ', needsOrganization: true },
      { label: 'Asistencia', icon: 'attendance', route: '/operacion/asistencia', permission: 'OPERATIONS.READ', needsOrganization: true },
      { label: 'Incidencias', icon: 'incident', route: '/operacion/incidencias', permission: 'OPERATIONS.READ', needsOrganization: true },
      { label: 'Cobertura', icon: 'coverage', route: '/operacion/cobertura', permission: 'OPERATIONS.READ', needsOrganization: true },

      // Fuera de fase 1. Oculta, no borrada.
      { label: 'Solicitudes', icon: 'request', route: '/solicitudes', permission: 'REQUESTS.READ', needsOrganization: true, phase: 2 },
    ],
  },

  {
    /**
     * Hoy este grupo no tiene ninguna entrada visible: sus dos entradas están fuera de fase 1.
     * El grupo entero desaparece del menú mientras eso siga así —ver `visibleNavigation`— y
     * reaparece solo el día que a alguna se le quite la marca de fase 2.
     */
    label: 'Reportes y dashboards',
    items: [
      { label: 'Monitor global', icon: 'report', route: '/monitor', permission: 'REPORTS.READ', onlyFor: 'platform', phase: 2 },
      { label: 'Reportes', icon: 'report', route: '/reportes', permission: 'REPORTS.READ', needsOrganization: true, phase: 2 },
    ],
  },

  {
    label: 'Configuración',
    items: [
      { label: 'Organizaciones', icon: 'security', route: '/plataforma/organizaciones', permission: 'PLATFORM.ADMIN', onlyFor: 'platform' },
      { label: 'Clientes', icon: 'customer', route: '/clientes', permission: 'CLIENTS.READ', needsOrganization: true },
      { label: 'Servicios', icon: 'coverage', route: '/servicios', permission: 'CLIENTS.READ', needsOrganization: true },
      { label: 'Personal', icon: 'people', route: '/personal', permission: 'WORKFORCE.READ', needsOrganization: true },
      { label: 'Catálogos', icon: 'catalog', route: '/catalogos', permission: 'CATALOGS.READ', needsOrganization: true },
      { label: 'Auditoría', icon: 'audit', route: '/auditoria', permission: 'AUDIT.READ', needsOrganization: true },

      // Las dos caras de la misma entrada. Nunca se muestran juntas: `onlyFor` las hace excluyentes.
      { label: 'Seguridad', icon: 'security', route: '/seguridad', permission: 'PLATFORM.ADMIN', onlyFor: 'platform' },
      { label: 'Seguridad', icon: 'security', route: '/usuarios', permission: 'USERS.READ', onlyFor: 'organization' },

      // Fuera de fase 1. Oculta, no borrada.
      { label: 'Reglas documentales', icon: 'document', route: '/configuracion/documentos', permission: 'CATALOGS.READ', needsOrganization: true, phase: 2 },
    ],
  },
];

/** Todas las entradas sin sus grupos, para lo que necesita recorrerlas y no dibujarlas. */
export const GESTIA_NAVIGATION_ITEMS: readonly NavigationItem[] =
  GESTIA_NAVIGATION.flatMap((group) => group.items);

/** Con qué se decide si una entrada se muestra. Lo que el menú sabe del usuario, y nada más. */
export type NavigationAudience = {
  readonly isPlatformAdmin: boolean;
  readonly hasActiveOrganization: boolean;
  readonly hasPermission: (permission: string) => boolean;
};

/**
 * Los grupos visibles para un usuario, cada uno ya con sus entradas visibles.
 *
 * <b>El menú dice a dónde puedes ir, no qué puedes hacer ahí.</b> Ocultar una entrada no es
 * autorización: la autorización está en el servidor, en el guard y en el filtro de organización.
 * Esta función sólo evita ofrecer puertas que no llevan a nada.
 *
 * <b>Un grupo sin entradas visibles no se dibuja.</b> Es la misma regla que ya gobierna las
 * entradas, aplicada un nivel más arriba: un encabezado con nada debajo promete una sección que la
 * aplicación no tiene, y el usuario no puede distinguir «todavía no existe» de «se rompió». Importa
 * en los tres estados y no sólo con Reportes: el super admin fuera de una organización deja vacíos
 * Operación y casi todo Configuración.
 */
export function visibleNavigation(
  audience: NavigationAudience,
  groups: readonly NavigationGroup[] = GESTIA_NAVIGATION,
): readonly NavigationGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => isVisible(item, audience)) }))
    .filter((group) => group.items.length > 0);
}

/** Las entradas visibles sin sus grupos, en el orden en que aparecen. */
export function visibleNavigationItems(
  audience: NavigationAudience,
  groups: readonly NavigationGroup[] = GESTIA_NAVIGATION,
): readonly NavigationItem[] {
  return visibleNavigation(audience, groups).flatMap((group) => group.items);
}

function isVisible(item: NavigationItem, audience: NavigationAudience): boolean {
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
}
