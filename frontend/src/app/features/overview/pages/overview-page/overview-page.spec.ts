import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { asunto, indicador, overview } from '../../ui/overview-fixtures';
import { OverviewPage } from './overview-page';

const ORGANIZACION = { idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Seguridad Vanguardia' };

function configurar(organizationId: string) {
  const activa = signal(organizationId);

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          operationalOrganizationId: activa,
          activeOrganization: () => (organizationId ? ORGANIZACION : null),
          isPlatformAdmin: () => !organizationId,
          hasPermission: () => true,
          session: () => ({ permissions: [] }),
        },
      },
    ],
  });

  return activa;
}

describe('Inicio', () => {
  afterEach(() => TestBed.resetTestingModule());

  function montar(organizationId = 'org-a') {
    configurar(organizationId);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OverviewPage);
    fixture.detectChanges();

    return { http, fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  /**
   * La razón de que exista el endpoint. Antes eran ocho peticiones en paralelo, y la primera
   * impresión del producto no puede ser una espera.
   */
  it('pide todo en una sola petición, con la organización heredada del contexto', () => {
    const { http, fixture } = montar();

    const request = http.expectOne((r) => r.url === '/api/v1/overview');
    expect(request.request.params.get('organizationId')).toBe('org-a');

    request.flush(overview(3, { metrics: [indicador()], attention: [asunto()] }));
    fixture.detectChanges();

    http.expectNone(() => true);
    http.verify();
  });

  /**
   * El caso que no estaba en las cuatro vistas del bosquejo: el super admin antes de entrar a una
   * organización. **No es un tablero en ceros**, es que falta un prerrequisito.
   */
  it('el super admin sin organización no pide nada y dice qué le falta', () => {
    const { http, raiz } = montar('');

    http.expectNone(() => true);
    expect(raiz.textContent).toContain('Elige una organización para ver su inicio');
    expect(raiz.querySelector('gi-empty-state')).not.toBeNull();
    http.verify();
  });

  /**
   * Con el camino ocupando el cuerpo no se dibuja tablero: un cero ahí no sería un dato, sería la
   * ausencia de configuración.
   */
  it('recién creada, el camino ocupa el cuerpo y no hay tablero', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview').flush(overview(0));
    fixture.detectChanges();

    expect(raiz.querySelector('app-setup-path')).not.toBeNull();
    expect(raiz.querySelector('app-overview-metrics')).toBeNull();
    expect(raiz.querySelector('app-attention-list')).toBeNull();
    expect(raiz.textContent).toContain('Configuración inicial de Seguridad Vanguardia');
    http.verify();
  });

  it('a medias aparece el tablero, y el camino sigue arriba', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview')
      .flush(overview(3, { metrics: [indicador()], attention: [asunto()] }));
    fixture.detectChanges();

    expect(raiz.querySelector('app-setup-path')).not.toBeNull();
    expect(raiz.querySelector('app-overview-metrics')).not.toBeNull();
    expect(raiz.textContent).toContain('Faltan 4 pasos');
    http.verify();
  });

  it('completa, el título deja de hablar de configuración y nombra la semana', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview').flush(overview(7));
    fixture.detectChanges();

    expect(raiz.querySelector('.overview__title')?.textContent?.trim()).toBe('Seguridad Vanguardia');
    expect(raiz.textContent).toContain('Semana del 07 sep 2026 al 13 sep 2026');
    http.verify();
  });

  /** La portada no puede quedarse en blanco: si falla, lo dice y deja volver a intentar. */
  it('si la lectura falla, lo dice y ofrece reintentar sin perder el menú', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview')
      .flush({ title: 'Error' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(raiz.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo leer el estado de la organización');

    raiz.querySelector<HTMLButtonElement>('.overview__retry')!.click();
    http.expectOne((r) => r.url === '/api/v1/overview').flush(overview(7));
    fixture.detectChanges();

    expect(raiz.querySelector('[role="alert"]')).toBeNull();
    http.verify();
  });
});
