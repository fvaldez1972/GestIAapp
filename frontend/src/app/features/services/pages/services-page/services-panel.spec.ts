import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { ServicesPage } from './services-page';

const ORGANIZACION = { idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Seguridad Vanguardia' };
const DIA = '2026-09-04';

const SERVICIO = {
  idService: 'srv-1',
  idClient: 'client-1',
  clientName: 'Corporativo Altavista',
  idClientSite: 'site-1',
  clientSiteName: 'Torre Altavista',
  idServiceContract: null,
  serviceContractCode: null,
  codeService: 'SRV-01',
  name: 'Vigilancia intramuros Torre Altavista',
  description: 'Accesos y recorridos preventivos',
  invoiceDescription: null,
  startDate: '2026-01-01',
  endDate: null,
  positionsCount: 2,
  requiredWorkerCount: 4,
  assignedWorkerCount: 3,
  coverageDate: DIA,
  active: true,
};

/** El token viaja como base64. No se interpreta ni se construye: se guarda y se devuelve. */
const TOKEN = 'AAAAAAAAB9E=';

const CONFIGURACION = {
  idServiceConfiguration: 'cfg-1',
  idService: 'srv-1',
  effectiveFromDate: '2026-01-01',
  effectiveToDate: '2026-08-31',
  requiredWorkerCount: 4,
  hoursPerDay: 12,
  daysPerWeek: 7,
  averageWeeklyHours: 84,
  averageMonthlyHours: 364,
  preparationLeadDays: 5,
  workScheduleDescription: 'Turnos de 07:00 a 19:00',
  specificInstructions: null,
  monthlyPrice: 120000,
  currencyCode: 'MXN',
  isTaxIncluded: false,
  active: true,
  rowVersion: TOKEN,
};

const VACANTES = [
  { idPosition: 'p-1', idService: 'srv-1', codePosition: 'P-01', name: 'Acceso principal', requiredWorkerCount: 2, assignedWorkerCount: 1, date: DIA },
  { idPosition: 'p-2', idService: 'srv-1', codePosition: 'P-02', name: 'Rondín nocturno', requiredWorkerCount: 2, assignedWorkerCount: 2, date: DIA },
];

describe('Servicios · ficha', () => {
  let http: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<ServicesPage>>;

  beforeEach(() => {
    const params = new BehaviorSubject(convertToParamMap({}));
    const permisos = ['CLIENTS.READ', 'CLIENTS.WRITE', 'PLANNING.READ', 'PLANNING.WRITE', 'WORKFORCE.READ'];

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            session: () => ({ permissions: permisos }),
            hasPermission: (p: string) => permisos.includes(p),
            operationalOrganizationId: () => 'org-a',
            activeOrganization: () => ORGANIZACION,
            availableOrganizations: () => [ORGANIZACION],
          },
        },
        {
          provide: SystemInfoService,
          useValue: { operationDate: () => DIA, timeZoneId: () => 'America/Mexico_City', info: () => null },
        },
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServicesPage);
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/api/v1/services')
      .flush({ items: [SERVICIO], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 });
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    TestBed.resetTestingModule();
  });

  const pagina = () => fixture.componentInstance as unknown as Record<string, any>;
  const raiz = () => fixture.nativeElement as HTMLElement;

  function abrir(configuraciones = [CONFIGURACION]) {
    pagina()['openService'](SERVICIO);

    http.expectOne((r) => r.url === '/api/v1/clients/client-1').flush({ idClient: 'client-1', idOrganization: 'org-a', legalName: 'Corporativo Altavista', active: true });
    http.expectOne((r) => r.url.endsWith('/sites')).flush([]);
    http.expectOne((r) => r.url.endsWith('/contracts')).flush([]);
    http.expectOne((r) => r.url.endsWith('/contacts')).flush([
      { idClientContact: 'c-1', idClientSite: 'site-1', purpose: 'Operational', fullName: 'Adriana Quiñones', jobTitle: 'Jefa de seguridad', phone: '55 4821 9033', isPrimary: true, active: true },
    ]);
    http.expectOne((r) => r.url.endsWith('/configurations')).flush(configuraciones);
    http.expectOne((r) => r.url.endsWith('/positions')).flush([]);
    http.expectOne((r) => r.url.endsWith('/assignments')).flush([]);
    http.expectOne((r) => r.url.endsWith('/positions/vacancy')).flush(VACANTES);
    http.expectOne((r) => r.url === '/api/v1/employees').flush({ items: [], page: 1, totalPages: 1 });

    fixture.detectChanges();
  }

  it('la ficha abre al lado de la tabla, no encima', () => {
    abrir();

    expect(raiz().querySelector('gi-detail-panel')).not.toBeNull();
    // La tabla sigue en pantalla: se comprime, no se tapa.
    expect(raiz().querySelectorAll('gi-data-table tbody tr').length).toBeGreaterThan(0);
  });

  it('las cuatro pestañas, y la primera se llama Datos', () => {
    abrir();
    const pestanas = Array.from(raiz().querySelectorAll('[role="tab"] > span:first-child')).map((t) =>
      t.textContent?.trim(),
    );

    expect(pestanas).toEqual(['Datos', 'Configuración', 'Posiciones', 'Asignaciones']);
  });

  /** El contador evita abrir la pestaña para descubrir si hay hueco. */
  it('Asignaciones lleva el número de vacantes en el tabulador', () => {
    abrir();
    const asignaciones = Array.from(raiz().querySelectorAll('[role="tab"]')).at(-1)!;

    // Una vacante en P-01 y ninguna en P-02.
    expect(asignaciones.querySelector('.gi-panel__count')?.textContent?.trim()).toBe('1');
  });

  it('la pestaña Datos muestra el contacto operativo de la sede, en lectura', () => {
    abrir();

    expect(raiz().textContent).toContain('Adriana Quiñones');
    expect(raiz().textContent).toContain('Jefa de seguridad');
  });

  describe('el token de concurrencia', () => {
    /**
     * <b>Lo que F2 construyó y nadie usaba.</b> El contrato acepta el token nulo, así que hasta
     * ahora la aplicación guardaba las configuraciones sin comprobación de concurrencia.
     */
    it('se devuelve igual al guardar', () => {
      abrir();
      pagina()['openEditConfiguration'](CONFIGURACION);
      pagina()['saveConfiguration']();

      const request = http.expectOne((r) => r.method === 'PUT' && r.url.includes('/configurations/'));
      expect(request.request.body.rowVersion).toBe(TOKEN);
      request.flush({ ...CONFIGURACION, rowVersion: 'AAAAAAAAB9I=' });

      http.expectOne((r) => r.url.endsWith('/configurations')).flush([CONFIGURACION]);
    });

    /**
     * El 409 de concurrencia dice **quién** corrigió el registro y **cuándo**, y su salida es
     * volver a cargar: no se arregla reintentando.
     */
    it('el 409 de concurrencia dice quién fue y ofrece recargar', () => {
      abrir();
      pagina()['openEditConfiguration'](CONFIGURACION);
      pagina()['saveConfiguration']();

      http.expectOne((r) => r.method === 'PUT').flush(
        {
          title: 'Conflicto de concurrencia',
          detail: 'Ana Ruiz, el 04 sep 2026 a las 10:05, corrigió este registro. Vuelve a cargarlo para no perder su corrección.',
        },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      expect(pagina()['conflict']()).toContain('Ana Ruiz');
      expect(pagina()['error']()).toBe('');
      expect(raiz().querySelector('.conflict')?.textContent).toContain('Volver a cargar');
    });

    /**
     * <b>No todo 409 es concurrencia.</b> Un código repetido también lo es, y ése sí se arregla
     * en el formulario: va a la franja de errores, no a la de conflicto.
     */
    it('un 409 que no es de concurrencia no se confunde con uno que sí', () => {
      abrir();
      pagina()['openEditConfiguration'](CONFIGURACION);
      pagina()['saveConfiguration']();

      http.expectOne((r) => r.method === 'PUT').flush(
        { title: 'Conflicto de datos', detail: 'Ya existe una configuración vigente en ese periodo.' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      expect(pagina()['conflict']()).toBe('');
      expect(pagina()['error']()).toContain('Ya existe una configuración vigente');
    });

    it('volver a cargar cierra el editor y relee la configuración', () => {
      abrir();
      pagina()['openEditConfiguration'](CONFIGURACION);
      pagina()['conflict'].set('Alguien la corrigió.');

      pagina()['reloadAfterConflict']();

      expect(pagina()['conflict']()).toBe('');
      expect(pagina()['configurationEditorOpen']()).toBe(false);
      http.expectOne((r) => r.url.endsWith('/configurations')).flush([CONFIGURACION]);
    });
  });

  describe('el motivo de corrección', () => {
    /** El campo aparece cuando el servidor lo exige, y **llega vacío**. */
    it('se abre vacío cuando el servidor lo pide, y no se sugiere nada', () => {
      abrir();
      pagina()['openEditConfiguration'](CONFIGURACION);
      pagina()['saveConfiguration']();

      http.expectOne((r) => r.method === 'PUT').flush(
        { title: 'Conflicto de datos', detail: 'Corregir una configuración vencida requiere motivo.' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      expect(pagina()['correctionReasonRequired']()).toBe(true);
      expect(pagina()['correctionReason']()).toBe('');

      const campo = raiz().querySelector<HTMLTextAreaElement>('textarea[minlength="10"]')!;
      expect(campo.value).toBe('');
      expect(campo.placeholder).toBe('');
    });

    it('el motivo viaja al servidor cuando se escribe', () => {
      abrir();
      pagina()['openEditConfiguration'](CONFIGURACION);
      pagina()['correctionReason'].set('Se corrigió el precio pactado en el anexo firmado.');
      pagina()['saveConfiguration']();

      const request = http.expectOne((r) => r.method === 'PUT');
      expect(request.request.body.correctionReason).toBe(
        'Se corrigió el precio pactado en el anexo firmado.',
      );
      request.flush(CONFIGURACION);
      http.expectOne((r) => r.url.endsWith('/configurations')).flush([CONFIGURACION]);
    });
  });

  describe('la cobertura por posición', () => {
    it('muestra requeridos sobre asignados y marca la vacante', () => {
      abrir();
      pagina()['activeTab'].set('assignments');
      fixture.detectChanges();

      const filas = Array.from(raiz().querySelectorAll('.vacantes tbody tr'));
      expect(filas).toHaveLength(2);
      expect(filas[0].textContent).toContain('P-01');
      expect(filas[0].querySelector('.pill--danger')?.textContent?.trim()).toBe('1 vacante');
      expect(filas[1].querySelector('.pill--active')?.textContent?.trim()).toBe('Completa');
    });
  });
});
