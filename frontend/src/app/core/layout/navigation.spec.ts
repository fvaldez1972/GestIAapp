import { routes } from '../../app.routes';
import { CATALOG_PAGE_GROUPS } from '../../features/catalogs/data-access/catalog-pages';
import {
  GESTIA_NAVIGATION,
  GESTIA_NAVIGATION_ITEMS,
  NavigationAudience,
  visibleNavigation,
  visibleNavigationItems,
} from './navigation';

/**
 * Los 21 permisos del rol ORGANIZATION_ADMIN, copiados de lo que devuelve el inicio de sesión.
 * Son todos menos `PLATFORM.ADMIN` y `ORGANIZATIONS.WRITE`. Se enumeran aquí, y no se derivan,
 * para que la prueba falle si el rol cambia de forma y nadie revisó qué pasa con el menú.
 */
const PERMISOS_ADMIN_ORGANIZACION = [
  'ORGANIZATIONS.READ',
  'USERS.READ',
  'USERS.WRITE',
  'CLIENTS.READ',
  'CLIENTS.WRITE',
  'DOCUMENTS.READ',
  'DOCUMENTS.WRITE',
  'CATALOGS.READ',
  'CATALOGS.WRITE',
  'WORKFORCE.READ',
  'WORKFORCE.WRITE',
  'PLANNING.READ',
  'PLANNING.WRITE',
  'OPERATIONS.READ',
  'OPERATIONS.WRITE',
  'REPORTS.READ',
  'REQUESTS.READ',
  'REQUESTS.WRITE',
  'AUDIT.READ',
  'DOCUMENTS.SENSITIVE.READ',
  'DOCUMENTS.SENSITIVE.WRITE',
];

/** El super admin pasa cualquier permiso, como hace `AuthService.hasPermission`. */
const superAdmin = (dentroDeUnaOrganizacion: boolean): NavigationAudience => ({
  isPlatformAdmin: true,
  hasActiveOrganization: dentroDeUnaOrganizacion,
  hasPermission: () => true,
});

const adminDeOrganizacion: NavigationAudience = {
  isPlatformAdmin: false,
  hasActiveOrganization: true,
  hasPermission: (permission) => PERMISOS_ADMIN_ORGANIZACION.includes(permission),
};

const etiquetas = (audience: NavigationAudience) =>
  visibleNavigationItems(audience).map((item) => item.label);

const grupos = (audience: NavigationAudience) =>
  visibleNavigation(audience).map((group) => group.label);

/** El menú tal como se dibuja: cada grupo con las entradas que cuelgan de él. */
const menu = (audience: NavigationAudience) =>
  visibleNavigation(audience).map((group) => [group.label, group.items.map((item) => item.label)]);

/** Las rutas que el enrutador conoce, aplanadas: hijas del shell más las de primer nivel. */
const rutasRegistradas = new Set(
  routes.flatMap((route) => [
    `/${route.path ?? ''}`,
    ...(route.children ?? []).map((child) => `/${child.path ?? ''}`),
  ]),
);

