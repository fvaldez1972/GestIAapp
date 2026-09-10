import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import {
  GiCandidate,
  GiCatalogCreation,
  GiDayClosure,
  GiDetailPanel,
  GiEmptyState,
  GiOperationDayBar,
  GiSelectOption,
  GiTabContent,
} from '../../../../shared/ui/gi-ui';
import { CatalogApiService } from '../../../catalogs/data-access/catalog-api.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  AttendanceRecord,
  CoverageRecord,
  Incident,
  OperationDayClosure,
  ScheduledShift,
  ScheduleVersion,
} from '../../../clients/data-access/client.models';
import { ServiceApiService } from '../../../services/data-access/service-api.service';
import { ServiceListItem } from '../../../services/data-access/service.models';
import { buildAttendanceDay, correctionNeedsReason, dayState } from '../../data-access/attendance-day';
import { IncidentDraft, IncidentRow, buildIncidentDay, openIncidents } from '../../data-access/incident-day';
import { CoverageDraft, CoverageForm, CoverageTarget } from '../../ui/coverage-form';
import { CoverageList } from '../../ui/coverage-list';
import { IncidentForm } from '../../ui/incident-form';
import { IncidentList } from '../../ui/incident-list';

/**
 * Incidencias y Cobertura.
 *
 * <p><b>Son una pantalla y no dos, porque el flujo las encadena.</b> Una falta abre una incidencia,
 * y la incidencia se resuelve cubriendo el turno o declarándolo sin cubrir. Separarlas obligaría a
 * saltar de una a otra recordando de qué turno se hablaba, y las dos entradas del menú caen aquí a
 * propósito.</p>
 *
 * <p><b>«Declarar el turno sin cubrir» no es un estado guardado.</b> El modelo no lo tiene, y una
 * cobertura exige nombrar suplente —que sería nombrar a quien no cubrió—. La declaración vive en la
 * <b>resolución de la incidencia</b>, y el turno al descubierto se deriva como lo deriva Inicio:
 * hubo falta y ninguna cobertura la resolvió.</p>
 */
@Component({
  selector: 'app-incidents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CoverageForm,
    CoverageList,
    GiDayClosure,
    GiDetailPanel,
    GiTabContent,
    GiEmptyState,
    GiOperationDayBar,
    IncidentForm,
    IncidentList,
  ],
  templateUrl: './incidents-page.html',
  styleUrl: './incidents-page.scss',
})
export class IncidentsPage {
  private readonly api = inject(ClientApiService);
  private readonly serviceApi = inject(ServiceApiService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);
  private readonly router = inject(Router);

  protected readonly organizationId = this.auth.operationalOrganizationId;
  protected readonly today = this.systemInfo.operationDate;

  protected readonly canRead = computed(() => this.auth.hasPermission('OPERATIONS.READ'));
  protected readonly canWrite = computed(() => this.auth.hasPermission('OPERATIONS.WRITE'));

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');

  protected readonly services = signal<readonly ServiceListItem[]>([]);
  protected readonly idService = signal('');
  protected readonly date = signal('');

  protected readonly incidents = signal<readonly Incident[]>([]);
  protected readonly coverages = signal<readonly CoverageRecord[]>([]);
  protected readonly shifts = signal<readonly ScheduledShift[]>([]);
  protected readonly records = signal<readonly AttendanceRecord[]>([]);
  protected readonly versions = signal<readonly ScheduleVersion[]>([]);
  protected readonly closures = signal<readonly OperationDayClosure[]>([]);
  protected readonly incidentReasons = signal<readonly GiSelectOption[]>([]);
  protected readonly coverageReasons = signal<readonly GiSelectOption[]>([]);

  /** Qué se está editando. Nunca las dos a la vez: son dos hechos distintos. */
  protected readonly editingIncident = signal<IncidentRow | null>(null);
  protected readonly creatingIncident = signal(false);
  protected readonly coverageTarget = signal<CoverageTarget | null>(null);
  protected readonly editingCoverage = signal<CoverageRecord | null>(null);

