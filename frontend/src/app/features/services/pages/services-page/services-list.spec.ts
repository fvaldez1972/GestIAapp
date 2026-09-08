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

/**
 * Datos verosímiles y con los tres estados representados: uno corriente, uno con la vigencia
 * terminada —**activo y vencido a la vez**—, uno dado de baja, y uno con más gente que cupo.
 */
const SERVICIOS = [
  {
    idService: 'srv-1',
    idClient: 'client-1',
    clientName: 'Corporativo Altavista',
    idClientSite: 'site-1',
    clientSiteName: 'Torre Altavista',
    idServiceContract: null,
    serviceContractCode: null,
    codeService: 'SRV-01',
    name: 'Vigilancia intramuros Torre Altavista',
    description: 'Accesos y recorridos',
    invoiceDescription: null,
    startDate: '2026-01-01',
    endDate: null,
    positionsCount: 3,
    requiredWorkerCount: 4,
    assignedWorkerCount: 3,
    coverageDate: DIA,
    active: true,
  },
  {
    idService: 'srv-2',
    idClient: 'client-2',
    clientName: 'Grupo Peña Muñoz',
    idClientSite: 'site-2',
    clientSiteName: 'Planta Ñuble',
    idServiceContract: null,
    serviceContractCode: null,
    codeService: 'SRV-02',
    name: 'Monitoreo CCTV',
    description: 'Cámaras',
    invoiceDescription: null,
    startDate: '2025-01-01',
    endDate: '2026-08-31',
    positionsCount: 1,
    requiredWorkerCount: 2,
    assignedWorkerCount: 2,
    coverageDate: DIA,
    active: true,
  },
  {
    idService: 'srv-3',
    idClient: 'client-3',
    clientName: 'Ñuble Logística',
    idClientSite: 'site-3',
    clientSiteName: 'Patio norte',
    idServiceContract: null,
    serviceContractCode: null,
    codeService: 'SRV-03',
    name: 'Custodia de traslado',
    description: 'Rutas',
    invoiceDescription: null,
    startDate: '2026-03-15',
    endDate: null,
    positionsCount: 2,
    requiredWorkerCount: 2,
    assignedWorkerCount: 3,
    coverageDate: DIA,
    active: false,
  },
];

