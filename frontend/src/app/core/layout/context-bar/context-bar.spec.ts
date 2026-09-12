import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth/auth.service';
import { AuthSession } from '../../auth/auth.models';
import { ContextBar } from './context-bar';

const ALFA = { idOrganization: 'org-a', codeOrganization: 'ALFA', legalName: 'Alfa Seguridad Privada' };
const BETA = { idOrganization: 'org-b', codeOrganization: 'BETA', legalName: 'Beta Custodia' };
const NUEVA = { idOrganization: 'org-c', codeOrganization: 'ORG-03', legalName: 'Empresa recien dada de alta' };

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

  /** Monta la barra con una sesión ya iniciada. */
  function montar(
    permissions: readonly string[],
    organizations: readonly (typeof ALFA)[],
    options: { readonly platformOrganizations?: readonly (typeof ALFA)[] } = {},
  ) {
    const auth = TestBed.inject(AuthService);

    auth.login({ email: 'admin@gestia.local', password: 'x' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(session(permissions, organizations));

    if (options.platformOrganizations) {
      auth.loadPlatformOrganizations().subscribe();
      http.expectOne('/api/v1/organizations').flush(options.platformOrganizations);
    }

    const fixture = TestBed.createComponent(ContextBar);
    fixture.detectChanges();

    return { fixture, auth, raiz: fixture.nativeElement as HTMLElement };
  }

  /**
   * La fecha operativa se retiró de la barra el 6 de septiembre de 2026: era un rótulo del cromo,
   * repetido igual en las quince pantallas y sin decir nada de lo que se estaba mirando. La barra
   * queda con la organización activa y el botón de salir.
   *
   * Que ya no pida `system/info` es parte de la misma comprobación: la barra nunca fue la fuente
   * del día operativo, sólo uno de sus lectores, y al dejar de leerlo deja también de pedirlo.
   * `verify()` fallaría si lo siguiera pidiendo.
   */
  it('no lleva fecha operativa, ni la pide', () => {
    const { raiz } = montar(['CLIENTS.READ'], [ALFA]);

    expect(raiz.textContent).not.toContain('Fecha operativa');
    expect(raiz.textContent).not.toMatch(/\d{2} \w{3} \d{4}/);
    http.expectNone('/api/v1/system/info');
    http.verify();
  });

  /**
   * La lista se refresca al desplegarla.
   *
   * <p>Se cargaba <b>una sola vez</b>, al construir el shell, asi que una organizacion dada de alta
   * despues no aparecia aqui hasta recargar la pagina entera. Y no habia nada que lo delatara: el
   * desplegable se abria con normalidad y simplemente le faltaba una.</p>
   */
  it('al abrir el desplegable vuelve a pedir la lista, y aparece lo recien creado', () => {
    const { raiz, fixture } = montar(['PLATFORM.ADMIN'], [ALFA], {
      platformOrganizations: [ALFA, BETA],
    });

    expect(raiz.textContent).not.toContain('Empresa recien dada de alta');

    raiz.querySelector<HTMLButtonElement>('gi-select button')!.click();
    fixture.detectChanges();

    http.expectOne('/api/v1/organizations').flush([ALFA, BETA, NUEVA]);
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Empresa recien dada de alta');
  });

  /**
   * Y si el refresco falla no se vacia la lista: quien abrio el desplegable queria cambiar de
   * organizacion, y dejarlo sin opciones porque la peticion no llego seria peor que enseñarle una
   * que quiza no incluye la ultima.
   */
  it('si el refresco falla se queda con las opciones que ya tenía', () => {
    const { raiz, fixture } = montar(['PLATFORM.ADMIN'], [ALFA], {
      platformOrganizations: [ALFA, BETA],
    });

    raiz.querySelector<HTMLButtonElement>('gi-select button')!.click();
    fixture.detectChanges();

    http.expectOne('/api/v1/organizations').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Alfa Seguridad Privada');
    expect(raiz.textContent).toContain('Beta Custodia');
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