  protected readonly serviceOptions = computed<readonly GiSelectOption[]>(() =>
    this.services().map((service) => ({ value: service.idService, label: service.name })),
  );

  protected readonly selectedService = computed(
    () => this.services().find((service) => service.idService === this.idService()) ?? null,
  );

  protected readonly publishedVersion = computed(
    () =>
      this.versions().find(
        (version) =>
          version.status === 'Published' &&
          version.periodStartDate <= this.date() &&
          version.periodEndDate >= this.date(),
      ) ?? null,
  );

  protected readonly publishedLabel = computed(() => {
    const version = this.publishedVersion();

    return version ? `${version.name}, publicada ${version.publishedAt?.slice(0, 10) ?? ''}`.trim() : '';
  });

  protected readonly closure = computed(
    () => this.closures().find((item) => item.operationDate === this.date() && item.active) ?? null,
  );

  protected readonly dayState = computed(() => dayState(this.closure()));
  protected readonly dayClosed = computed(() => correctionNeedsReason(this.closure()));

  private readonly reasonNames = computed(
    () => new Map(this.incidentReasons().map((option) => [option.value, option.label])),
  );

  protected readonly incidentRows = computed(() =>
    buildIncidentDay({
      incidents: this.incidents(),
      reasons: this.reasonNames(),
      closure: this.closure(),
      date: this.date(),
    }),
  );

  protected readonly day = computed(() =>
    buildAttendanceDay({
      shifts: this.shifts(),
      records: this.records(),
      positions: [],
      date: this.date(),
    }),
  );

  protected readonly dayCoverages = computed(() => {
    const shiftIds = new Set(this.day().rows.map((row) => row.idScheduledShift));

    return this.coverages().filter((coverage) => coverage.active && shiftIds.has(coverage.idScheduledShift));
  });

  protected readonly snapshot = computed(() => ({
    expectedShifts: this.day().rows.length,
    attendanceRecords: this.day().rows.filter((row) => row.record !== null).length,
    pendingAttendance: this.day().rows.filter((row) => row.record === null).length,
    openIncidents: openIncidents(this.incidentRows()).length,
    coverageRecords: this.dayCoverages().length,
  }));

  /**
   * Los turnos con falta que ninguna cobertura resolvió.
   *
   * <p>Es la misma derivación que usa Inicio para contar turnos al descubierto, y por eso una
   * cobertura <b>cancelada no cuenta</b>: cancelarla es justamente dejar el turno sin cubrir.</p>
   */
  protected readonly uncovered = computed(() => {
    const cubiertos = new Set(
      this.dayCoverages()
        .filter((coverage) => coverage.status === 'Confirmed' || coverage.status === 'Completed')
        .map((coverage) => coverage.idScheduledShift),
    );

    return this.day().rows.filter(
      (row) => row.status === 'Absent' && !cubiertos.has(row.idScheduledShift),
    );
  });

  /**
   * Quién puede cubrir el turno elegido.
   *
   * <p>Nadie queda fuera. El que ya tiene turno a esa hora aparece con el aviso de qué posición
   * queda corta, que es la decisión del traslape.</p>
   */
  protected readonly candidates = computed<readonly GiCandidate[]>(() => {
    const target = this.coverageTarget();

    if (!target) {
      return [];
    }

    const ocupados = new Map(
      this.day()
        .rows.filter((row) => row.idScheduledShift !== target.idScheduledShift)
        .map((row) => [row.idEmployee, row]),
    );

    const original = this.day().rows.find((row) => row.idScheduledShift === target.idScheduledShift);

    return this.day()
      .rows.filter((row) => row.idEmployee !== original?.idEmployee)
      .map((row): GiCandidate => {
        const otro = ocupados.get(row.idEmployee);

        return otro
          ? {
              id: row.idEmployee,
              name: row.employeeName,
              role: row.positionName,
              availability: `Cubre ${otro.positionCode} ese día, ${otro.planned}`,
              standing: 'overlap',
              consequence: `Al elegirlo, ${otro.positionCode} queda con un elemento menos ese día: el hueco se mueve, no desaparece.`,
            }
          : {
              id: row.idEmployee,
              name: row.employeeName,
              role: row.positionName,
              availability: 'Sin turno ese día',
              standing: 'eligible',
            };
      });
  });

