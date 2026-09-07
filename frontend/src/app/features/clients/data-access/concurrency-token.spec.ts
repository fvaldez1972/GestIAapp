import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClientApiService } from './client-api.service';

/**
 * Comprueba que las seis correcciones manden el token de concurrencia.
 *
 * Es la contraparte de frontend de `ConcurrencyTokenContractTests` en el backend, y existe por lo
 * que se encontró al revisar: el servidor construyó el token, lo devolvía en cada respuesta, y el
 * frontend lo mandaba desde **un solo lugar de seis**. Ninguna petición fallaba, porque un token
 * ausente significaba «no comprobar nada»: el olvido y el comportamiento correcto se veían igual
 * desde fuera.
 *
 * Los tipos ya impiden construir una corrección sin token. Lo que los tipos no ven es si el token
 * llega al cable —un `payload` armado bien y enviado a la ruta equivocada, un parámetro de consulta
 * que se pierde—, y eso es lo que se mira aquí.
 */
describe('El token de concurrencia viaja en las seis correcciones', () => {
  let service: ClientApiService;
  let http: HttpTestingController;

  /** Un base64 cualquiera: el token no se interpreta ni se compara, sólo se devuelve. */
  const TOKEN = 'AAAAAAAAB9E=';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClientApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const base = '/api/v1/clients/client-1/services/service-1';

  it('lo manda en el cuerpo al corregir una configuración de servicio', () => {
    service
      .updateServiceConfiguration('client-1', 'service-1', 'configuration-1', {
        idOrganization: 'organization-1',
        idClient: 'client-1',
        idService: 'service-1',
        effectiveFromDate: '2026-09-01',
        effectiveToDate: null,
        requiredWorkerCount: 2,
        hoursPerDay: 8,
        daysPerWeek: 5,
        averageMonthlyHours: 176,
        preparationLeadDays: 3,
        workScheduleDescription: 'Lunes a viernes',
        specificInstructions: null,
        monthlyPrice: 10000,
        currencyCode: 'MXN',
        isTaxIncluded: false,
        rowVersion: TOKEN,
      })
      .subscribe();

    const request = http.expectOne(`${base}/configurations/configuration-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.rowVersion).toBe(TOKEN);
    request.flush({});
  });

  it('lo manda en el cuerpo al corregir una asignación', () => {
    service
      .updateAssignment('client-1', 'service-1', 'assignment-1', {
        idOrganization: 'organization-1',
        idClient: 'client-1',
        idService: 'service-1',
        idPosition: 'position-1',
        assignmentType: 'Primary',
        startDate: '2026-09-01',
        endDate: null,
        isPrimary: true,
        notes: null,
        rowVersion: TOKEN,
      })
      .subscribe();

    const request = http.expectOne(`${base}/assignments/assignment-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.rowVersion).toBe(TOKEN);
    request.flush({});
  });

  it('lo manda en el cuerpo al corregir una incidencia', () => {
    service
      .updateIncident('client-1', 'service-1', 'incident-1', {
        idOrganization: 'organization-1',
        idClient: 'client-1',
        idService: 'service-1',
        idScheduledShift: null,
        idEmployee: null,
        incidentDate: '2026-09-06',
        incidentType: 'Robo',
        severity: 'High',
        status: 'Open',
        description: 'Descripción',
        resolutionNotes: null,
        rowVersion: TOKEN,
      })
      .subscribe();

    const request = http.expectOne(`${base}/operations/incidents/incident-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.rowVersion).toBe(TOKEN);
    request.flush({});
  });

  it('lo manda en el cuerpo al corregir una cobertura', () => {
    service
      .updateCoverageRecord('client-1', 'service-1', 'coverage-1', {
        idOrganization: 'organization-1',
        idClient: 'client-1',
        idService: 'service-1',
        idScheduledShift: 'shift-1',
        idReplacementEmployee: 'employee-1',
        coverageStartTime: '08:00:00',
        coverageEndTime: '16:00:00',
        isOvernight: false,
        status: 'Confirmed',
        notes: null,
        rowVersion: TOKEN,
      })
      .subscribe();

    const request = http.expectOne(`${base}/operations/coverages/coverage-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.rowVersion).toBe(TOKEN);
    request.flush({});
  });

  it('lo manda en el cuerpo al reabrir un día operativo, porque reabrir es corregir', () => {
    service
      .reopenOperationDay('client-1', 'service-1', 'closure-1', {
        idOrganization: 'organization-1',
        reason: 'Faltó capturar dos asistencias del turno nocturno.',
        rowVersion: TOKEN,
      })
      .subscribe();

    const request = http.expectOne(`${base}/operations/day-closures/closure-1/reopen`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.rowVersion).toBe(TOKEN);
    request.flush({});
  });

  it('lo manda al corregir una asistencia ya capturada', () => {
    service
      .upsertAttendanceRecord('client-1', 'service-1', {
        idOrganization: 'organization-1',
        idClient: 'client-1',
        idService: 'service-1',
        idScheduledShift: 'shift-1',
        status: 'Late',
        actualStartTime: '08:30:00',
        actualEndTime: '16:00:00',
        minutesLate: 30,
        notes: null,
        rowVersion: TOKEN,
      })
      .subscribe();

    const request = http.expectOne(`${base}/operations/attendance`);
    expect(request.request.body.rowVersion).toBe(TOKEN);
    request.flush({});
  });

  /**
   * El alta de asistencia sigue pudiendo ir sin token, que es la única excepción del sistema y la
   * razón de que en asistencia el token sea opcional: el mismo endpoint crea o corrige, y en un
   * alta no hay versión previa que pisar.
   */
  it('no lo exige al dar de alta una asistencia, que es la única excepción', () => {
    service
      .upsertAttendanceRecord('client-1', 'service-1', {
        idOrganization: 'organization-1',
        idClient: 'client-1',
        idService: 'service-1',
        idScheduledShift: 'shift-1',
        status: 'Present',
        actualStartTime: '08:00:00',
        actualEndTime: '16:00:00',
        minutesLate: 0,
        notes: null,
      })
      .subscribe();

    const request = http.expectOne(`${base}/operations/attendance`);
    expect(request.request.body.rowVersion).toBeUndefined();
    request.flush({});
  });

  /**
   * Las bajas lógicas también son escrituras sobre una versión concreta, y su token va por la
   * cadena de consulta porque un DELETE no lleva cuerpo. Se comprueba aparte del cuerpo justo por
   * eso: es otro camino, y perderlo ahí no lo notaría ninguna de las pruebas de arriba.
   */
  it('lo manda en la consulta al desactivar una configuración y una asignación', () => {
    service
      .deactivateServiceConfiguration('organization-1', 'client-1', 'service-1', 'configuration-1', TOKEN)
      .subscribe();
    const configuration = http.expectOne(
      (candidate) => candidate.url === `${base}/configurations/configuration-1`,
    );
    expect(configuration.request.method).toBe('DELETE');
    expect(configuration.request.params.get('rowVersion')).toBe(TOKEN);
    configuration.flush(null);

    service
      .deactivateAssignment('organization-1', 'client-1', 'service-1', 'assignment-1', TOKEN)
      .subscribe();
    const assignment = http.expectOne((candidate) => candidate.url === `${base}/assignments/assignment-1`);
    expect(assignment.request.method).toBe('DELETE');
    expect(assignment.request.params.get('rowVersion')).toBe(TOKEN);
    assignment.flush(null);
  });
});
