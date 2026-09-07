import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { ServicesPage } from './services-page';
import { ClientsPage } from '../../../clients/pages/clients-page/clients-page';

const organization = { idOrganization: 'org-a', legalName: 'Organization A', codeOrganization: 'A', active: true };
const client = { idClient: 'client-a', idOrganization: 'org-a', legalName: 'Client A', codeClient: 'A', active: true };
const service = { idService: 'service-a', idClient: 'client-a', idClientSite: 'site-a', name: 'Service A', codeService: 'SA', description: 'Scope', startDate: '2026-09-03', endDate: null, active: true };
const listItem = {
  ...service,
  clientName: 'Client A',
  clientSiteName: 'Site A',
  idServiceContract: null,
  serviceContractCode: null,
  invoiceDescription: null,
  positionsCount: 1,
  requiredWorkerCount: 2,
  assignedWorkerCount: 1,
  coverageDate: '2026-09-04',
};
const site = { idClientSite: 'site-a', idClient: 'client-a', name: 'Site A', active: true };
const position = { idPosition: 'position-a', idService: 'service-a', name: 'Position A', codePosition: 'PA', requiredWorkerCount: 1, active: true };

describe('ServicesPage organization-scoped workflows', () => {
  let http: HttpTestingController;
  // Tests exercise protected user actions without adding a public production API.
  let page: any;
  let permissions: ReturnType<typeof signal<string[]>>;
  // Para un super admin: si ya entró a una organización. Sustituye al viejo modo soporte.
  let organizationOpen: ReturnType<typeof signal<boolean>>;
  let activeOrganization: ReturnType<typeof signal<string>>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    permissions = signal(['CLIENTS.READ', 'CLIENTS.WRITE', 'PLANNING.READ', 'PLANNING.WRITE', 'WORKFORCE.READ', 'DOCUMENTS.READ']);
    organizationOpen = signal(false);
    activeOrganization = signal('org-a');
    params = new BehaviorSubject(convertToParamMap({}));
    // La organización sale de la barra de contexto, así que el doble la expone como la expone
    // AuthService: una señal de sólo lectura, sin lista que pasarle.
    const abierta = () =>
      permissions().includes('PLATFORM.ADMIN') && !organizationOpen() ? '' : activeOrganization();
    const auth = {
      session: () => ({ permissions: permissions() }),
      hasPermission: (p: string) => permissions().includes(p) || permissions().includes('PLATFORM.ADMIN'),
      setActiveOrganization: (id: string) => { if (['org-a', 'org-b'].includes(id)) activeOrganization.set(id); },
      operationalOrganizationId: abierta,
      activeOrganization: () => (abierta() ? { ...organization, idOrganization: abierta() } : null),
      availableOrganizations: () => [organization, { ...organization, idOrganization: 'org-b' }],
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        // La pantalla lee el día operativo del servidor; el doble lo fija para que la prueba no
        // dependa del reloj de quien la corre.
        { provide: SystemInfoService, useValue: {
          operationDate: () => '2026-09-04',
          timeZoneId: () => 'America/Mexico_City',
          info: () => null,
          refresh: () => undefined,
        } },
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { get queryParamMap() { return params.value; } } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.runInInjectionContext(() => new ServicesPage());
  });

  afterEach(() => {
    page.ngOnDestroy();
    http.verify({ ignoreCancelled: true });
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function start(query: Record<string, string> = {}) {
    params.next(convertToParamMap(query));
    page.ngOnInit();
    TestBed.tick();
  }

  /** El listado plano: **una sola llamada**, sin elegir cliente antes. */
  function flushList(rows = [listItem]) {
    const request = http.expectOne(r => r.url === '/api/v1/services');
    expect(request.request.params.get('organizationId')).toBe(activeOrganization());
    request.flush({ items: rows, totalCount: rows.length, page: 1, pageSize: 20, totalPages: 1 });
  }

  /** Lo que la ficha pide al abrirse: el cliente, sus sedes, sus contratos y sus contactos. */
  function flushClientContext() {
    http.expectOne(r => r.url === '/api/v1/clients/client-a').flush(client);
    for (const [suffix, data] of [['sites', [site]], ['contacts', []], ['contracts', []]] as const) {
      const request = http.expectOne(r => r.url === '/api/v1/clients/client-a/' + suffix);
      expect(request.request.params.get('organizationId')).toBe('org-a');
      request.flush(data);
    }
  }

  function selectClient() {
    start();
    flushList();
    page.openService(listItem);
    flushClientContext();
    flushService();
  }

  function flushService() {
    http.expectOne(r => r.url.endsWith('/configurations')).flush([]);
    http.expectOne(r => r.url.endsWith('/positions')).flush([]);
    http.expectOne(r => r.url.endsWith('/assignments')).flush([]);
    http.expectOne(r => r.url.endsWith('/positions/vacancy')).flush([]);
    http.expectOne(r => r.url === '/api/v1/employees').flush({ items: [], page: 1, totalPages: 1 });
  }

  it('bloquea consultas y escrituras al super admin que no ha entrado a una organización', () => {
    permissions.set(['PLATFORM.ADMIN']);
    start();
    expect(page.canRead()).toBe(false);
    page.openCreateService();
    page.saveService();
    expect(page.serviceEditorOpen()).toBe(false);
    http.expectNone(r => r.url !== '/api/v1/organizations');
  });

  it('requires write permissions separately and skips planning/employee APIs without read permissions', () => {
    permissions.set(['CLIENTS.READ']);
    start();
    flushList();
    page.openService(listItem);
    flushClientContext();
    // Sin permiso de planeación no se piden ni posiciones, ni asignaciones, ni la cobertura.
    http.expectOne(r => r.url.endsWith('/configurations')).flush([]);
    page.openCreatePosition();
    page.saveService();
    page.savePosition();
    expect(page.canWriteClients()).toBe(false);
    expect(page.canWritePlanning()).toBe(false);
    http.expectNone(r => r.url.endsWith('/positions') || r.url === '/api/v1/employees' || r.method !== 'GET');
  });

  /**
   * El enlace profundo sigue valiendo, con otra forma: ya no pasa por la página del cliente
   * porque no hay tal página. Abre el servicio directamente.
   */
  it('abre el servicio enlazado por la URL sin pasar por el cliente', () => {
    start({ clientId: 'client-a', serviceId: 'service-a' });
    flushList();
    http.expectOne('/api/v1/clients/client-a?organizationId=org-a').flush(client);

    // Dos consultas con motivos distintos: la lista visible, **ya filtrada por el cliente** del
    // enlace, y la acotada que busca el servicio enlazado aunque esté en otra página o inactivo.
    const consultas = http.match(r => r.url === '/api/v1/services');
    expect(consultas).toHaveLength(2);
    // El endpoint lo llama `idClient`; `clientId` es el parámetro de la ruta que trajo el enlace.
    expect(consultas[0].request.params.get('idClient')).toBe('client-a');
    consultas.forEach(c =>
      c.flush({ items: [listItem], totalCount: 1, page: 1, pageSize: 200, totalPages: 1 }));

    expect(page.selectedService().idService).toBe('service-a');
    flushClientContext();
    flushService();
  });

  it('avisa cuando el servicio enlazado no existe, en vez de abrir otro', () => {
    start({ clientId: 'client-a', serviceId: 'missing' });
    flushList();
    http.expectOne('/api/v1/clients/client-a?organizationId=org-a').flush(client);
    http.match(r => r.url === '/api/v1/services').forEach(c =>
      c.flush({ items: [listItem], totalCount: 1, page: 1, pageSize: 200, totalPages: 1 }));

    expect(page.selectedService()).toBeNull();
    expect(page.error()).toContain('no está disponible');
  });

  it('cancels old service reads when another service is selected', () => {
    selectClient();
    const requests = http.match(() => true);
    page.openService({ ...listItem, idService: 'service-b' });
    expect(requests.every(r => r.cancelled)).toBe(true);
    expect(page.configurations()).toEqual([]);
    expect(page.positions()).toEqual([]);
    flushService();
  });

  // Nota: las dos pruebas que ejercitaban el cambio de organización desde esta pantalla se
  // retiraron con el mecanismo que probaban. La pantalla ya no cambia de organización: la fija la
  // barra de contexto y el shell vuelve a montar la pantalla. La garantía que cuidaban —no dejar
  // en pantalla los datos de la organización anterior— está fijada en `app-shell.spec.ts`.

  it('creates a service using the selected organization and client, then reloads its detail', () => {
    selectClient();
    page.openCreateService();
    page.serviceForm.patchValue({ codeService: 'NEW', name: 'New service', description: 'Contracted scope' });
    page.saveService();
    const request = http.expectOne('/api/v1/clients/client-a/services');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ idOrganization: 'org-a', idClient: 'client-a', idClientSite: 'site-a', codeService: 'NEW' });
    request.flush(service);
    flushList();
    expect(page.serviceEditorOpen()).toBe(false);
    expect(page.selectedService().idService).toBe('service-a');
  });

  it('loads every employee page for assignment selection', () => {
    selectClient();
    page.openService(listItem);
    flushClientContext();
    http.expectOne(r => r.url.endsWith('/configurations')).flush([]);
    http.expectOne(r => r.url.endsWith('/positions')).flush([]);
    http.expectOne(r => r.url.endsWith('/assignments')).flush([]);
    http.expectOne(r => r.url === '/api/v1/employees' && r.params.get('page') === '1')
      .flush({ items: [{ idEmployee: 'employee-a' }], page: 1, totalPages: 2 });
    http.expectOne(r => r.url === '/api/v1/employees' && r.params.get('page') === '2')
      .flush({ items: [{ idEmployee: 'employee-b' }], page: 2, totalPages: 2 });
    expect(page.activeEmployees().map((e: { idEmployee: string }) => e.idEmployee)).toEqual(['employee-a', 'employee-b']);
  });

  it('creates a weekly segment with the full organization and parent scope', () => {
    selectClient();
    page.selectedService.set(service);
    page.selectedPosition.set(position);
    page.selectedShiftPattern.set({ idShiftPattern: 'pattern-a', active: true });
    page.openCreateShiftSegment();
    page.shiftSegmentForm.patchValue({ startTime: '22:00', endTime: '06:00', isOvernight: true });
    page.saveShiftSegment();
    const url = '/api/v1/clients/client-a/services/service-a/positions/position-a/shift-patterns/pattern-a/segments';
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      idOrganization: 'org-a', idClient: 'client-a', idService: 'service-a',
      idPosition: 'position-a', idShiftPattern: 'pattern-a', startTime: '22:00:00', endTime: '06:00:00', isOvernight: true,
    });
    request.flush({});
    http.expectOne(url + '?organizationId=org-a').flush([]);
  });

  it('retains backend validation feedback and the open editor after a failed save', () => {
    selectClient();
    page.openCreateService();
    page.serviceForm.patchValue({ codeService: 'DUP', name: 'Duplicate', description: 'Scope' });
    page.saveService();
    http.expectOne('/api/v1/clients/client-a/services')
      .flush({ detail: 'El código ya existe.' }, { status: 409, statusText: 'Conflict' });
    expect(page.serviceEditorOpen()).toBe(true);
    expect(page.saving()).toBe(false);
    expect(page.error()).toBe('El código ya existe.');
  });

  /**
   * La frontera entre las dos pantallas: **Clientes lee, Servicios escribe**. Clientes muestra
   * sedes y contactos del cliente y no toca nada de planeación; el alta del servicio vive aquí.
   *
   * La prueba se reescribió con la pantalla: en la tanda 6 la ficha pasó a pedir sólo lo que sus
   * pestañas muestran, y dejó de traer contratos y servicios que nadie pintaba.
   */
  it('la ficha de cliente sólo lee lo suyo, y no pide nada de planeación', () => {
    const clientsPage: any = TestBed.runInInjectionContext(() => new ClientsPage());

    clientsPage.open({ idClient: 'client-a', siteCount: 1, contactCount: 1 });

    const requests = http.match(() => true);
    expect(requests.map(r => r.request.url).sort()).toEqual([
      '/api/v1/clients/client-a/contacts',
      '/api/v1/clients/client-a/sites',
    ]);
    requests.forEach(r => r.flush([]));

    // Nada de planeación ni de asignaciones: eso es de Servicios.
    expect(clientsPage.openCreateService).toBeUndefined();
    expect(clientsPage.saveAssignment).toBeUndefined();
    expect(clientsPage.loadPositionVacancy).toBeUndefined();

    // Y lo que sí es suyo: la sede, que es el prerrequisito del paso siguiente.
    expect(clientsPage.createSite).toBeTypeOf('function');
  });

  it.each([
    ['Configuration', 'configurationForm', 'configurations', 'idServiceConfiguration', { workScheduleDescription: 'Weekdays', effectiveFromDate: '2026-09-03' }],
    ['Position', 'positionForm', 'positions', 'idPosition', { codePosition: 'PA', name: 'Main gate' }],
    ['ShiftPattern', 'shiftPatternForm', 'positions/position-a/shift-patterns', 'idShiftPattern', { codeShiftPattern: 'WEEK', name: 'Weekdays', effectiveFromDate: '2026-09-03' }],
  ])('creates and updates %s with organization-scoped bodies', (kind, form, suffix, idField, fields) => {
    selectClient();
    page.selectedService.set(service);
    page.selectedPosition.set(position);
    page['openCreate' + kind]();
    page[form].patchValue(fields);
    const url = '/api/v1/clients/client-a/services/service-a/' + suffix;
    page['save' + kind]();
    const create = http.expectOne(url);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toMatchObject({ idOrganization: 'org-a', idClient: 'client-a', idService: 'service-a' });
    const record = { ...page[form].getRawValue(), [idField]: 'record-a', active: true };
    create.flush(record);
    http.expectOne(url + '?organizationId=org-a').flush([]);
    page.selectedPosition.set(position);
    page['openEdit' + kind](record);
    page['save' + kind]();
    const update = http.expectOne(url + '/record-a');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toMatchObject({ idOrganization: 'org-a', idClient: 'client-a', idService: 'service-a' });
    update.flush(record);
    http.expectOne(url + '?organizationId=org-a').flush([]);
  });

  it('updates an assignment without offering an employee change the API cannot save', () => {
    selectClient();
    page.selectedService.set(service);
    page.positions.set([position]);
    const assignment = { idServiceAssignment: 'assignment-a', idEmployee: 'employee-a', idPosition: 'position-a', assignmentType: 'Primary', startDate: '2026-09-03', endDate: null, isPrimary: true, notes: null };
    page.openEditAssignment(assignment);
    expect(page.assignmentForm.controls.idEmployee.disabled).toBe(true);
    page.saveAssignment();
    const url = '/api/v1/clients/client-a/services/service-a/assignments';
    const request = http.expectOne(url + '/assignment-a');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.idEmployee).toBeUndefined();
    expect(request.request.body).toMatchObject({ idOrganization: 'org-a', idClient: 'client-a', idPosition: 'position-a' });
    request.flush(assignment);
    http.expectOne(url + '?organizationId=org-a').flush([]);
  });

  /**
   * Desactivar pasa por el diálogo del sistema, no por un `window.confirm`: el diálogo nombra el
   * servicio y explica qué deja de funcionar antes de preguntar.
   */
  it('pregunta con el diálogo del sistema antes de desactivar, y recarga el listado', () => {
    selectClient();

    page.confirmDeactivateService(listItem);
    expect(page.serviceToDeactivate().idService).toBe('service-a');
    // Nada se manda mientras el diálogo pregunta.
    http.expectNone(r => r.method === 'DELETE');

    page.deactivateService(listItem);
    expect(page.serviceToDeactivate()).toBeNull();

    const request = http.expectOne('/api/v1/clients/client-a/services/service-a?organizationId=org-a');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    flushList([]);
    expect(page.serviceList().items).toEqual([]);
    expect(page.selectedService()).toBeNull();
  });

  it('cancelar no desactiva nada', () => {
    selectClient();

    page.confirmDeactivateService(listItem);
    page.cancelDeactivateService();

    expect(page.serviceToDeactivate()).toBeNull();
    http.expectNone(r => r.method === 'DELETE');
  });
});
