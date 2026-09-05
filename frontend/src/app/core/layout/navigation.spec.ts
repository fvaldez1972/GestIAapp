import { routes } from '../../app.routes';
import { GESTIA_NAVIGATION, NavigationAudience, visibleNavigation } from './navigation';

/**
 * Permisos del rol ORG_ADMIN según `SecurityDataSeeder`: todos menos `PLATFORM.ADMIN` y
 * `ORGANIZATIONS.WRITE`. Se enumeran aquí para que la prueba falle si el rol cambia de forma
 * y nadie revisó qué pasa con el menú.
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
  visibleNavigation(audience).map((item) => item.label);

/** Las rutas que el enrutador conoce, aplanadas: hijas del shell más las de primer nivel. */
const rutasRegistradas = new Set(
  routes.flatMap((route) => [
    `/${route.path ?? ''}`,
    ...(route.children ?? []).map((child) => `/${child.path ?? ''}`),
  ]),
);

describe('Menú lateral', () => {
  /**
   * Los tres estados con su cuenta exacta. El bosquejo cerrado dice 3 / 11 / 10; aquí son
   * 3 / 12 / 11 porque Auditoría se agregó por decisión posterior al diseño. Si alguien vuelve a
   * mover la cuenta, esta prueba lo dice antes de que nadie abra la aplicación.
   */
  it('el super admin fuera de una organización ve tres entradas', () => {
    expect(etiquetas(superAdmin(false))).toEqual(['Inicio', 'Organizaciones', 'Seguridad']);
  });

  it('el super admin dentro de una organización ve doce', () => {
    expect(etiquetas(superAdmin(true))).toEqual([
      'Inicio',
      'Organizaciones',
      'Catálogos',
      'Clientes',
      'Servicios',
      'Personal',
      'Planeación',
      'Asistencia',
      'Incidencias',
      'Cobertura',
      'Auditoría',
      'Seguridad',
    ]);
  });

  it('el admin de organización ve once: las mismas menos Organizaciones', () => {
    const suyas = etiquetas(adminDeOrganizacion);

    expect(suyas).toEqual([
      'Inicio',
      'Catálogos',
      'Clientes',
      'Servicios',
      'Personal',
      'Planeación',
      'Asistencia',
      'Incidencias',
      'Cobertura',
      'Auditoría',
      'Seguridad',
    ]);
    expect(suyas).not.toContain('Organizaciones');
  });

  /**
   * La regresión concreta del duplicado. `/seguridad` y `/usuarios` se llaman igual, y antes el
   * super admin dentro de una organización veía las dos: `hideForPlatformAdmin` sólo escondía
   * mientras no hubiera organización activa. Ocultar `/usuarios` siempre habría dejado al admin de
   * organización sin la entrada, que el bosquejo sí le da.
   */
  it('Seguridad aparece una sola vez en los tres estados', () => {
    for (const audience of [superAdmin(false), superAdmin(true), adminDeOrganizacion]) {
      const seguridad = visibleNavigation(audience).filter((item) => item.label === 'Seguridad');

      expect(seguridad).toHaveLength(1);
    }
  });

  it('cada rol llega a su propia Seguridad', () => {
    const ruta = (audience: NavigationAudience) =>
      visibleNavigation(audience).find((item) => item.label === 'Seguridad')?.route;

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
    const fase2 = GESTIA_NAVIGATION.filter((item) => item.phase === 2);

    expect(fase2.map((item) => item.label)).toEqual([
      'Monitor global',
      'Solicitudes',
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
    for (const audience of [superAdmin(false), superAdmin(true), adminDeOrganizacion]) {
      for (const item of visibleNavigation(audience)) {
        // `/operacion/asistencia` y sus hermanas caen en la ruta con parámetro `operacion/:section`.
        const conocida =
          rutasRegistradas.has(item.route) ||
          rutasRegistradas.has(`/${item.route.split('/')[1]}/:section`);

        expect(conocida, `Ruta sin registrar: ${item.route}`).toBe(true);
      }
    }
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

  it('es una lista plana: el bosquejo no tiene grupos', () => {
    expect(Array.isArray(GESTIA_NAVIGATION)).toBe(true);
    expect(GESTIA_NAVIGATION.every((item) => typeof item.route === 'string')).toBe(true);
  });
});
