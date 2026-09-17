import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientsPage } from './clients-page';

const ORGANIZACION = { idOrganization: 'org-a', codeOrganization: 'ORG-01', legalName: 'Empresa de prueba' };

/**
 * La pantalla de Clientes de una organización recién creada.
 *
 * <p>Lo que se fija aquí es que <b>se carga una vez</b>. El efecto que recargaba al cambiar de
 * organización llamaba a <c>load()</c>, y un efecto se suscribe a todas las señales que se leen
 * mientras corre —incluidas las que lee el método al que llama—. <c>load()</c> consultaba la lista
 * de puestos y, si estaba vacía, pedía el catálogo; la respuesta hacía <c>jobPositions.set([...])</c>
 * con un arreglo nuevo aunque viniera vacío, el efecto se despertaba y volvía a llamar a
 * <c>load()</c>.</p>
 *
 * <p>En una organización con puestos eso era una carga de más. En una <b>recién creada</b>, que no
 * tiene ninguno, la pantalla se quedaba recargando para siempre y parpadeaba sin parar, que es
 * exactamente lo que se reportó.</p>
 */
describe('Clientes · carga inicial', () => {
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
            session: () => ({ permissions: ['CLIENTS.READ', 'CLIENTS.WRITE'] }),
          },
        },
      ],
    });

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ClientsPage);
    fixture.detectChanges();

    return { fixture, http };
  }

  /**
   * El alta se abre <b>encima</b>, no en el panel lateral.
   *
   * <p>El panel comprime la tabla para no perder de vista donde estabas, y eso sirve al abrir un
   * registro que ya existe: se compara con la lista. Un alta no se compara con nada, y ahi la lista
   * comprimida solo le quitaba sitio a un formulario que lo necesita.</p>
   */
  it('«Nuevo cliente» abre en ventana emergente, no en el panel lateral', () => {
    const { fixture, http } = montar();

    http.match((r) => r.url === '/api/v1/clients')
      .forEach((r) => r.flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 }));
    http.match(() => true).forEach((r) => r.flush([]));
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.modal-backdrop')).toBeNull();

    (fixture.componentInstance as unknown as { startCreate(): void }).startCreate();
    fixture.detectChanges();

    const ventana = raiz.querySelector('.modal-backdrop .modal[role="dialog"]');
    expect(ventana).not.toBeNull();
    expect(ventana!.querySelector('app-client-form')).not.toBeNull();
    // Y no queda un panel lateral con el alta dentro.
    expect(raiz.querySelector('gi-detail-panel app-client-form')).toBeNull();
  });

  it('una organización sin puestos no deja la pantalla recargándose sin parar', () => {
    const { fixture, http } = montar();

    // Primera vuelta: la lista, los municipios y el catálogo de puestos.
    const listas = http.match((r) => r.url === '/api/v1/clients');
    expect(listas).toHaveLength(1);
    listas[0].flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });

    http.match((r) => r.url.includes('municipalities')).forEach((r) => r.flush([]));

    // Los dos catálogos vuelven VACÍOS —puestos y categorías de documento—, que es el caso de una
    // organización recién creada. Antes, ese arreglo nuevo despertaba al efecto y arrancaba la
    // vuelta siguiente.
    const catalogos = http.match((r) => r.url === '/api/v1/catalogs/items');
    expect(catalogos).toHaveLength(2);
    catalogos.forEach((r) => r.flush([]));
    fixture.detectChanges();

    // Y aquí está el veredicto: nadie volvió a pedir la lista.
    expect(http.match((r) => r.url === '/api/v1/clients')).toHaveLength(0);
    expect(http.match((r) => r.url === '/api/v1/catalogs/items')).toHaveLength(0);

    http.verify({ ignoreCancelled: true });
  });
});
