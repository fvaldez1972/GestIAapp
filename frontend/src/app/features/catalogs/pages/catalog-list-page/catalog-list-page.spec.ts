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
    columns(): readonly { key: string; label: string }[];
    naturalezaLabel: string;
    filterGroups(): readonly { id: string; label: string; options: readonly { label: string }[] }[];
    natureOptions: readonly { value: string; label: string }[];
    items: { set(v: readonly CatalogItem[]): void };
    filtradas(): readonly CatalogItem[];
    paginadas(): readonly CatalogItem[];
    totalPaginas(): number;
    rango(): string;
    pageSize(): number;
    currentPage(): number;
    setPageSize(value: string): void;
    pageSizeOptions: readonly { value: string; label: string }[];
    search: { set(v: string): void };
    natureFilter: { set(v: '' | 'blocking' | 'informative'): void };
    goToPage(n: number): void;
    natureLabel(item: CatalogItem): string;
    rowActions(item: CatalogItem): readonly { id: string; label: string }[];
    form: { controls: Record<string, unknown>; patchValue(v: object): void };
    newItem(): void;
    editItem(item: CatalogItem): void;
    save(): void;
  };

  /** Responde las peticiones que la pantalla lanza al montarse, con la lista que se le pase. */
  function responder(items: readonly CatalogItem[], padres: readonly CatalogItem[] = []) {
    for (const peticion of http.match(() => true)) {
      const tipo = peticion.request.params.get('type');
      peticion.flush(tipo === 'EmployeeDocumentGroup' ? padres : items);
    }
  }

  afterEach(() => http.verify());

  /**
   * jsdom no implementa `<dialog>.showModal()`, y abrir el editor es incidental para estas pruebas.
   *
   * <p>Se repone al terminar. Dejarlo fingido en el prototipo se lo lleva puesto cualquier prueba
   * que corra después en el mismo entorno —la del diálogo compartido comprueba justo que abre de
   * verdad—, y como el reparto de archivos entre procesos cambia, el fallo aparece y desaparece
   * sin que nadie haya tocado nada. Ya pasó una vez.</p>
   */
  function fingirDialogo() {
    const original = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) { this.open = true; },
    });
    onTestFinished(() => {
      if (original) {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', original);
      } else {
        delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
      }
    });
  }

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

  /**
   * La naturaleza se llama igual en el desplegable, en la columna y en el filtro.
   *
   * <p>Es lo que esta prueba sujeta: tres sitios que enseñan el mismo dato con tres textos
   * distintos se leen como tres cosas distintas. Las opciones traían la explicación pegada, la
   * columna no, y el filtro tampoco.</p>
   */
  it('la naturaleza se llama igual en el desplegable, la columna y el filtro', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder([]);

    // Los dos valores, con el mismo nombre en los tres sitios.
    const enElDesplegable = pagina.natureOptions.map((opcion) => opcion.label);
    const filtro = pagina.filterGroups().find((grupo) => grupo.id === 'naturaleza')!;
    const enLaColumna = [
      pagina.natureLabel(valor({ isBlocking: true })),
      pagina.natureLabel(valor({ isBlocking: false })),
    ];

    expect(enElDesplegable).toEqual(['Bloqueante', 'Informativa']);
    expect(filtro.options.map((opcion) => opcion.label)).toEqual(enElDesplegable);
    expect(enLaColumna).toEqual(enElDesplegable);

    // Y el rótulo del campo, el de la columna y el del filtro, también el mismo. Es la mitad que se
    // me pasó la primera vez: cambié los valores y dejé la columna llamándose de otra manera.
    const columna = pagina.columns().find((c) => c.key === 'nature')!;

    expect(columna.label).toBe('Informativa/Bloqueante');
    expect(filtro.label).toBe(columna.label);
    expect(pagina.naturalezaLabel).toBe(columna.label);
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

  it('pagina de diez en diez sin pedirle más al servidor', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    const muchos = Array.from({ length: 32 }, (_, i) =>
      valor({ idCatalogItem: `v${i}`, name: `Valor ${i}`, order: i + 1 }),
    );
    responder(muchos);

    expect(pagina.totalPaginas()).toBe(4);
    expect(pagina.paginadas().length).toBe(10);
    expect(pagina.rango()).toBe('1 a 10 de 32');

    pagina.goToPage(4);
    expect(pagina.paginadas().length, 'la última página lleva el resto').toBe(2);
    expect(pagina.rango()).toBe('31 a 32 de 32');

    // Y no hay una segunda petición: la lista vino entera y se corta aquí.
    http.expectNone(() => true);
  });

  /**
   * Los cuatro tamaños que se ofrecen, y que cambiarlos devuelve a la primera página.
   *
   * <p>Sin lo segundo, quien está en la página 4 de 5 y pasa de 10 a 100 se queda en una página que
   * ya no existe y ve una tabla vacía sin entender por qué.</p>
   */
  it('ofrece 5, 10, 50 y 100 por página, y cambiarlo vuelve a la primera', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder(Array.from({ length: 32 }, (_, i) =>
      valor({ idCatalogItem: `v${i}`, name: `Valor ${i}`, order: i + 1 }),
    ));

    expect(pagina.pageSizeOptions.map((opcion) => opcion.value)).toEqual(['5', '10', '50', '100']);

    pagina.goToPage(4);
    expect(pagina.currentPage()).toBe(4);

    pagina.setPageSize('100');

    expect(pagina.pageSize()).toBe(100);
    expect(pagina.currentPage(), 'vuelve a la primera').toBe(1);
    expect(pagina.paginadas().length, 'y caben las treinta y dos').toBe(32);
    expect(pagina.totalPaginas()).toBe(1);
  });

  /** Un tamaño que no está en la lista se ignora: sólo se ofrecen cuatro y sólo valen ésos. */
  it('ignora un tamaño que no se ofrece', () => {
    const { pagina } = montar('tipos-de-evaluacion');
    responder([]);

    pagina.setPageSize('37');

    expect(pagina.pageSize()).toBe(10);
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

  /**
   * El editor ya no pide el orden, y el orden se sigue guardando.
   *
   * <p>Retirado el 21 de septiembre de 2026: no se enseñaba en la tabla y pedía un número que nadie
   * sabía qué significaba. Pero el servidor lo necesita para que la lista salga siempre igual, así
   * que lo pone la pantalla: al crear, detrás del último; al editar, el que ya tenía.</p>
   */
  it('no pide el orden, y aun así lo manda', () => {
    fingirDialogo();
    const { pagina } = montar('tipos-de-evaluacion');
    responder([
      valor({ idCatalogItem: 'a', name: 'Polígrafo', order: 3 }),
      valor({ idCatalogItem: 'b', name: 'Médica', order: 7 }),
    ]);

    expect(Object.keys(pagina.form.controls)).not.toContain('order');

    pagina.newItem();
    pagina.form.patchValue({ name: 'Psicométrica' });
    pagina.save();

    const alta = http.expectOne((peticion) => peticion.method === 'POST');
    expect(alta.request.body.order, 'detrás del último').toBe(8);
    alta.flush(valor({ idCatalogItem: 'c', name: 'Psicométrica', order: 8 }));
    responder([]);
  });

  /** Y al editar conserva el que tenía, en vez de mandarlo al final. */
  it('al editar conserva el orden que ya tenía', () => {
    fingirDialogo();
    const { pagina } = montar('tipos-de-evaluacion');
    responder([
      valor({ idCatalogItem: 'a', name: 'Polígrafo', order: 3 }),
      valor({ idCatalogItem: 'b', name: 'Médica', order: 7 }),
    ]);

    pagina.editItem(valor({ idCatalogItem: 'a', name: 'Polígrafo', order: 3 }));
    pagina.form.patchValue({ name: 'Polígrafo completo' });
    pagina.save();

    const edicion = http.expectOne((peticion) => peticion.method === 'PUT');
    expect(edicion.request.body.order).toBe(3);
    edicion.flush(valor({ idCatalogItem: 'a', name: 'Polígrafo completo', order: 3 }));
    responder([]);
  });

  /** Los slugs son únicos: dos iguales dejarían un catálogo inalcanzable. */
  it('ningún slug se repite', () => {
    const slugs = CATALOG_PAGES.map((pagina) => pagina.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /**
   * Los dos que se retiraron el 21 de septiembre de 2026 ya no se ofrecen.
   *
   * <p>Categorías de documento del personal agrupaba tipos para una lectura por bloques que nunca
   * se construyó. Incidencias administrativas sale del submenú porque «Motivos de incidencia» ya
   * está ahí y dos entradas que empiezan igual se confunden; <b>la incidencia del expediente sigue
   * existiendo y sigue pudiendo bloquear</b>, que es lo que esta prueba no debe hacer creer que se
   * fue.</p>
   */
  it('ni las categorías de documento ni las incidencias administrativas se ofrecen ya', () => {
    const tipos = CATALOG_PAGES.map((pagina) => pagina.type);

    expect(tipos).not.toContain('EmployeeDocumentGroup');
    expect(tipos).not.toContain('AdministrativeIncidentType');
    expect(CATALOG_PAGES.some((pagina) => pagina.parentType), 'ninguno cuelga ya de otro').toBe(false);
  });

  /**
   * Editar un tipo de documento **no borra** el grupo al que pertenece, aunque ya no se vea.
   *
   * <p>Es la trampa de retirar un campo de la vista: el servidor toma `idParentCatalogItem` tal
   * cual, así que dejar de mandarlo lo pondría en nulo, y los 112 tipos de documento se irían
   * soltando de su grupo uno a uno según alguien les corrigiera el nombre. Sin ruido, sin error, y
   * sin forma de saber cuándo empezó.</p>
   */
  it('editar un tipo de documento conserva el grupo que ya tenía', () => {
    fingirDialogo();
    const { pagina } = montar('tipos-de-documento');
    const conGrupo = valor({
      idCatalogItem: 'd1',
      type: 'EmployeeDocumentCategory',
      name: 'INE',
      order: 4,
      idParentCatalogItem: 'grupo-identidad',
    });
    responder([conGrupo]);

    pagina.editItem(conGrupo);
    pagina.form.patchValue({ name: 'INE vigente' });
    pagina.save();

    const edicion = http.expectOne((peticion) => peticion.method === 'PUT');
    expect(edicion.request.body.idParentCatalogItem).toBe('grupo-identidad');
    edicion.flush(conGrupo);
    responder([]);
  });
});