  constructor() {
    effect(() => {
      const today = this.today();

      if (today && !this.date()) {
        this.date.set(today);
      }
    });

    effect(() => {
      const organizationId = this.organizationId();

      if (organizationId && this.canRead()) {
        this.loadServices(organizationId);
        this.loadReasons(organizationId);
      }
    });

    effect(() => {
      const organizationId = this.organizationId();
      const idService = this.idService();
      const date = this.date();

      if (organizationId && idService && date) {
        this.loadDay(organizationId, idService);
      }
    });
  }

  protected onDateChange(date: string): void {
    this.date.set(date);
    this.cerrarTodo();
  }

  protected onServiceChange(idService: string): void {
    this.idService.set(idService);
    this.cerrarTodo();
  }

  protected goToPlanning(): void {
    this.router.navigate(['/planeacion']);
  }

  protected goToCatalog(): void {
    this.router.navigate(['/catalogos']);
  }

  protected newIncident(): void {
    this.cerrarTodo();
    this.creatingIncident.set(true);
  }

  protected editIncident(row: IncidentRow): void {
    this.cerrarTodo();
    this.editingIncident.set(row);
  }

  /** Cubrir un turno al descubierto: la continuación natural de una falta. */
  protected coverShift(idScheduledShift: string): void {
    const row = this.day().rows.find((item) => item.idScheduledShift === idScheduledShift);

    if (!row) {
      return;
    }

    this.cerrarTodo();
    this.coverageTarget.set({
      idScheduledShift: row.idScheduledShift,
      positionCode: row.positionCode,
      positionName: row.positionName,
      originalEmployeeName: row.employeeName,
      startTime: row.planned.slice(0, 5),
      endTime: row.planned.slice(-5),
      isOvernight: row.planned.slice(-5) <= row.planned.slice(0, 5),
    });
  }

  protected editCoverage(coverage: CoverageRecord): void {
    const row = this.day().rows.find((item) => item.idScheduledShift === coverage.idScheduledShift);

    this.cerrarTodo();
    this.editingCoverage.set(coverage);
    this.coverageTarget.set({
      idScheduledShift: coverage.idScheduledShift,
      positionCode: row?.positionCode ?? '',
      positionName: row?.positionName ?? '',
      originalEmployeeName: coverage.originalEmployeeName,
      startTime: coverage.coverageStartTime.slice(0, 5),
      endTime: coverage.coverageEndTime.slice(0, 5),
      isOvernight: coverage.isOvernight,
    });
  }

  protected cerrarTodo(): void {
    this.creatingIncident.set(false);
    this.editingIncident.set(null);
    this.coverageTarget.set(null);
    this.editingCoverage.set(null);
    this.error.set('');
  }

  protected saveIncident(draft: IncidentDraft): void {
    const context = this.context();

    if (!context || !this.canWrite()) {
      return;
    }

    const editing = this.editingIncident();
    const payload = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      idScheduledShift: editing?.incident.idScheduledShift ?? null,
      idEmployee: editing?.incident.idEmployee ?? null,
      incidentDate: this.date(),
      incidentType: draft.factReasonCode,
      severity: draft.severity,
      status: draft.status,
      description: draft.description,
      resolutionNotes: draft.resolutionNotes,
    };

