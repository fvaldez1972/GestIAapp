import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { RequestsPage } from './requests-page';

const organization = { idOrganization: 'org-a', legalName: 'Organization A', codeOrganization: 'A', active: true };

/**
 * Lo que ejecuta una solicitud del lado comercial son **puestos con precio**, no una configuración
 * de servicio. La configuración se retiró: pedía horario, jornada, vigencia y un único precio
 * mensual para todo el servicio, y ninguna de esas cosas vivía ahí —el horario lo dice el patrón de
 * turnos del puesto, la vigencia la del servicio, y el precio se cobra por puesto—.
 */
describe('RequestsPage: la ejecución crea puestos, no configuración', () => {
  let http: HttpTestingController;
  // La prueba ejercita acciones protegidas sin abrir API pública de producción.
  let page: any;

  beforeEach(() => {
    const auth = {
      session: () => ({ permissions: ['REQUESTS.READ', 'REQUESTS.WRITE'], user: { email: 'op@gestia.mx' } }),
      hasPermission: () => true,
      displayName: () => 'Operación',
      operationalOrganizationId: () => 'org-a',
      activeOrganization: () => organization,
      availableOrganizations: () => [organization],
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: SystemInfoService, useValue: {
          operationDate: () => '2026-09-04',
          timeZoneId: () => 'America/Mexico_City',
          info: () => null,
          refresh: () => undefined,
        } },
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.runInInjectionContext(() => new RequestsPage());
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    TestBed.resetTestingModule();
  });

  it('manda cada puesto con su precio, y no manda configuración', () => {
    page.activeExecutionType.set('ServiceChange');
    page.addExecutionPosition();
    page.executionPositions.at(0).patchValue({ name: 'Guardia de acceso', requiredWorkerCount: 3, monthlyPrice: 42000, isTaxIncluded: true, notes: 'Turno diurno' });
    page.executionPositions.at(1).patchValue({ name: 'Supervisor', requiredWorkerCount: 1, monthlyPrice: 18500 });

    const payload = page.buildExecutionPayload(null);

    expect(payload.serviceConfiguration).toBeUndefined();
    expect(payload.positions).toEqual([
      { name: 'Guardia de acceso', requiredWorkerCount: 3, monthlyPrice: 42000, currencyCode: 'MXN', isTaxIncluded: true, notes: 'Turno diurno', idJobPositionCatalogItem: null },
      { name: 'Supervisor', requiredWorkerCount: 1, monthlyPrice: 18500, currencyCode: 'MXN', isTaxIncluded: false, notes: null, idJobPositionCatalogItem: null },
    ]);
  });

  /**
   * Una fila en blanco es una fila que alguien abrió y no llenó. Mandarla haría que el servidor
   * rechazara toda la ejecución por un puesto sin nombre que nadie quiso capturar.
   */
  it('descarta las filas de puesto que quedaron en blanco', () => {
    page.activeExecutionType.set('ServiceChange');
    page.addExecutionPosition();
    page.executionPositions.at(0).patchValue({ name: 'Guardia de acceso' });

    const payload = page.buildExecutionPayload(null);

    expect(payload.positions).toHaveLength(1);
  });

  it('no manda puestos cuando la solicitud no toca el servicio', () => {
    page.activeExecutionType.set('CoverageSupport');
    page.executionPositions.at(0).patchValue({ name: 'Guardia de acceso' });

    expect(page.buildExecutionPayload(null).positions).toBeUndefined();
  });

  /** Sin fila no hay dónde escribir el primer puesto: quitar la última vuelve a dejar una vacía. */
  it('siempre deja al menos una fila de puesto', () => {
    page.removeExecutionPosition(0);

    expect(page.executionPositions.length).toBe(1);
    expect(page.executionPositions.at(0).getRawValue().name).toBe('');
  });
});
