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

  /**
   * Comprimirse no es cortar columnas dentro de su propio scroll: con la ficha abierta la tabla
   * muestra las tres que importan, como dibuja el bosquejo.
   */
  it('con la ficha abierta la tabla reduce sus columnas', () => {
    const antes = Array.from(raiz().querySelectorAll('gi-data-table thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(antes).toEqual(['Servicio', 'Cliente · Sede', 'Vigencia', 'Posiciones', 'Estado', '']);

    abrir();

    const despues = Array.from(raiz().querySelectorAll('gi-data-table thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(despues).toEqual(['Servicio', 'Posiciones', 'Estado', '']);
  });

  it('las tres pestañas, y la primera se llama Datos', () => {
    abrir();
    const pestanas = Array.from(raiz().querySelectorAll('[role="tab"] > span:first-child')).map((t) =>
      t.textContent?.trim(),
    );

    expect(pestanas).toEqual(['Datos', 'Posiciones', 'Asignaciones']);
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
