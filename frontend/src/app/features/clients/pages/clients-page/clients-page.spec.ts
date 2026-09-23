import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientsPage } from './clients-page';

const ORGANIZACION = { idOrganization: 'org-a', codeOrganization: 'ORG-01', legalName: 'Empresa de prueba' };

/** Una fila de la lista, con los conteos que el servidor resuelve. */
function fila(extra: Record<string, unknown> = {}) {
  return {
    idClient: 'cli-1', idOrganization: 'org-a', codeClient: 'CLI-01',
    legalName: 'Corporativo Altavista, S.A. de C.V.', tradeName: 'Corporativo Altavista',
    rfc: 'CAL180423K72', active: true, createdAt: '2026-02-12T15:00:00Z',
    zoneCount: 3, zonesWithoutContact: 0, contactCount: 4, documentCount: 0, serviceCount: 5,
    mainZoneName: 'Torre Altavista', mainZoneMunicipality: 'Zapopan', mainZoneState: 'Jalisco',
    ...extra,
  };
}

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

  /**
   * La pestaña de Documentos dice cuántos hay <b>antes</b> de abrirla.
   *
   * <p>El contador salía del propio componente de documentos, que sólo existe cuando la pestaña se
   * dibuja: hasta entonces decía cero. O sea que había que abrir la pestaña para saber si tenía
   * algo, que es exactamente lo que un contador viene a evitar. Ahora el número viaja con la fila,
   * como los de Zonas y Contactos, y la pestaña sólo manda cuando ya se abrió.</p>
   */
  it('la pestaña de Documentos trae su número sin abrirla', () => {
    const { fixture, http } = montar();

    http.match((r) => r.url === '/api/v1/clients').forEach((r) =>
      r.flush({
        items: [fila({ documentCount: 2 })],
        totalCount: 1, page: 1, pageSize: 25, totalPages: 1,
      }));
    http.match(() => true).forEach((r) => r.flush([]));
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as {
      open(cliente: unknown): void;
      panelTabs(): readonly { id: string; count?: number }[];
    };
    pagina.open(fila({ documentCount: 2 }));
    fixture.detectChanges();

    const documentos = pagina.panelTabs().find((pestana) => pestana.id === 'documents');
    expect(documentos?.count, 'sin abrir la pestaña').toBe(2);

    // Y el control: las otras dos pestañas siguen contando lo suyo, así que el 2 no es un número
    // que se haya colado en todas.
    expect(pagina.panelTabs().find((p) => p.id === 'zones')?.count).toBe(3);
    expect(pagina.panelTabs().find((p) => p.id === 'contacts')?.count).toBe(4);
  });

  /**
   * La ficha no lleva marco: el panel llega hasta el borde de la ventana.
   *
   * <p>La ventana emergente trae relleno porque los formularios lo necesitan, pero la ficha lleva
   * dentro un <c>gi-detail-panel</c> que ya tiene su propio borde, su radio y su fondo. Con el
   * relleno se veían dos bordes redondeados, uno dentro del otro, con un marco blanco de 1 rem en
   * medio.</p>
   *
   * <p>Se mira el estilo calculado y no la clase: la clase se podía aplicar y que otra regla
   * volviera a poner el relleno, que es un defecto que ya pasó una vez en este proyecto.</p>
   */
  it('la ficha del cliente no deja marco alrededor del panel', () => {
    const { fixture, http } = montar();

    http.match((r) => r.url === '/api/v1/clients').forEach((r) =>
      r.flush({ items: [fila()], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 }));
    http.match(() => true).forEach((r) => r.flush([]));
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { open(c: unknown): void }).open(fila());
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const ficha = raiz.querySelector<HTMLElement>('.modal--ficha')!;
    expect(ficha).not.toBeNull();
    expect(getComputedStyle(ficha).padding).toBe('0px');
    expect(ficha.querySelector('gi-detail-panel')).not.toBeNull();
  });

  it('una organización sin puestos no deja la pantalla recargándose sin parar', () => {
    const { fixture, http } = montar();

    // Primera vuelta: la lista, los municipios y el catálogo de puestos.
    const listas = http.match((r) => r.url === '/api/v1/clients');
    expect(listas).toHaveLength(1);
    listas[0].flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });

    http.match((r) => r.url.includes('municipalities')).forEach((r) => r.flush([]));

    // Los catálogos vuelven VACÍOS, que es el caso de una organización recién creada. Antes, ese
    // arreglo nuevo despertaba al efecto y arrancaba la vuelta siguiente.
    //
    // Son cinco desde el 19 de septiembre de 2026: a los puestos, las categorías de documento y las
    // nacionalidades se suman los puestos de contacto y los propósitos, que son catálogos aparte.
    const catalogos = http.match((r) => r.url === '/api/v1/catalogs/items');
    expect(catalogos).toHaveLength(5);
    catalogos.forEach((r) => r.flush([]));
    fixture.detectChanges();

    // Y aquí está el veredicto: nadie volvió a pedir la lista.
    expect(http.match((r) => r.url === '/api/v1/clients')).toHaveLength(0);
    expect(http.match((r) => r.url === '/api/v1/catalogs/items')).toHaveLength(0);

    http.verify({ ignoreCancelled: true });
  });
});
