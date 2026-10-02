import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { asunto, indicador, organizacionVacia, overview } from '../../ui/overview-fixtures';
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

    request.flush(overview({ metrics: [indicador()], attention: [asunto()] }));
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
   * El criterio de la pantalla: Inicio es el tablero del administrador de la organización. Si
   * todavía no hay información, se ve sin información; no se convierte en otra pantalla mientras
   * tanto. Una pantalla que cambia de propósito según cuántos datos haya son dos pantallas con un
   * nombre.
   */
  it('recién creada se ve el mismo tablero, sin información', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview').flush(organizacionVacia());
    fixture.detectChanges();

    expect(raiz.querySelector('app-overview-metrics')).not.toBeNull();
    expect(raiz.querySelector('app-attention-list')).not.toBeNull();
    expect(raiz.textContent).toContain('Ninguno tiene información todavía');

    // El título nombra la organización desde el primer día: ya no habla de configuración.
    expect(raiz.querySelector('.overview__title')?.textContent?.trim()).toBe('Seguridad Vanguardia');
    expect(raiz.textContent).not.toContain('Configuración inicial');
    http.verify();
  });

  /**
   * La consecuencia que hay que cuidar: con los cuatro indicadores sin calcular, la lista de
   * atención vacía no puede decir «nada pendiente hoy». Está todo pendiente; lo que pasa es que el
   * sistema todavía no tiene con qué saberlo.
   */
  it('recién creada, la lista de atención no se felicita', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview').flush(organizacionVacia());
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Todavía no hay con qué saberlo');
    expect(raiz.textContent).not.toContain('Nada pendiente hoy');
    http.verify();
  });

  /** Con al menos un indicador calculado, la lista sí puede afirmar que no hay nada pendiente. */
  it('con datos y sin asuntos, la lista sí dice que no hay nada pendiente', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview')
      .flush(overview({ metrics: [indicador()], attention: [] }));
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Nada pendiente hoy');
    expect(raiz.textContent).not.toContain('Todavía no hay con qué saberlo');
    http.verify();
  });

  it('el subtítulo nombra la semana operativa, con datos o sin ellos', () => {
    const { http, fixture, raiz } = montar();

    http.expectOne((r) => r.url === '/api/v1/overview').flush(organizacionVacia());
    fixture.detectChanges();

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
    http.expectOne((r) => r.url === '/api/v1/overview').flush(overview());
    fixture.detectChanges();

    expect(raiz.querySelector('[role="alert"]')).toBeNull();
    http.verify();
  });
});