    this.saving.set(true);
    const peticion = editing
      ? this.api.updateIncident(context.idClient, context.idService, editing.idIncident, {
          ...payload,
          rowVersion: editing.incident.rowVersion,
          correctionReason: draft.correctionReason ?? undefined,
        })
      : this.api.createIncident(context.idClient, context.idService, payload);

    peticion.subscribe({
      next: () => {
        this.message.set(editing ? 'La incidencia quedó corregida.' : 'La incidencia quedó registrada.');
        this.cerrarTodo();
        this.reload();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo guardar la incidencia.'),
      complete: () => this.saving.set(false),
    });
  }

  protected saveCoverage(draft: CoverageDraft): void {
    const context = this.context();
    const target = this.coverageTarget();

    if (!context || !target || !this.canWrite()) {
      return;
    }

    const editing = this.editingCoverage();
    const base = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      idReplacementEmployee: editing?.idReplacementEmployee ?? draft.idReplacementEmployee,
      coverageStartTime: `${draft.coverageStartTime}:00`,
      coverageEndTime: `${draft.coverageEndTime}:00`,
      isOvernight: draft.isOvernight,
      status: draft.status,
      notes: draft.notes,
      idCoverageReason: draft.idCoverageReason,
    };

    this.saving.set(true);
    const peticion = editing
      ? this.api.updateCoverageRecord(context.idClient, context.idService, editing.idCoverageRecord, {
          ...base,
          idScheduledShift: target.idScheduledShift,
          rowVersion: editing.rowVersion,
          correctionReason: draft.correctionReason ?? undefined,
        })
      : this.api.createCoverageRecord(context.idClient, context.idService, {
          ...base,
          idScheduledShift: target.idScheduledShift,
        });

    peticion.subscribe({
      next: () => {
        this.message.set(editing ? 'La cobertura quedó corregida.' : 'La cobertura quedó registrada.');
        this.cerrarTodo();
        this.reload();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo guardar la cobertura.'),
      complete: () => this.saving.set(false),
    });
  }

