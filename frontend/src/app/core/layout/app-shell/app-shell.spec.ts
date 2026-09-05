import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShell } from './app-shell';

const ALFA = { idOrganization: 'org-a', codeOrganization: 'ALFA', legalName: 'Alfa Seguridad Privada' };
const BETA = { idOrganization: 'org-b', codeOrganization: 'BETA', legalName: 'Beta Custodia' };

const TODOS_LOS_PERMISOS_DE_ORGANIZACION = [
  'USERS.READ',
  'CLIENTS.READ',
  'DOCUMENTS.READ',
  'CATALOGS.READ',
  'WORKFORCE.READ',
  'PLANNING.READ',
  'OPERATIONS.READ',
  'REPORTS.READ',
  'REQUESTS.READ',
  'AUDIT.READ',
];

/** Deja una sesión en el navegador antes de montar, como si el usuario ya hubiera entrado. */
function sesionEnCurso(permissions: readonly string[], organizations: readonly (typeof ALFA)[]) {
  localStorage.setItem(
    'gestia.auth.session',
    JSON.stringify({
      accessToken: 'token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { idUser: 'user', email: 'admin@gestia.local', displayName: 'Renata Villaseñor' },
      organizations,
      permissions,
    }),
  );
}

describe('AppShell', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function montar(
    permissions: readonly string[],
    organizations: readonly (typeof ALFA)[],
    organizacionActiva?: string,
  ) {
    sesionEnCurso(permissions, organizations);

    if (organizacionActiva) {
      localStorage.setItem('gestia.auth.activeOrganizationId', organizacionActiva);
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(AppShell);

    // El super admin pide la lista de organizaciones de la plataforma al construirse el shell.
    if (permissions.includes('PLATFORM.ADMIN')) {
      http.expectOne('/api/v1/organizations').flush([ALFA, BETA]);
    }

    http.expectOne('/api/v1/system/info').flush({
      application: 'GestIA',
      apiVersion: 'v1',
      status: 'ready',
      persistence: 'SQL Server',
      operationDate: '2026-09-04',
      timeZoneId: 'America/Mexico_City',
    });

    fixture.detectChanges();

    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  const entradas = (raiz: HTMLElement) =>
    Array.from(raiz.querySelectorAll('.side-nav .menu-link .menu-text')).map((n) =>
      n.textContent?.trim(),
    );

  /**
   * El contexto de organización se movió a la barra de contexto y el `<select>` nativo se fue con
   * él. El requisito es explícito: selectores con estilo propio, nunca el nativo del sistema.
   */
  it('no queda ningún select nativo en el shell', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA]);

    expect(raiz.querySelector('select')).toBeNull();
    expect(raiz.querySelector('app-context-bar')).not.toBeNull();
  });

  it('la barra de contexto va arriba de la topbar, no dentro de ella', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA]);

    const contenido = raiz.querySelector('.page-content')!;
    const hijos = Array.from(contenido.children).map((n) => n.tagName.toLowerCase());

    expect(hijos[0]).toBe('app-context-bar');
    expect(hijos[1]).toBe('header');
  });

  it('el menú lateral responde a los tres estados', () => {
    const fuera = montar(['PLATFORM.ADMIN'], [ALFA]);
    expect(entradas(fuera.raiz)).toEqual(['Inicio', 'Organizaciones', 'Seguridad']);

    TestBed.resetTestingModule();
    localStorage.clear();

    const dentro = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');
    expect(entradas(dentro.raiz)).toHaveLength(12);

    TestBed.resetTestingModule();
    localStorage.clear();

    const organizacion = montar(TODOS_LOS_PERMISOS_DE_ORGANIZACION, [ALFA]);
    expect(entradas(organizacion.raiz)).toHaveLength(11);
    expect(entradas(organizacion.raiz)).not.toContain('Organizaciones');
  });

  it('el menú es plano: ya no hay títulos de grupo', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    expect(raiz.querySelector('.menu-title')).toBeNull();
    expect(raiz.querySelector('.menu-group')).toBeNull();
  });

  it('la organización no se dice dos veces: sólo la barra de contexto la nombra', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    expect(raiz.querySelector('.workspace-context')).toBeNull();

    const menciones = Array.from(raiz.querySelectorAll('*')).filter(
      (n) => n.children.length === 0 && n.textContent?.includes('Alfa Seguridad Privada'),
    );

    expect(menciones).toHaveLength(1);
  });

  /** Un botón sin texto visible tiene que decir qué hace por otro camino. */
  it('todo botón tiene nombre accesible, incluidos los de sólo icono', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    for (const boton of Array.from(raiz.querySelectorAll('button'))) {
      const nombre = boton.getAttribute('aria-label') ?? boton.textContent?.trim() ?? '';

      expect(nombre.length, `Botón sin nombre accesible: ${boton.className}`).toBeGreaterThan(0);
    }
  });

  it('todo enlace del menú lleva su texto', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    for (const enlace of Array.from(raiz.querySelectorAll('.side-nav .menu-link'))) {
      expect(enlace.querySelector('.menu-text')?.textContent?.trim()).toBeTruthy();
      expect(enlace.getAttribute('href')).toBeTruthy();
    }
  });

  it('la navegación principal está anunciada como tal', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    expect(raiz.querySelector('aside')?.getAttribute('aria-label')).toBe('Navegación principal');
  });
});
