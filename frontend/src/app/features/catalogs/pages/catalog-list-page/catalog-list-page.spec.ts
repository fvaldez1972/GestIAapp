import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogItem } from '../../data-access/catalog.models';
import { CATALOG_PAGES } from '../../data-access/catalog-pages';
import { CatalogListPage } from './catalog-list-page';

const valor = (parcial: Partial<CatalogItem>): CatalogItem => ({
  idCatalogItem: 'v1',
  idOrganization: 'org-a',
  type: 'EmployeeEvaluationCategory',
  name: 'Polígrafo',
  description: null,
  active: true,
  order: 1,
  ...parcial,
});

describe('Página de un catálogo', () => {
  let http: HttpTestingController;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function montar(slug: string, permisos: readonly string[] = ['CATALOGS.READ', 'CATALOGS.WRITE']) {
    paramMap = new BehaviorSubject(convertToParamMap({ catalogo: slug }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap, snapshot: { paramMap: paramMap.value } },
        },
        {
          provide: AuthService,
          useValue: {
            operationalOrganizationId: signal('org-a'),
            hasPermission: (permission: string) => permisos.includes(permission),
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CatalogListPage);
    fixture.detectChanges();

    return { fixture, pagina: fixture.componentInstance as unknown as Pagina };
  }

  type Pagina = {
    page(): { title: string; type: string } | undefined;
    columns(): readonly { key: string }[];
    filterGroups(): readonly { id: string }[];
    items: { set(v: readonly CatalogItem[]): void };
    filtradas(): readonly CatalogItem[];
    paginadas(): readonly CatalogItem[];
    totalPaginas(): number;
    search: { set(v: string): void };
    natureFilter: { set(v: '' | 'blocking' | 'informative'): void };
    goToPage(n: number): void;
    natureLabel(item: CatalogItem): string;
    rowActions(item: CatalogItem): readonly { id: string; label: string }[];
  };

  /** Responde las peticiones que la pantalla lanza al montarse, con la lista que se le pase. */
  function responder(items: readonly CatalogItem[], padres: readonly CatalogItem[] = []) {
    for (const peticion of http.match(() => true)) {
      const tipo = peticion.request.params.get('type');
      peticion.flush(tipo === 'EmployeeDocumentGroup' ? padres : items);
    }
  }

  afterEach(() => http.verify());

  it('resuelve el catálogo desde la ruta', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder([]);

    expect(pagina.page()?.title).toBe('Tipos de evaluación');
    expect(pagina.page()?.type).toBe('EmployeeEvaluationCategory');
  });

  /**
   * Una dirección que no corresponde a ningún catálogo no pide datos ni se queda en blanco.
   *
   * <p>Es el control del caso anterior: sin él, «resuelve el catálogo» no distinguiría resolverlo
   * de aceptar cualquier cosa.</p>
   */
  it('una dirección inventada no resuelve ningún catálogo y no pide nada', () => {
    const { pagina } = montar('catalogo-que-no-existe');

    expect(pagina.page()).toBeUndefined();
    http.expectNone(() => true);
  });

  /**
   * La columna de naturaleza y su filtro sólo salen en los catálogos que la llevan.
   *
   * <p>Dibujarla en todos pondría «Informativa» en Puestos o en Motivos de cobertura, donde la
   * marca no significa nada y el servidor la rechaza.</p>
   */
  it('la naturaleza sólo se dibuja donde significa algo', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder([]);

    expect(pagina.columns().map((columna) => columna.key)).toContain('nature');
    expect(pagina.filterGroups().map((grupo) => grupo.id)).toContain('naturaleza');
  });

  it('y no se dibuja en un catálogo que no la lleva', () => {
    const { pagina } = montar('motivos-de-cobertura');
    responder([]);

    expect(pagina.columns().map((columna) => columna.key)).not.toContain('nature');
    expect(pagina.filterGroups().map((grupo) => grupo.id)).not.toContain('naturaleza');
  });

  /** Una entrada sin marca se lee «Informativa», que es lo que el servidor ya hace con el nulo. */
  it('una entrada sin marca se lee informativa', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder([]);

    expect(pagina.natureLabel(valor({ isBlocking: null }))).toBe('Informativa');
    expect(pagina.natureLabel(valor({ isBlocking: false }))).toBe('Informativa');
    expect(pagina.natureLabel(valor({ isBlocking: true }))).toBe('Bloqueante');
  });

  /**
   * Las acciones de una fila son editar y activar o desactivar. **Nunca eliminar.**
   *
   * <p>Aquí nada se borra: un valor que deja de usarse se desactiva, su historial se conserva y su
   * nombre sigue ocupado. Esta prueba está para que «Eliminar» no vuelva por comodidad.</p>
   */
  it('nunca ofrece eliminar', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder([]);

    const acciones = pagina.rowActions(valor({ active: true }));

    expect(acciones.map((accion) => accion.id)).toEqual(['edit', 'toggle']);
    expect(acciones.map((accion) => accion.label)).toEqual(['Editar', 'Desactivar']);
    expect(pagina.rowActions(valor({ active: false })).map((accion) => accion.label))
      .toEqual(['Editar', 'Activar']);
  });

  it('pagina de quince en quince sin pedirle más al servidor', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    const muchos = Array.from({ length: 32 }, (_, i) =>
      valor({ idCatalogItem: `v${i}`, name: `Valor ${i}`, order: i + 1 }),
    );
    responder(muchos);

    expect(pagina.totalPaginas()).toBe(3);
    expect(pagina.paginadas().length).toBe(15);

    pagina.goToPage(3);
    expect(pagina.paginadas().length, 'la última página lleva el resto').toBe(2);

    // Y no hay una segunda petición: la lista vino entera y se corta aquí.
    http.expectNone(() => true);
  });

  it('el buscador mira el nombre y la descripción', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder([
      valor({ idCatalogItem: 'a', name: 'Polígrafo', description: null }),
      valor({ idCatalogItem: 'b', name: 'Médica', description: 'Incluye laboratorio' }),
    ]);

    pagina.search.set('laboratorio');

    expect(pagina.filtradas().map((item) => item.name)).toEqual(['Médica']);
  });

  /** Los dieciséis slugs son únicos: dos iguales dejarían un catálogo inalcanzable. */
  it('ningún slug se repite', () => {
    const slugs = CATALOG_PAGES.map((pagina) => pagina.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