  protected closeDay(notes: string | null): void {
    const context = this.context();

    if (!context || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.api
      .closeOperationDay(context.idClient, context.idService, {
        idOrganization: context.idOrganization,
        operationDate: this.date(),
        notes,
      })
      .subscribe({
        next: () => {
          this.message.set('El día quedó cerrado.');
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cerrar el día.'),
        complete: () => this.saving.set(false),
      });
  }

  protected reopenDay(reason: string): void {
    const context = this.context();
    const closure = this.closure();

    if (!context || !closure || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.api
      .reopenOperationDay(context.idClient, context.idService, closure.idOperationDayClosure, {
        idOrganization: context.idOrganization,
        reason,
        rowVersion: closure.rowVersion,
      })
      .subscribe({
        next: () => {
          this.message.set('El día quedó reabierto.');
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo reabrir el día.'),
        complete: () => this.saving.set(false),
      });
  }

  private context() {
    const organizationId = this.organizationId();
    const service = this.selectedService();

    return organizationId && service
      ? { idOrganization: organizationId, idClient: service.idClient, idService: service.idService }
      : null;
  }

  private loadServices(organizationId: string): void {
    this.serviceApi
      .searchServices({ organizationId, status: 'Active', pageSize: 100 })
      .pipe(catchError(() => of({ items: [] as readonly ServiceListItem[] })))
      .subscribe((result) => {
        this.services.set(result.items);

        if (!this.idService() && result.items.length > 0) {
          this.idService.set(result.items[0].idService);
        }
      });
  }

  /**
   * Los motivos de los dos catálogos.
   *
   * <p>Se piden juntos y se guardan aparte: el de incidencia viaja por <b>código</b> y el de
   * cobertura por <b>identificador</b>. Es una inconsistencia del servidor, no de esta pantalla, y
   * mezclarlos haría que un motivo se guardara en el campo del otro.</p>
   */
  /**
   * Crear un motivo que no estaba en el catálogo, sin salir de la incidencia.
   *
   * <p><b>Aquí importa más que en otras pantallas.</b> Una incidencia que no se registra en el
   * momento se registra fuera del sistema, o no se registra. Antes, con el catálogo vacío, la
   * pantalla mandaba a Catálogos y había que abandonar el registro a medias.</p>
   */
  protected createIncidentReason(creation: GiCatalogCreation): void {
    this.createReason('IncidentReason', creation, 'motivos de incidencia');
  }

  protected createCoverageReason(creation: GiCatalogCreation): void {
    this.createReason('CoverageReason', creation, 'motivos de cobertura');
  }

  private createReason(
    type: 'IncidentReason' | 'CoverageReason',
    creation: GiCatalogCreation,
    etiqueta: string,
  ): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.catalogApi
      .createItem({ idOrganization: organizationId, type, name: creation.name, description: null })
      .subscribe({
        next: (creado) => {
          this.message.set(`«${creado.name}» quedó en el catálogo de ${etiqueta} y se puede reutilizar.`);
          this.loadReasons(organizationId);
        },
        error: (error: HttpErrorResponse) =>
          this.setError(error, `No se pudo agregar el motivo al catálogo de ${etiqueta}.`),
      });
  }

  private loadReasons(organizationId: string): void {
    this.catalogApi
      .listItems(organizationId)
      .pipe(catchError(() => of([])))
      .subscribe((items) => {
        this.incidentReasons.set(
          items
            // Por nombre, que es lo que Incident.IncidentType guarda. La cobertura, en cambio, va
            // por identificador porque CoverageRecord si tiene su clave foranea. Que las dos no se
            // parezcan es deuda reconocida: la incidencia deberia guardar el identificador tambien.
            .filter((item) => item.active && item.type === 'IncidentReason')
            .map((item) => ({ value: item.name, label: item.name })),
        );

        this.coverageReasons.set(
          items
            .filter((item) => item.active && item.type === 'CoverageReason')
            .map((item) => ({ value: item.idCatalogItem, label: item.name })),
        );
      });
  }

  private loadDay(organizationId: string, idService: string): void {
    const service = this.services().find((item) => item.idService === idService);

    if (!service) {
      return;
    }

    forkJoin({
      versions: this.api.listScheduleVersions(organizationId, service.idClient, idService),
      incidents: this.api
        .listIncidents(organizationId, service.idClient, idService)
        .pipe(catchError(() => of([]))),
      coverages: this.api
        .listCoverageRecords(organizationId, service.idClient, idService)
        .pipe(catchError(() => of([]))),
      records: this.api
        .listAttendanceRecords(organizationId, service.idClient, idService, this.date())
        .pipe(catchError(() => of([]))),
      closures: this.api
        .listOperationDayClosures(organizationId, idService, this.date(), this.date())
        .pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ versions, incidents, coverages, records, closures }) => {
        this.versions.set(versions);
        this.incidents.set(incidents);
        this.coverages.set(coverages);
        this.records.set(records);
        this.closures.set(closures);
        this.loadShifts(organizationId, service.idClient, idService);
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar el día.'),
    });
  }

  private loadShifts(organizationId: string, idClient: string, idService: string): void {
    const version = this.publishedVersion();

    if (!version) {
      this.shifts.set([]);
      return;
    }

    this.api
      .listScheduledShifts(organizationId, idClient, idService, version.idScheduleVersion)
      .pipe(catchError(() => of([])))
      .subscribe((shifts) => this.shifts.set(shifts));
  }

  private reload(): void {
    const organizationId = this.organizationId();
    const idService = this.idService();

    if (organizationId && idService) {
      this.loadDay(organizationId, idService);
    }
  }

  private setError(error: HttpErrorResponse, porOmision: string): void {
    const detail =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)['detail']
        : null;

    this.error.set(typeof detail === 'string' ? detail : porOmision);
  }
}
