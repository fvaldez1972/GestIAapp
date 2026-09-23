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

  /**
   * Subir un archivo tiene que contar como requisito cubierto.
   *
   * <p>El archivo se guarda como <c>BusinessDocument</c> y la vigencia se calcula sobre
   * <c>EmployeeDocument</c>, que es otra tabla. Antes nadie escribía la segunda, así que la bandera
   * no se movía nunca: no era un problema de refresco, la pantalla escribía donde el indicador no
   * lee.</p>
   *
   * <p>Lo que se fija aquí es el estado: el servidor sólo acepta como cubierto un documento en
   * <c>Received</c> o <c>Validated</c>. Con cualquier otro, la persona sigue sin ser elegible y el
   * archivo subido no sirve para asignarla.</p>
   */
  it('al guardar un documento registra el requisito con estado Received', () => {
    const { fixture, http, empleados, responder, responderLoDemas } = montar();
    responder();
    responderLoDemas();
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as {
      detail: { set(valor: unknown): void };
      documents: { set(valor: unknown): void };
      registerEmployeeDocument(guardado: {
        documentType: string;
        issuedDate: string | null;
        expiresDate: string | null;
      }): void;
    };

    pagina.detail.set({ idEmployee: 'emp-1', fullName: 'Laura Méndez' });
    pagina.documents.set([]);

    // Lo que la pestaña emite es el identificador de la categoría del catálogo, no el enum.
    pagina.registerEmployeeDocument({
      documentType: 'cat-antecedentes',
      issuedDate: '2026-09-01',
      expiresDate: '2027-09-01',
    });

    const alta = http.expectOne(
      (r) => r.url === '/api/v1/employees/emp-1/documents' && r.method === 'POST',
    );
    expect(alta.request.body).toMatchObject({
      idOrganization: 'org-a',
      idEmployee: 'emp-1',
      idDocumentCategoryCatalogItem: 'cat-antecedentes',
      status: 'Received',
      issuedDate: '2026-09-01',
      expiresDate: '2027-09-01',
      storageReference: null,
    });
    alta.flush({});

    // Y recarga las dos cosas: el detalle mueve la bandera de la ficha, la lista la insignia.
    expect(http.match((r) => r.url === '/api/v1/employees/emp-1')).toHaveLength(1);
    expect(empleados()).toHaveLength(1);
    responder();
    responderLoDemas();
  });

  /** Con una fila activa del mismo tipo se actualiza: dos filas del mismo requisito se contradicen. */
  it('actualiza en lugar de agregar cuando ya hay documento activo del tipo', () => {
    const { fixture, http, empleados, responder, responderLoDemas } = montar();
    responder();
    responderLoDemas();
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as {
      detail: { set(valor: unknown): void };
      documents: { set(valor: unknown): void };
      registerEmployeeDocument(guardado: {
        documentType: string;
        issuedDate: string | null;
        expiresDate: string | null;
      }): void;
    };

    pagina.detail.set({ idEmployee: 'emp-1', fullName: 'Laura Méndez' });
    pagina.documents.set([
      {
        idEmployeeDocument: 'doc-9',
        idEmployee: 'emp-1',
        idDocumentCategoryCatalogItem: 'cat-antecedentes',
        documentCategoryName: 'Antecedentes no penales',
        documentType: 'CriminalRecordCertificate',
        status: 'Received',
        documentNumber: 'ABC-123',
        receivedDate: null,
        issuedDate: null,
        expiresDate: '2026-01-01',
        storageReference: null,
        notes: null,
        active: true,
      },
    ]);

    pagina.registerEmployeeDocument({
      documentType: 'cat-antecedentes',
      issuedDate: null,
      expiresDate: '2028-01-01',
    });

    const cambio = http.expectOne(
      (r) => r.url === '/api/v1/employees/emp-1/documents/doc-9' && r.method === 'PUT',
    );
    // El número que ya estaba capturado se conserva: el archivo nuevo no lo sabe.
    expect(cambio.request.body).toMatchObject({
      documentNumber: 'ABC-123',
      expiresDate: '2028-01-01',
      status: 'Received',
    });
    cambio.flush({});
    expect(empleados()).toHaveLength(1);
    responder();
    responderLoDemas();
  });

  /**
   * El alta al vuelo declara la naturaleza del valor que crea.
   *
   * <p><b>Esto se rompió y nadie lo vio.</b> El 21 de septiembre de 2026 los cuatro catálogos de la
   * elegibilidad pasaron a exigir la marca al crear, y las altas al vuelo de Personal y de
   * Servicios seguían mandando el alta sin ella: el servidor respondía 400 y la experiencia nunca
   * se creaba. Las 840 pruebas de entonces pasaron porque ninguna miraba lo que ese alta manda.</p>
   *
   * <p>Nace <b>informativa</b> porque el alta al vuelo no puede preguntar si bloquea: ocurre en
   * medio de otro formulario. Quien administre el catálogo la promueve después.</p>
   */
  it('el alta al vuelo de una experiencia declara que es informativa', () => {
    const { fixture, http, responder, responderLoDemas } = montar();
    responder();
    responderLoDemas();
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as {
      createSkillCatalogItem(creation: { name: string }): void;
    };
    pagina.createSkillCatalogItem({ name: 'Manejo de CCTV' });

    const alta = http.expectOne(
      (peticion) => peticion.method === 'POST' && peticion.url === '/api/v1/catalogs/items',
    );

    expect(alta.request.body.type).toBe('Skill');
    expect(alta.request.body.isRequired, 'sin esto el servidor responde 400').toBe(false);
    alta.flush({ idCatalogItem: 'x', name: 'Manejo de CCTV', type: 'Skill', active: true });
  });

  /**
   * Y lo mismo con el tipo de incidencia administrativa, que es el otro que exige la marca.
   *
   * <p>Es el control de la anterior: dos altas al vuelo distintas, a dos catálogos distintos, y las
   * dos tenían el mismo defecto. Comprobar sólo una habría dejado la otra rota.</p>
   */
  it('y el alta al vuelo de un tipo de incidencia administrativa también', () => {
    const { fixture, http, responder, responderLoDemas } = montar();
    responder();
    responderLoDemas();
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as {
      createIncidentType(creation: { name: string }): void;
    };
    pagina.createIncidentType({ name: 'Acta administrativa' });

    const alta = http.expectOne(
      (peticion) => peticion.method === 'POST' && peticion.url === '/api/v1/catalogs/items',
    );

    expect(alta.request.body.type).toBe('AdministrativeIncidentType');
    expect(alta.request.body.isRequired).toBe(false);
    alta.flush({ idCatalogItem: 'y', name: 'Acta administrativa', type: 'AdministrativeIncidentType', active: true });
  });

  /**
   * El listado pagina, y pagina en el servidor.
   *
   * <p>Traía 25 personas y no ofrecía pasar a la siguiente: con 128, las 103 restantes no existían
   * para esta pantalla. La consulta ya aceptaba página y tamaño, así que no hace falta traerse las
   * 128 fichas para enseñar veinticinco.</p>
   */
  it('pide la página siguiente al servidor, y no se trae la lista entera', () => {
    const pagina = TestBed.runInInjectionContext(() => new WorkforcePage()) as unknown as {
      total: { set(v: number): void };
      currentPage(): number;
      totalPaginas(): number;
      rango(): string;
      goToPage(p: number): void;
      setPageSize(t: string): void;
      pageSize(): number;
    };

    pagina.total.set(128);
    expect(pagina.totalPaginas()).toBe(6);
    expect(pagina.rango()).toBe('1–25 de 128');

    pagina.goToPage(2);
    expect(pagina.currentPage()).toBe(2);
    expect(pagina.rango()).toBe('26–50 de 128');

    // No se puede pasar del final: pedir la 99 deja la última, no una página vacía.
    pagina.goToPage(99);
    expect(pagina.currentPage()).toBe(6);

    // Y cambiar el tamaño vuelve a la primera: quedarse en la 6 con 100 por página dejaría la
    // lista vacía y parecería que se perdieron las personas.
    pagina.setPageSize('100');
    expect(pagina.pageSize()).toBe(100);
    expect(pagina.currentPage()).toBe(1);
  });

});
