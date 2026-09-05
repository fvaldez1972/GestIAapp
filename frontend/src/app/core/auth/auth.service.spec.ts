import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AuthSession } from './auth.models';

const legacySupportSessionStorageKey = 'gestia.auth.supportSession';

function session(permissions: readonly string[], organizations: readonly { idOrganization: string; codeOrganization: string; legalName: string }[]): AuthSession {
  return {
    accessToken: 'token',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { idUser: 'user', email: 'admin@gestia.local', displayName: 'Admin' },
    organizations,
    permissions,
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('borra el rastro del modo soporte eliminado al arrancar', () => {
    localStorage.setItem(legacySupportSessionStorageKey, JSON.stringify({ idSupportSession: 'vieja' }));

    TestBed.inject(AuthService);

    expect(localStorage.getItem(legacySupportSessionStorageKey)).toBeNull();
  });

  it('deja al super admin fuera de toda organización hasta que elige una', () => {
    const service = TestBed.inject(AuthService);
    const organizations = [{ idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Alfa' }];

    service.login({ email: 'admin@gestia.local', password: 'x' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush(session(['PLATFORM.ADMIN'], organizations));

    expect(service.isPlatformAdmin()).toBe(true);
    expect(service.activeOrganizationId()).toBe('');
    expect(service.activeOrganization()).toBeNull();
    expect(service.resolveOperationalOrganizationId(organizations)).toBe('');
  });

  it('permite al super admin entrar a cualquier organización de la plataforma y salir', () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    service.login({ email: 'admin@gestia.local', password: 'x' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush(
      session(['PLATFORM.ADMIN'], [{ idOrganization: 'org-propia', codeOrganization: 'P', legalName: 'Propia' }]),
    );

    // Organizaciones de plataforma: incluyen una donde el super admin no tiene membresía.
    service.loadPlatformOrganizations().subscribe();
    http.expectOne('/api/v1/organizations').flush([
      { idOrganization: 'org-propia', codeOrganization: 'P', legalName: 'Propia' },
      { idOrganization: 'org-ajena', codeOrganization: 'X', legalName: 'Ajena' },
    ]);

    service.setActiveOrganization('org-ajena');

    expect(service.activeOrganization()?.legalName).toBe('Ajena');
    expect(localStorage.getItem('gestia.auth.activeOrganizationId')).toBe('org-ajena');

    service.clearActiveOrganization();

    expect(service.activeOrganization()).toBeNull();
    expect(localStorage.getItem('gestia.auth.activeOrganizationId')).toBeNull();
  });

  it('el admin de organización sólo puede elegir entre las suyas', () => {
    const service = TestBed.inject(AuthService);
    const organizations = [{ idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Alfa' }];

    service.login({ email: 'admin@alfa.mx', password: 'x' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush(session(['CLIENTS.READ'], organizations));

    expect(service.activeOrganization()?.idOrganization).toBe('org-a');

    service.setActiveOrganization('org-ajena');

    expect(service.activeOrganization()?.idOrganization).toBe('org-a');
  });

  /**
   * La regresión de la deriva. Antes, `resolveOperationalOrganizationId` consultaba la lista que
   * le pasaba cada pantalla y, si la organización activa no estaba en ella, caía en silencio a la
   * primera de esa lista. Dos pantallas con listas distintas resolvían organizaciones distintas
   * partiendo del mismo valor activo, y por eso la barra decía una cosa y la pantalla otra.
   */
  it('dos pantallas con listas distintas resuelven la misma organización', () => {
    const service = TestBed.inject(AuthService);
    const propias = [
      { idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Alfa' },
      { idOrganization: 'org-b', codeOrganization: 'B', legalName: 'Beta' },
    ];

    service.login({ email: 'admin@alfa.mx', password: 'x' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush(session(['CLIENTS.READ'], propias));

    service.setActiveOrganization('org-b');

    // Una pantalla que todavía no terminó de cargar y sólo conoce la primera organización.
    const listaIncompleta = [propias[0]];

    expect(service.operationalOrganizationId()).toBe('org-b');
    expect(service.resolveOperationalOrganizationId(propias)).toBe('org-b');
    expect(service.resolveOperationalOrganizationId(listaIncompleta)).toBe('org-b');
    expect(service.resolveOperationalOrganizationId([])).toBe('org-b');
  });

  it('la organización activa no se puede escribir desde fuera del servicio', () => {
    const service = TestBed.inject(AuthService);

    expect((service.activeOrganizationId as { set?: unknown }).set).toBeUndefined();
  });
});