describe('Servicios · listado', () => {
  let http: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<ServicesPage>>;

  beforeEach(() => {
    const params = new BehaviorSubject(convertToParamMap({}));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            session: () => ({
              permissions: ['CLIENTS.READ', 'CLIENTS.WRITE', 'PLANNING.READ', 'WORKFORCE.READ'],
            }),
            hasPermission: (p: string) =>
              ['CLIENTS.READ', 'CLIENTS.WRITE', 'PLANNING.READ', 'WORKFORCE.READ'].includes(p),
            operationalOrganizationId: () => 'org-a',
            activeOrganization: () => ORGANIZACION,
            availableOrganizations: () => [ORGANIZACION],
          },
        },
        {
          provide: SystemInfoService,
          useValue: { operationDate: () => DIA, timeZoneId: () => 'America/Mexico_City', info: () => null },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServicesPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    TestBed.resetTestingModule();
  });

  const raiz = () => fixture.nativeElement as HTMLElement;
  const filas = () => Array.from(raiz().querySelectorAll<HTMLElement>('gi-data-table tbody tr'));

  function cargar(rows = SERVICIOS) {
    const request = http.expectOne((r) => r.url === '/api/v1/services');
    request.flush({ items: rows, totalCount: rows.length, page: 1, pageSize: 20, totalPages: 1 });
    fixture.detectChanges();
    return request;
  }

  /**
   * La razón de ser de la pantalla nueva: **el listado carga con una sola petición**. Antes eran
   * tres pasos —listar clientes, elegir uno, listar sus servicios— y no se veía un servicio hasta
   * el tercero.
   */
  it('carga con una sola petición, sin elegir cliente antes', () => {
    const request = cargar();

    expect(request.request.params.get('organizationId')).toBe('org-a');
    expect(request.request.params.get('status')).toBe('Active');
    // La cobertura se calcula al día operativo del servidor, no al del navegador.
    expect(request.request.params.get('coverageDate')).toBe(DIA);

    http.expectNone((r) => r.url === '/api/v1/clients');
    expect(filas()).toHaveLength(3);
  });

  /**
   * Los tres estados de la columna. **«Vigencia terminada» no es «Inactivo»**: el segundo servicio
   * está activo y vencido a la vez, y se distingue del tercero, que está dado de baja.
   */
  it('distingue vencido de inactivo, que no son lo mismo', () => {
    cargar();
    const estados = filas().map((fila) => fila.querySelector('.pill--active, .pill--expired, .pill--inactive'));

    expect(estados.map((p) => p?.textContent?.trim())).toEqual([
      'Activo',
      'Vigencia terminada',
      'Inactivo',
    ]);
    // Y no dependen sólo del color: la palabra va dentro.
    expect(estados[1]?.classList.contains('pill--expired')).toBe(true);
  });

  /** El hueco se ve desde el listado, que es para lo que la columna existe. */
  it('muestra asignados sobre requeridos y marca la vacante', () => {
    cargar();
    const primera = filas()[0];

    expect(primera.textContent).toContain('3 / 4');
    expect(primera.querySelector('.pill--danger')?.textContent?.trim()).toBe('1 vacante');
  });

  /** **El excedente se muestra, no se recorta**: revela una violación de control. */
  it('muestra el excedente en vez de esconderlo detrás de un cero', () => {
    cargar();
    const tercera = filas()[2];

    expect(tercera.textContent).toContain('3 / 2');
    expect(tercera.querySelector('.pill--warning')?.textContent?.trim()).toBe('1 de más');
  });

  it('la vigencia dice sin término cuando no lo tiene', () => {
    cargar();

    expect(filas()[0].textContent).toContain('01 ene 2026 — sin término');
    expect(filas()[1].textContent).toContain('01 ene 2025 — 31 ago 2026');
  });

  it('cada fila lleva su menú de acciones, con la destructiva separada', () => {
    cargar();
    const menu = filas()[0].querySelector<HTMLButtonElement>('gi-row-actions button')!;

    expect(menu.getAttribute('aria-label')).toContain('Vigilancia intramuros');

    menu.click();
    fixture.detectChanges();

    // Sólo la etiqueta: la razón de una acción inhabilitada va debajo, en su propia línea.
    const opciones = Array.from(raiz().querySelectorAll('[role="menuitem"] > span')).map((o) =>
      o.textContent?.trim(),
    );
    expect(opciones).toEqual([
      'Editar servicio',
      'Ver posiciones',
      'Documentos',
      'Desactivar servicio',
    ]);
    expect(raiz().querySelector('[role="separator"]')).not.toBeNull();

    // Abrir el menú **no** abre la ficha: el clic no burbujea a la fila.
    expect(fixture.componentInstance['selectedService']()).toBeNull();
    http.expectNone((r) => r.url.includes('/configurations'));
  });

  it('buscar y filtrar vuelven a preguntar al servidor, sin botón de aplicar', () => {
    cargar();

    fixture.componentInstance['onSearch']('peña');
    const busqueda = http.expectOne((r) => r.url === '/api/v1/services');
    expect(busqueda.request.params.get('search')).toBe('peña');
    busqueda.flush({ items: [SERVICIOS[1]], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 });

    fixture.componentInstance['onStatusFilter']('');
    const todos = http.expectOne((r) => r.url === '/api/v1/services');
    // «Todos» es el tercer modo, el que el bosquejo necesita para pintar los tres estados juntos.
    expect(todos.request.params.get('status')).toBe('All');
    todos.flush({ items: SERVICIOS, totalCount: 3, page: 1, pageSize: 20, totalPages: 1 });

    fixture.detectChanges();
    expect(raiz().querySelector('gi-filter-bar')).not.toBeNull();
    expect(raiz().querySelector('gi-filter-bar select')).toBeNull();
  });

  it('el vacío por filtro no dice lo mismo que el vacío sin datos', () => {
    fixture.componentInstance['search'].set('nada');
    cargar([]);

    expect(raiz().textContent).toMatch(/Sin servicios con este filtro/i);
    expect(raiz().textContent).not.toMatch(/Todavía no hay servicios/i);
  });

  /**
   * Quitar el filtro y crear no se estorban.
   *
   * <p>Antes el vacío por filtro cambiaba «Nuevo servicio» por «Quitar filtros», y desde fuera se
   * veía como si el botón de crear hubiera desaparecido al filtrar. Obligar a limpiar el filtro
   * para poder crear es fricción sin razón.</p>
   */
  it('el vacío por filtro ofrece las dos salidas: crear y quitar el filtro', () => {
    fixture.componentInstance['search'].set('nada');
    cargar([]);

    const acciones = Array.from(raiz().querySelectorAll('.gi-empty__action'))
      .map((b) => b.textContent?.trim());

    expect(acciones).toContain('Nuevo servicio');
    expect(acciones).toContain('Quitar filtros');
  });

  /**
   * El botón que no respondía.
   *
   * <p>Se deshabilitaba con `hasActiveSite()`, que sin cliente elegido es siempre falso: nacía
   * apagado y pulsarlo no hacía nada. Ahora se puede pulsar, y la pantalla dice qué falta.</p>
   */
  it('sin cliente elegido, «Nuevo servicio» se puede pulsar y explica qué falta', () => {
    cargar([]);

    const nuevo = Array.from(raiz().querySelectorAll<HTMLButtonElement>('.button--primary'))
      .find((b) => b.textContent?.includes('Nuevo servicio'))!;

    expect(nuevo.disabled).toBe(false);

    nuevo.click();
    fixture.detectChanges();

    expect(raiz().textContent).toMatch(/Un servicio se contrata para un cliente/i);
  });

  it('sin filtros y sin datos, ofrece crear el primero', () => {
    cargar([]);

    expect(raiz().textContent).toMatch(/Todavía no hay servicios/i);
  });
});
