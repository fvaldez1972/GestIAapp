import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ServicesPage } from './services-page';
import { ClientsPage } from '../../../clients/pages/clients-page/clients-page';

const organization = { idOrganization: 'org-a', legalName: 'Organization A', codeOrganization: 'A', active: true };
const client = { idClient: 'client-a', idOrganization: 'org-a', legalName: 'Client A', codeClient: 'A', active: true };
const service = { idService: 'service-a', idClient: 'client-a', idClientSite: 'site-a', name: 'Service A', codeService: 'SA', description: 'Scope', startDate: '2026-09-03', endDate: null, active: true };
const site = { idClientSite: 'site-a', idClient: 'client-a', name: 'Site A', active: true };
const position = { idPosition: 'position-a', idService: 'service-a', name: 'Position A', codePosition: 'PA', requiredWorkerCount: 1, active: true };

describe('ServicesPage organization-scoped workflows', () => {
  let http: HttpTestingController;
  // Tests exercise protected user actions without adding a public production API.
  let page: any;
  let permissions: ReturnType<typeof signal<string[]>>;
  let support: ReturnType<typeof signal<boolean>>;
  let activeOrganization: ReturnType<typeof signal<string>>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    permissions = signal(['CLIENTS.READ', 'CLIENTS.WRITE', 'PLANNING.READ', 'PLANNING.WRITE', 'WORKFORCE.READ', 'DOCUMENTS.READ']);
    support = signal(false);
    activeOrganization = signal('org-a');
    params = new BehaviorSubject(convertToParamMap({}));
    const auth = {
      session: () => ({ permissions: permissions() }),
      hasPermission: (p: string) => permissions().includes(p) || permissions().includes('PLATFORM.ADMIN'),
      isSupportModeActive: support,
      supportSession: () => support() ? { idOrganization: 'org-a' } : null,
      setActiveOrganization: (id: string) => { if (['org-a', 'org-b'].includes(id)) activeOrganization.set(id); },
      resolveOperationalOrganizationId: (organizations: typeof organization[]) =>
        permissions().includes('PLATFORM.ADMIN') && !support() ? '' :
          organizations.find(o => o.idOrganization === activeOrganization())?.idOrganization ?? '',
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
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
    http.expectOne('/api/v1/organizations').flush([organization, { ...organization, idOrganization: 'org-b' }]);
    TestBed.tick();
  }

  function flushClients() {
    const request = http.expectOne(r => r.url === '/api/v1/clients');
    expect(request.request.params.get('organizationId')).toBe(activeOrganization());
    request.flush({ items: [client], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 });
  }

  function flushDetail(rows = [service]) {
    for (const [suffix, data] of [['services', rows], ['sites', [site]], ['contracts', []]] as const) {
      const request = http.expectOne(r => r.url === '/api/v1/clients/client-a/' + suffix);
      expect(request.request.params.get('organizationId')).toBe('org-a');
      request.flush(data);
    }
  }

  function selectClient() {
    start();
    flushClients();
    page.selectClient('client-a');
    flushDetail();
  }

  function flushService() {
    http.expectOne(r => r.url.endsWith('/configurations')).flush([]);
    http.expectOne(r => r.url.endsWith('/positions')).flush([]);
    http.expectOne(r => r.url.endsWith('/assignments')).flush([]);
    http.expectOne(r => r.url === '/api/v1/employees').flush({ items: [], page: 1, totalPages: 1 });
  }

  it('blocks operational requests and writes for platform admins without support', () => {
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
    selectClient();
    page.selectService(service);
    http.expectOne(r => r.url.endsWith('/configurations')).flush([]);
    page.openCreatePosition();
    page.saveService();
    page.savePosition();
    expect(page.canWriteClients()).toBe(false);
    expect(page.canWritePlanning()).toBe(false);
    http.expectNone(r => r.url.endsWith('/positions') || r.url === '/api/v1/employees' || r.method !== 'GET');
  });

  it('resolves client and service deep links outside the current client page', () => {
    start({ clientId: 'client-a', serviceId: 'service-a' });
    flushClients();
    const request = http.expectOne('/api/v1/clients/client-a?organizationId=org-a');
    request.flush(client);
    flushDetail();
    expect(page.selectedClient().idClient).toBe('client-a');
    expect(page.selectedService().idService).toBe('service-a');
    flushService();
  });

  it('accepts a client-only link for new services without selecting an existing service', () => {
    start({ clientId: 'client-a' });
    flushClients();
    http.expectOne('/api/v1/clients/client-a?organizationId=org-a').flush(client);
    flushDetail();
    page.openCreateService();
    expect(page.serviceEditorOpen()).toBe(true);
    expect(page.selectedService()).toBeNull();
    expect(page.serviceForm.getRawValue().idClientSite).toBe('site-a');
  });

  it('reports a missing linked service instead of selecting a different service', () => {
    start({ clientId: 'client-a', serviceId: 'missing' });
    flushClients();
    http.expectOne('/api/v1/clients/client-a?organizationId=org-a').flush(client);
    flushDetail();
    expect(page.selectedService()).toBeNull();
    expect(page.error()).toContain('no está disponible');
  });

  it('cancels old client reads and closes its editors when the organization changes', () => {
    start();
    flushClients();
    page.selectClient('client-a');
    const requests = http.match(r => r.url.startsWith('/api/v1/clients/client-a/'));
    page.serviceEditorOpen.set(true);
    page.selectOrganization('org-b');
    expect(requests.every(r => r.cancelled)).toBe(true);
    expect(page.selectedClient()).toBeNull();
    expect(page.serviceEditorOpen()).toBe(false);
    expect(page.services()).toEqual([]);
    flushClients();
  });

  it('cancels old service reads when another service is selected', () => {
    selectClient();
    page.selectService(service);
    const requests = http.match(() => true);
    page.selectService({ ...service, idService: 'service-b' });
    expect(requests.every(r => r.cancelled)).toBe(true);
    expect(page.configurations()).toEqual([]);
    expect(page.positions()).toEqual([]);
    flushService();
  });

  it('clears scoped data immediately when support expires', () => {
    permissions.set(['PLATFORM.ADMIN']);
    support.set(true);
    selectClient();
    page.selectService(service);
    const requests = http.match(() => true);
    support.set(false);
    TestBed.tick();
    expect(requests.every(r => r.cancelled)).toBe(true);
    expect(page.selectedClient()).toBeNull();
    expect(page.selectedService()).toBeNull();
    expect(page.canWritePlanning()).toBe(false);
  });

  it('creates a service using the selected organization and client, then reloads its detail', () => {
    selectClient();
    page.openCreateService();
    page.serviceForm.patchValue({ codeService: 'NEW', name: 'New service', description: 'Contracted scope' });
    page.saveService();
    const request = http.expectOne('/api/v1/clients/client-a/services');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ idOrganization: 'org-a', idClient: 'client-a', idClientSite: 'site-a', codeService: 'NEW' });
    request.flush(service);
    flushDetail();
    flushService();
    expect(page.serviceEditorOpen()).toBe(false);
    expect(page.selectedService().idService).toBe('service-a');
  });

  it('loads every employee page for assignment selection', () => {
    selectClient();
    page.selectService(service);
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

  it('keeps client detail read-only for services and never fetches planning resources', () => {
    const clientsPage: any = TestBed.runInInjectionContext(() => new ClientsPage());
    clientsPage.selectedOrganizationId.set('org-a');
    clientsPage.selectedClient.set(client);
    clientsPage.loadClientDetail();
    const requests = http.match(() => true);
    expect(requests.map(r => r.request.url).sort()).toEqual([
      '/api/v1/clients/client-a/contacts', '/api/v1/clients/client-a/contracts',
      '/api/v1/clients/client-a/services', '/api/v1/clients/client-a/sites',
    ]);
    requests.forEach(r => r.flush([]));
    expect(clientsPage.openCreateService).toBeUndefined();
    expect(clientsPage.saveAssignment).toBeUndefined();
    expect(clientsPage.openCreateSite).toBeTypeOf('function');
    expect(clientsPage.openCreateContact).toBeTypeOf('function');
    expect(clientsPage.openCreateContract).toBeTypeOf('function');
    clientsPage.documentContract.set({ idServiceContract: 'contract-a' });
    clientsPage.selectClient(client);
    expect(clientsPage.documentContract()).toBeNull();
    http.match(() => true).forEach(r => r.flush([]));
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

  it('deactivates a service with organization scope and refreshes the directory', () => {
    selectClient();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    page.deactivateService(service);
    const request = http.expectOne('/api/v1/clients/client-a/services/service-a?organizationId=org-a');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    flushDetail([]);
    expect(page.services()).toEqual([]);
    expect(page.selectedService()).toBeNull();
  });
});
