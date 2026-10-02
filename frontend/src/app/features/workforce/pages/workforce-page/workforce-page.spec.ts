import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { WorkforcePage } from './workforce-page';
import { assignmentFixture } from '../../ui/employee-fixtures';

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
          summary: { total: 0, active: 0, candidates: 0, withExpiredDocuments: 0, withExpiringDocuments: 0 },
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

  /**
   * El historial de asignaciones vuelve al panel el 24 de septiembre de 2026, por petición.
   *
   * <p>Se había retirado el 23 junto con lo de vigencias. Lo que se echó de menos no fue el botón
   * de asignar —ése sigue fuera, y asignar se hace desde Servicios— sino poder ver dónde ha estado
   * la persona.</p>
   *
   * <p>Las dos afirmaciones se necesitan. La petición sola no bastaría: la ficha podría pedir el
   * historial y no tener dónde enseñarlo. Y la pestaña sola tampoco: estaría dibujando una pestaña
   * vacía porque nadie pidió los datos.</p>
   */
  it('la ficha pide el historial de asignaciones y le da su pestaña', () => {
    const { fixture, http, responder, responderLoDemas } = montar();
    responder();
    responderLoDemas();
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as {
      open(employee: unknown, tab?: string): void;
      panelTabs(): readonly { readonly id: string; readonly count?: number }[];
      assignments(): readonly unknown[];
    };

    pagina.open({ idEmployee: 'emp-1', documentCount: 0 }, 'assignments');

    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/v1/employees/emp-1/assignments')
      .flush([assignmentFixture()]);
    // Lo demás del expediente, vacío pero con forma: `null` dejaría señales que la pantalla
    // recorre, y el fallo parecería del historial cuando sería de la respuesta de al lado.
    http.match(() => true).forEach((r) => r.flush([]));
    fixture.detectChanges();

    expect(pagina.assignments()).toHaveLength(1);
    expect(pagina.panelTabs().find((t) => t.id === 'assignments')?.count).toBe(1);
  });

  /**
   * El alta de una asignación desde el expediente.
   *
   * <p>El botón llevaba a otra pantalla —primero a Planeación, luego a Servicios—, y las dos veces
   * dejaba a quien lo pulsaba con la persona en la cabeza y un formulario en blanco delante. Ahora
   * se resuelve aquí, con <b>el mismo endpoint y los mismos campos</b> que usa Servicios.</p>
   *
   * <p>Las tres afirmaciones se necesitan: a dónde va el alta, que la persona que viaja es la del
   * expediente abierto —no la que se miró antes— y que después se vuelve a pedir el historial, que
   * es lo único que hace aparecer la fila nueva con el nombre del cliente y del servicio que esta
   * pantalla no tiene.</p>
   */
  it('asignar desde el expediente manda el alta al servicio y vuelve a pedir el historial', () => {
    const { fixture, http, responder, responderLoDemas } = montar();
    responder();
    responderLoDemas();
    fixture.detectChanges();

    const pagina = fixture.componentInstance as unknown as {
      open(employee: unknown, tab?: string): void;
      saveAssignment(valor: Record<string, unknown>): void;
    };

    pagina.open({ idEmployee: 'emp-1', documentCount: 0 }, 'assignments');
    http.match(() => true).forEach((r) => r.flush([]));
    fixture.detectChanges();

    pagina.saveAssignment({
      idClient: 'c-1',
      idService: 's-1',
      idPosition: 'p-1',
      assignmentType: 'Primary',
      startDate: '2026-09-24',
      isPrimary: true,
    });

    const alta = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/v1/clients/c-1/services/s-1/assignments',
    );

    expect(alta.request.body.idEmployee, 'la persona del expediente abierto').toBe('emp-1');
    expect(alta.request.body.idPosition).toBe('p-1');
    expect(alta.request.body.isPrimary).toBe(true);
    alta.flush({ idServiceAssignment: 'sa-1' });

    http.expectOne((r) => r.method === 'GET' && r.url === '/api/v1/employees/emp-1/assignments');
  });

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
   * Los números del encabezado son de la organización, no de la página.
   *
   * <p><b>Es la prueba del defecto que motivó el resumen.</b> El subtítulo decía «N tienen algún
   * documento vencido» contando <c>employees()</c>, que son las filas a la vista: con diez por
   * página el número era siempre diez o menos y coincidía con el tamaño de página en vez de con
   * la realidad.</p>
   *
   * <p>Por eso el control importa: la página trae <b>una</b> fila y el resumen dice <b>40</b>. Si
   * alguien volviera a derivar el número de la página, esta prueba cae, porque 40 no se puede
   * sacar de una sola fila.</p>
   */
  it('las tarjetas cuentan la organización entera, no la página', () => {
    const { fixture, http, empleados, responderLoDemas } = montar();

    empleados().forEach((r) =>
      r.flush({
        page: {
          items: [
            {
              idEmployee: 'emp-1',
              idOrganization: 'org-a',
              codeEmployee: 'EMP-001',
              fullName: 'Laura Beltrán Ruiz',
              status: 'Active',
              hireDate: '2024-01-15',
              curp: null,
              idJobPositionCatalogItem: null,
              jobPositionName: null,
              jobTitle: null,
              state: null,
              municipality: null,
              requiredDocuments: 4,
              expiredDocuments: 0,
              expiringDocuments: 0,
              missingDocuments: 0,
              notValidDocuments: 0,
              assignmentCount: 0,
              documentCount: 0,
              documentHealth: 'UpToDate',
            },
          ],
          totalCount: 128,
          page: 1,
          pageSize: 10,
          totalPages: 13,
        },
        expiringWithinDays: 30,
        requiredDocuments: 4,
        summary: {
          total: 128,
          active: 96,
          candidates: 7,
          withExpiredDocuments: 40,
          withExpiringDocuments: 12,
        },
      }),
    );

    responderLoDemas();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    // El control: la página trae **una** fila y las tarjetas dicen 128, 96 y 7. Ninguno de esos
    // tres números se puede sacar de una sola fila, así que si alguien volviera a derivarlos de
    // `employees()` esta prueba caería.
    expect(texto).toContain('128');
    expect(texto).toContain('96');
    expect(texto).toContain('7 candidatas o candidatos');
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
   * elegibilidad pasaron a exigir la marca al crear, y las altas al vuelo seguían mandando el alta
   * sin ella: el servidor respondía 400 y el valor nunca se creaba. Las 840 pruebas de entonces
   * pasaron porque ninguna miraba lo que ese alta manda.</p>
   *
   * <p>Nace <b>informativo</b> porque el alta al vuelo no puede preguntar si bloquea: ocurre en
   * medio de otro formulario. Quien administre el catálogo lo promueve después.</p>
   *
   * <p>Aquí había también el alta al vuelo de una experiencia, y se fue el 24 de septiembre de 2026
   * al volverse desplegable el campo de Experiencia: un desplegable no puede ofrecer un nombre que
   * no existe, así que ya no hay desde dónde dispararla. <b>El tipo de incidencia administrativa es
   * ahora el único alta al vuelo que queda</b>, y por eso esta prueba pasa a llevar el motivo
   * entero.</p>
   */
  it('el alta al vuelo de un tipo de incidencia administrativa declara que es informativo', () => {
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
    expect(pagina.totalPaginas()).toBe(13);
    expect(pagina.rango()).toBe('1–10 de 128');

    pagina.goToPage(2);
    expect(pagina.currentPage()).toBe(2);
    expect(pagina.rango()).toBe('11–20 de 128');

    // No se puede pasar del final: pedir la 99 deja la última, no una página vacía.
    pagina.goToPage(99);
    expect(pagina.currentPage()).toBe(13);

    // Y cambiar el tamaño vuelve a la primera: quedarse en la 13 con 100 por página dejaría la
    // lista vacía y parecería que se perdieron las personas.
    pagina.setPageSize('100');
    expect(pagina.pageSize()).toBe(100);
    expect(pagina.currentPage()).toBe(1);
  });

});
