import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth/auth.service';
import { AuthSession } from '../../auth/auth.models';
import { ContextBar } from './context-bar';

const ALFA = { idOrganization: 'org-a', codeOrganization: 'ALFA', legalName: 'Alfa Seguridad Privada' };
const BETA = { idOrganization: 'org-b', codeOrganization: 'BETA', legalName: 'Beta Custodia' };

function session(permissions: readonly string[], organizations: readonly (typeof ALFA)[]): AuthSession {
  return {
    accessToken: 'token',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { idUser: 'user', email: 'admin@gestia.local', displayName: 'Renata Villaseñor' },
    organizations,
    permissions,
  };
}

describe('ContextBar', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  /**
   * Monta la barra con una sesión ya iniciada. La consulta de `system/info` se responde aquí
   * porque el servicio la lanza al construirse, y una petición sin atender hace fallar `verify()`.
   */
  function montar(
    permissions: readonly string[],
    organizations: readonly (typeof ALFA)[],
    options: { readonly platformOrganizations?: readonly (typeof ALFA)[]; readonly operationDate?: string | null } = {},
  ) {
    const auth = TestBed.inject(AuthService);

    auth.login({ email: 'admin@gestia.local', password: 'x' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(session(permissions, organizations));

    if (options.platformOrganizations) {
      auth.loadPlatformOrganizations().subscribe();
      http.expectOne('/api/v1/organizations').flush(options.platformOrganizations);
    }

    const fixture = TestBed.createComponent(ContextBar);
    const info = http.expectOne('/api/v1/system/info');

    if (options.operationDate === null) {
      info.error(new ProgressEvent('error'));
    } else {
      info.flush({
        application: 'GestIA',
        apiVersion: 'v1',
        status: 'ready',
        persistence: 'SQL Server',
        operationDate: options.operationDate ?? '2026-09-04',
        timeZoneId: 'America/Mexico_City',
      });
    }

    fixture.detectChanges();

    return { fixture, auth, raiz: fixture.nativeElement as HTMLElement };
  }

  it('muestra la fecha operativa del servidor en el único formato de la aplicación', () => {
    const { raiz } = montar(['CLIENTS.READ'], [ALFA]);

    expect(raiz.textContent).toContain('Fecha operativa');
    expect(raiz.textContent).toContain('04 sep 2026');
  });

  /**
   * Si el servidor no contesta, la barra dice que no sabe la fecha. Una fecha inventada por el
   * navegador sería peor: quien la lee decide con ella, y en UTC el día cambia seis horas antes.
   */
  it('no inventa una fecha cuando el servidor no responde', () => {
    const { raiz } = montar(['CLIENTS.READ'], [ALFA], { operationDate: null });

    expect(raiz.textContent).toContain('Sin fecha');
    expect(raiz.textContent).not.toMatch(/\d{2} \w{3} \d{4}/);
  });

  it('con una sola organización muestra el nombre y no ofrece cambiarla', () => {
    const { raiz } = montar(['CLIENTS.READ'], [ALFA]);

    expect(raiz.textContent).toContain('Alfa Seguridad Privada');
    expect(raiz.querySelector('gi-select')).toBeNull();
    expect(raiz.querySelector('button[aria-label="Salir de la organización"]')).toBeNull();
  });

  it('el super admin fuera de toda organización lo ve dicho y puede entrar a una', () => {
    const { raiz, auth, fixture } = montar(['PLATFORM.ADMIN'], [ALFA], {
      platformOrganizations: [ALFA, BETA],
    });

    expect(auth.activeOrganization()).toBeNull();
    expect(raiz.textContent).toContain('Sin organización');
    // Salir no aparece cuando no se está dentro de ninguna: no habría de dónde salir.
    expect(raiz.querySelector('button[aria-label="Salir de la organización"]')).toBeNull();

    const disparador = raiz.querySelector<HTMLButtonElement>('gi-select button')!;
    disparador.click();
    fixture.detectChanges();

    const opciones = Array.from(raiz.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(
      opciones.map((o) => o.querySelector('.gi-select__option-label')?.textContent?.trim()),
    ).toEqual(['Alfa Seguridad Privada', 'Beta Custodia']);

    // El código acompaña al nombre para desempatar dos razones sociales parecidas.
    expect(
      opciones.map((o) => o.querySelector('.gi-select__option-hint')?.textContent?.trim()),
    ).toEqual(['ALFA', 'BETA']);

    opciones[1].click();
    fixture.detectChanges();

    expect(auth.activeOrganization()?.legalName).toBe('Beta Custodia');
    expect(localStorage.getItem('gestia.auth.activeOrganizationId')).toBe('org-b');
  });

  it('el super admin dentro de una organización puede salir sin cerrar sesión', () => {
    const { raiz, auth, fixture } = montar(['PLATFORM.ADMIN'], [ALFA], {
      platformOrganizations: [ALFA, BETA],
    });

    auth.setActiveOrganization('org-a');
    fixture.detectChanges();

    const salir = raiz.querySelector<HTMLButtonElement>('button[aria-label="Salir de la organización"]')!;
    expect(salir).not.toBeNull();

    salir.click();
    fixture.detectChanges();

    expect(auth.activeOrganization()).toBeNull();
    expect(auth.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('gestia.auth.activeOrganizationId')).toBeNull();
  });

  it('cada dato de la barra tiene su etiqueta asociada', () => {
    const { raiz } = montar(['CLIENTS.READ'], [ALFA]);

    for (const valor of Array.from(raiz.querySelectorAll('[aria-labelledby]'))) {
      const etiqueta = raiz.querySelector(`#${valor.getAttribute('aria-labelledby')}`);
      expect(etiqueta?.textContent?.trim()).toBeTruthy();
    }
  });

  it('no usa el select nativo del sistema', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], { platformOrganizations: [ALFA, BETA] });

    expect(raiz.querySelector('select')).toBeNull();
  });
});
