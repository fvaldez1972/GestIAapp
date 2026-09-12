import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { WorkforcePage } from './workforce-page';

const ORGANIZACION = { idOrganization: 'org-a', codeOrganization: 'ORG-01', legalName: 'Empresa de prueba' };

/**
 * La carga de la pantalla de Personal.
 *
 * <p>Lo que se fija es que buscar pide la lista <b>una vez</b>. El efecto que recarga al cambiar de
 * organización llamaba a <c>load()</c>, y un efecto se suscribe a todas las señales que se leen
 * mientras corre: <c>load()</c> consulta la búsqueda y los cuatro filtros, así que escribir una
 * letra llamaba a <c>load()</c> desde <c>onSearch</c> y otra vez desde el efecto.</p>
 *
 * <p>Es el mismo defecto que dejaba Clientes parpadeando; aquí no llegaba a ciclo infinito porque
 * ninguna de esas señales se escribe al cargar, pero la causa es la misma.</p>
 */
describe('Personal · carga', () => {
  afterEach(() => TestBed.resetTestingModule());

  function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            operationalOrganizationId: signal('org-a'),
            activeOrganization: () => ORGANIZACION,
            hasPermission: () => true,
            session: () => ({ permissions: ['WORKFORCE.READ', 'WORKFORCE.WRITE'] }),
          },
        },
      ],
    });

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(WorkforcePage);
    fixture.detectChanges();

    const empleados = () => http.match((r) => r.url === '/api/v1/employees/search');
    const responder = () =>
      empleados().forEach((r) =>
        r.flush({
          page: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
          expiringWithinDays: 30,
          requiredDocuments: [],
        }),
      );

    /** Todo lo demas que la pantalla pide al entrar, cada cosa con la forma que espera. */
    const responderLoDemas = () => {
      http
        .match((r) => r.url.endsWith('/employees/filters'))
        .forEach((r) => r.flush({ jobPositions: [], municipalities: [] }));
      http.match(() => true).forEach((r) => r.flush([]));
    };

    return { fixture, http, empleados, responder, responderLoDemas };
  }

  it('buscar pide la lista una sola vez, no dos por tecla', () => {
    const { fixture, http, empleados, responder, responderLoDemas } = montar();

    expect(empleados()).toHaveLength(1);
    responder();

    responderLoDemas();
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as { onSearch(valor: string): void };
    pagina.onSearch('laura');
    fixture.detectChanges();

    // Antes eran dos: la de `onSearch` y la que disparaba el efecto al cambiar la señal de búsqueda.
    expect(empleados()).toHaveLength(1);
    responder();
    responderLoDemas();
  });
});