describe('Menú lateral', () => {
  /**
   * Los tres estados, ahora con sus grupos. Las cuentas de entradas son las mismas de antes
   * —3 / 12 / 11— porque los grupos no agregan ni quitan entradas: sólo las reparten. Si alguien
   * vuelve a mover la cuenta, o mete una entrada en el grupo equivocado, esto lo dice antes de que
   * nadie abra la aplicación.
   */
  it('el super admin fuera de una organización ve tres entradas en dos grupos', () => {
    expect(menu(superAdmin(false))).toEqual([
      ['Principal', ['Inicio']],
      ['Configuración', ['Organizaciones', 'Seguridad']],
    ]);
  });

  it('el super admin dentro de una organización ve doce entradas en tres grupos', () => {
    expect(menu(superAdmin(true))).toEqual([
      ['Principal', ['Inicio']],
      ['Operación', ['Planeación', 'Asistencia', 'Incidencias', 'Cobertura']],
      [
        'Configuración',
        ['Organizaciones', 'Clientes', 'Servicios', 'Personal', 'Catálogos', 'Auditoría', 'Seguridad'],
      ],
    ]);
  });

  it('el admin de organización ve once: las mismas menos Organizaciones', () => {
    expect(menu(adminDeOrganizacion)).toEqual([
      ['Principal', ['Inicio']],
      ['Operación', ['Planeación', 'Asistencia', 'Incidencias', 'Cobertura']],
      ['Configuración', ['Clientes', 'Servicios', 'Personal', 'Catálogos', 'Auditoría', 'Seguridad']],
    ]);
    expect(etiquetas(adminDeOrganizacion)).not.toContain('Organizaciones');
  });

  /**
   * Un grupo sin entradas visibles no se dibuja.
   *
   * Hoy le toca a «Reportes y dashboards», cuyas dos entradas están fuera de fase 1. La
   * alternativa —mostrar Reportes para que el grupo tenga algo— habría sacado a una pantalla de su
   * fase para rellenar un encabezado, que es dejar que la decoración mande sobre el alcance.
   */
  it('un grupo sin entradas visibles no aparece', () => {
    for (const audience of [superAdmin(false), superAdmin(true), adminDeOrganizacion]) {
      expect(grupos(audience)).not.toContain('Reportes y dashboards');

      for (const group of visibleNavigation(audience)) {
        expect(group.items.length, `Grupo vacío en el menú: ${group.label}`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * No es sólo Reportes: fuera de una organización, Operación se queda sin ninguna de sus cuatro
   * entradas. Es el caso que hace de la regla algo general y no un parche para un grupo.
   */
  it('Operación desaparece mientras no hay organización activa', () => {
    expect(grupos(superAdmin(false))).not.toContain('Operación');
    expect(grupos(superAdmin(true))).toContain('Operación');
    expect(grupos(adminDeOrganizacion)).toContain('Operación');
  });

  it('el grupo declarado existe aunque hoy no se dibuje, para que volver sea quitar una marca', () => {
    const reportes = GESTIA_NAVIGATION.find((group) => group.label === 'Reportes y dashboards');

    expect(reportes?.items.map((item) => item.label)).toEqual(['Monitor global', 'Reportes']);
  });

  /**
   * La regresión concreta del duplicado. `/seguridad` y `/usuarios` se llaman igual, y antes el
   * super admin dentro de una organización veía las dos: `hideForPlatformAdmin` sólo escondía
   * mientras no hubiera organización activa. Ocultar `/usuarios` siempre habría dejado al admin de
   * organización sin la entrada, que el bosquejo sí le da.
   */
  it('Seguridad aparece una sola vez en los tres estados', () => {
    for (const audience of [superAdmin(false), superAdmin(true), adminDeOrganizacion]) {
      const seguridad = visibleNavigationItems(audience).filter((item) => item.label === 'Seguridad');

      expect(seguridad).toHaveLength(1);
    }
  });

  it('cada rol llega a su propia Seguridad', () => {
    const ruta = (audience: NavigationAudience) =>
      visibleNavigationItems(audience).find((item) => item.label === 'Seguridad')?.route;

    expect(ruta(superAdmin(false))).toBe('/seguridad');
    expect(ruta(superAdmin(true))).toBe('/seguridad');
    expect(ruta(adminDeOrganizacion)).toBe('/usuarios');
  });

  it('Auditoría queda visible dentro de una organización, y sólo ahí', () => {
    expect(etiquetas(superAdmin(true))).toContain('Auditoría');
    expect(etiquetas(adminDeOrganizacion)).toContain('Auditoría');
    expect(etiquetas(superAdmin(false))).not.toContain('Auditoría');
  });

  /**
   * Ocultar, no borrar. Si estas rutas desaparecieran, volver a mostrar el módulo dejaría de ser
   * quitar una marca y pasaría a ser rehacer trabajo.
   */
  it('los módulos fuera de fase 1 no se ven, y sus rutas siguen registradas', () => {
    const fase2 = GESTIA_NAVIGATION_ITEMS.filter((item) => item.phase === 2);

    expect(fase2.map((item) => item.label)).toEqual([
      'Solicitudes',
      'Monitor global',
      'Reportes',
      'Reglas documentales',
    ]);

    for (const item of fase2) {
      expect(etiquetas(superAdmin(true))).not.toContain(item.label);
      expect(etiquetas(adminDeOrganizacion)).not.toContain(item.label);
      expect(rutasRegistradas.has(item.route)).toBe(true);
    }
  });

  it('toda entrada visible apunta a una ruta que el enrutador conoce', () => {
    // Una ruta con parámetro cubre a todas sus hijas: `/operacion/asistencia` cae en
    // `operacion/:section`, y `/catalogos/puestos` en `catalogos/:catalogo`.
    const conocida = (route: string) =>
      rutasRegistradas.has(route) ||
      rutasRegistradas.has(`/${route.split('/')[1]}/:section`) ||
      rutasRegistradas.has(`/${route.split('/')[1]}/:catalogo`);

    for (const audience of [superAdmin(false), superAdmin(true), adminDeOrganizacion]) {
      for (const item of visibleNavigationItems(audience)) {
        expect(conocida(item.route), `Ruta sin registrar: ${item.route}`).toBe(true);

        // Y los hijos igual. Sin esto, agregar una entrada al submenú apuntando a una página que
        // todavía no existe pasaría la prueba y llegaría a producción como un renglón que no hace
        // nada. Es exactamente lo que puede ocurrir mientras el rediseño avanza por bloques.
        for (const bloque of item.children ?? []) {
          for (const hijo of bloque.items) {
            expect(conocida(hijo.route), `Ruta de submenú sin registrar: ${hijo.route}`).toBe(true);
          }
        }
      }
    }
  });

  /**
   * El submenú de Catálogos y las páginas de catálogo dicen lo mismo.
   *
   * <p>El menú vive en `core` y las páginas en `features`, y esa dirección no se invierte: el menú
   * no importa la definición de las pantallas. El precio es que las rutas están escritas dos veces,
   * y esta prueba es lo que impide que se separen. Sin ella, renombrar un `slug` dejaría el menú
   * apuntando a una dirección que ya no responde.</p>
   *
   * <p>Se comparan sólo las que son listas simples: Patrones de turno y Reglas de elegibilidad
   * tienen pantalla propia y no salen de `CATALOG_PAGE_GROUPS`.</p>
   */
  it('el submenú de Catálogos coincide con las páginas de catálogo que existen', () => {
    const catalogos = GESTIA_NAVIGATION_ITEMS.find((item) => item.route === '/catalogos');
    const enElMenu = (catalogos?.children ?? [])
      .flatMap((bloque) => bloque.items)
      .map((hijo) => hijo.route)
      .filter((route) => route !== '/catalogos/patrones-de-turno' && route !== '/catalogos/reglas-de-elegibilidad');

    const enLasPaginas = CATALOG_PAGE_GROUPS.flatMap((grupo) => grupo.pages).map(
      (pagina) => `/catalogos/${pagina.slug}`,
    );

    expect([...enElMenu].sort()).toEqual([...enLasPaginas].sort());
  });

  /**
   * Un permiso que falta esconde la entrada aunque el rol tenga organización. Es la mitad del
   * filtrado que ya existía y que esta tanda no debía romper: el menú dice a dónde puedes ir, no
   * qué puedes hacer ahí.
   */
  it('sin el permiso, la entrada no se ofrece', () => {
    const sinPersonal: NavigationAudience = {
      ...adminDeOrganizacion,
      hasPermission: (permission) =>
        permission !== 'WORKFORCE.READ' && PERMISOS_ADMIN_ORGANIZACION.includes(permission),
    };

    expect(etiquetas(sinPersonal)).not.toContain('Personal');
    expect(etiquetas(sinPersonal)).toContain('Clientes');
  });

  /**
   * Los cuatro grupos, en su orden, con el catálogo completo de entradas incluidas las ocultas.
   *
   * Es la prueba que fija la forma del menú. Una entrada nueva tiene que entrar en un grupo, y
   * mover una de grupo es un cambio visible aquí y no un renglón que se cuela en el diff.
   */
  it('el menú declara cuatro grupos y ninguna entrada queda fuera de ellos', () => {
    expect(GESTIA_NAVIGATION.map((group) => group.label)).toEqual([
      'Principal',
      'Operación',
      'Reportes y dashboards',
      'Configuración',
    ]);

    expect(GESTIA_NAVIGATION_ITEMS).toHaveLength(17);
    expect(GESTIA_NAVIGATION_ITEMS.every((item) => typeof item.route === 'string')).toBe(true);
  });

  /**
   * Dos entradas no pueden compartir ruta: el `track` del menú es la ruta, y `routerLinkActive`
   * marcaría las dos. Las dos Seguridad se llaman igual pero apuntan a rutas distintas, que es
   * justo lo que las hace convivir.
   */
  it('ninguna ruta se repite entre entradas', () => {
    const rutas = GESTIA_NAVIGATION_ITEMS.map((item) => item.route);

    expect(new Set(rutas).size).toBe(rutas.length);
  });

  /**
   * Los hijos de una entrada se filtran por permiso igual que las entradas de primer nivel.
   *
   * <p>Es la razón de ser del submenú como concepto del modelo y no como adorno de la plantilla:
   * si los hijos no pasaran por el mismo filtro, el menú ofrecería puertas cerradas.</p>
   */
  it('poda los hijos que el usuario no puede ver, y el bloque que se queda sin ninguno', () => {
    const conHijos = [
      {
        label: 'Configuración',
        items: [
          {
            label: 'Catálogos',
            icon: 'catalog' as const,
            route: '/catalogos',
            permission: 'CATALOGS.READ',
            children: [
              {
                label: 'Personal',
                items: [
                  { label: 'Puestos', route: '/catalogos/puestos' },
                  { label: 'Reservado', route: '/catalogos/reservado', permission: 'PLATFORM.ADMIN' },
                ],
              },
              {
                label: 'Sólo plataforma',
                items: [{ label: 'Otro', route: '/catalogos/otro', permission: 'PLATFORM.ADMIN' }],
              },
            ],
          },
        ],
      },
    ];

    const [configuracion] = visibleNavigation(adminDeOrganizacion, conHijos);
    const catalogos = configuracion.items[0];

    expect(catalogos.children?.map((bloque) => bloque.label)).toEqual(['Personal']);
    expect(catalogos.children?.[0].items.map((hijo) => hijo.label)).toEqual(['Puestos']);
  });

  /**
   * El control de la anterior: un padre que se queda sin hijos visibles <b>no desaparece</b>.
   *
   * <p>Sin esta prueba, podar hijos y podar grupos vacíos se parecen tanto que es fácil aplicar la
   * segunda regla al padre y dejar sin Catálogos a quien sí puede entrar. Un padre tiene ruta
   * propia; un grupo no.
   */
  it('un padre sin hijos visibles sigue estando, porque tiene ruta propia', () => {
    const conHijos = [
      {
        label: 'Configuración',
        items: [
          {
            label: 'Catálogos',
            icon: 'catalog' as const,
            route: '/catalogos',
            permission: 'CATALOGS.READ',
            children: [
              {
                label: 'Sólo plataforma',
                items: [{ label: 'Otro', route: '/catalogos/otro', permission: 'PLATFORM.ADMIN' }],
              },
            ],
          },
        ],
      },
    ];

    const [configuracion] = visibleNavigation(adminDeOrganizacion, conHijos);

    expect(configuracion.items.map((item) => item.label)).toEqual(['Catálogos']);
    expect(configuracion.items[0].children).toEqual([]);
  });
});
