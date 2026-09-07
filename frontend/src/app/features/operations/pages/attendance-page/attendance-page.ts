import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import {
  GiDayClosure,
  GiDetailPanel,
  GiEmptyState,
  GiOperationDayBar,
  GiSelectOption,
} from '../../../../shared/ui/gi-ui';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  ApprovalRequest,
  AttendanceRecord,
  OperationDayClosure,
  ScheduledShift,
  ScheduleVersion,
  ServicePosition,
} from '../../../clients/data-access/client.models';
import { ServiceApiService } from '../../../services/data-access/service-api.service';
import { ServiceListItem } from '../../../services/data-access/service.models';
import {
  AttendanceGap,
  AttendanceRow,
  attendanceExceptions,
  buildAttendanceDay,
  correctionNeedsReason,
  dayState,
  pendingAttendance,
} from '../../data-access/attendance-day';
import { AttendanceExceptions, ExceptionPick } from '../../ui/attendance-exceptions';
import { AttendanceDraft, AttendanceForm } from '../../ui/attendance-form';
import { AttendanceSummary } from '../../ui/attendance-summary';

/**
 * Asistencia.
 *
 * <p>Compone y carga. Los cuerpos viven en <c>ui/</c> y las piezas transversales en
 * <c>shared/ui</c>: la barra del día, el estado del cierre, la fila de excepción.</p>
 *
 * <p><b>El día viene del servidor y no se avanza al futuro.</b> Capturar la asistencia de pasado
 * mañana no quiere decir nada, así que la barra lleva tope en el día operativo. Retroceder no se
 * topa: corregir el pasado es exactamente para lo que existe el motivo.</p>
 *
 * <p><b>Todo lo del día se mide contra la versión publicada.</b> Sin ella los indicadores no dicen
 * cero: dicen que no hay contra qué medir, y ofrecen ir a Planeación.</p>
 */
@Component({
  selector: 'app-attendance-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AttendanceExceptions,
    AttendanceForm,
    AttendanceSummary,
    GiDayClosure,
    GiDetailPanel,
    GiEmptyState,
    GiOperationDayBar,
  ],
  templateUrl: './attendance-page.html',
  styleUrl: './attendance-page.scss',
})
export class AttendancePage {
  private readonly api = inject(ClientApiService);
  private readonly serviceApi = inject(ServiceApiService);
  private readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);
  private readonly router = inject(Router);

  protected readonly organizationId = this.auth.operationalOrganizationId;
  protected readonly today = this.systemInfo.operationDate;

  protected readonly canRead = computed(() => this.auth.hasPermission('OPERATIONS.READ'));
  protected readonly canWrite = computed(() => this.auth.hasPermission('OPERATIONS.WRITE'));
  protected readonly canPlan = computed(() => this.auth.hasPermission('PLANNING.READ'));

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');

  protected readonly services = signal<readonly ServiceListItem[]>([]);
  protected readonly idService = signal('');
  protected readonly date = signal('');

  protected readonly shifts = signal<readonly ScheduledShift[]>([]);
  protected readonly records = signal<readonly AttendanceRecord[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly versions = signal<readonly ScheduleVersion[]>([]);
  protected readonly closures = signal<readonly OperationDayClosure[]>([]);
  protected readonly approvals = signal<readonly ApprovalRequest[]>([]);

  /** El turno que se está capturando o corrigiendo. */
  protected readonly editing = signal<AttendanceRow | null>(null);

  protected readonly serviceOptions = computed<readonly GiSelectOption[]>(() =>
    this.services().map((service) => ({ value: service.idService, label: service.name })),
  );

  protected readonly selectedService = computed(
    () => this.services().find((service) => service.idService === this.idService()) ?? null,
  );

  /** La versión publicada que cubre el día. Sin ella no hay turnos ni nada que medir. */
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

  protected readonly day = computed(() =>
    buildAttendanceDay({
      shifts: this.shifts(),
      records: this.records(),
      positions: this.positions(),
      date: this.date(),
    }),
  );

  protected readonly exceptions = computed(() => attendanceExceptions(this.day()));
  protected readonly pending = computed(() => pendingAttendance(this.day()));

  protected readonly missingWorkers = computed(() =>
    this.day().gaps.reduce((total, gap) => total + (gap.requiredWorkerCount - gap.scheduledCount), 0),
  );

  /**
   * La foto que el cierre va a congelar.
   *
   * <p>Se calcula aquí y se enseña antes de confirmar. Es lo que se concilia con el cliente, así que
   * verla después de cerrar no sirve de nada.</p>
   */
  protected readonly snapshot = computed(() => ({
    expectedShifts: this.day().rows.length,
    attendanceRecords: this.day().rows.length - this.pending().length,
    pendingAttendance: this.pending().length,
    openIncidents: 0,
    coverageRecords: 0,
  }));

  /**
   * Las autorizaciones aprobadas que apuntan al registro que se está corrigiendo.
   *
   * <p>Se filtran por `entityId` a propósito: una autorización aprobada para <i>otra</i> asistencia
   * no permite corregir ésta, y ofrecerla en la lista invitaría a usarla y a que el servidor la
   * rechace después con un mensaje que no explica el porqué.</p>
   */
  protected readonly approvalOptions = computed<readonly GiSelectOption[]>(() => {
    const record = this.editing()?.record;

    if (!record) {
      return [];
    }

    return this.approvals()
      .filter(
        (approval) =>
          approval.active &&
          approval.status === 'Approved' &&
          approval.approvalType === 'AttendanceCorrection' &&
          approval.entityType === 'AttendanceRecord' &&
          approval.entityId === record.idAttendanceRecord,
      )
      .map((approval) => ({
        value: approval.idApprovalRequest,
        label: `${approval.reason} · aprobó ${approval.decidedByName ?? 'sin nombre'}`,
      }));
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
    this.editing.set(null);
  }

  protected onServiceChange(idService: string): void {
    this.idService.set(idService);
    this.editing.set(null);
  }

  protected capture(row: AttendanceRow): void {
    this.message.set('');
    this.error.set('');
    this.editing.set(row);
  }

  /** Una excepción de persona se abre para corregirla; el hueco lleva a Cobertura. */
  protected onException({ row }: ExceptionPick): void {
    this.capture(row);
  }

  protected onGap(gap: AttendanceGap): void {
    this.router.navigate(['/operacion/cobertura']);
    this.message.set(`${gap.positionCode} se resuelve en Cobertura: falta gente asignada, no es una falta.`);
  }

  protected goToPlanning(): void {
    this.router.navigate(['/planeacion']);
  }

  protected closeEditor(): void {
    this.editing.set(null);
  }

  protected save(draft: AttendanceDraft): void {
    const context = this.context();
    const row = this.editing();

    if (!context || !row || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.api
      .upsertAttendanceRecord(context.idClient, context.idService, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        idScheduledShift: row.idScheduledShift,
        status: draft.status,
        actualStartTime: draft.actualStartTime ? `${draft.actualStartTime}:00` : null,
        actualEndTime: draft.actualEndTime ? `${draft.actualEndTime}:00` : null,
        minutesLate: draft.minutesLate,
        notes: draft.notes,
        idApprovalRequest: draft.idApprovalRequest,
        correctionReason: draft.correctionReason ?? undefined,
        // El token viaja siempre que haya registro. En un alta no hay versión previa que pisar, y
        // ésa es la única excepción del sistema.
        rowVersion: row.record?.rowVersion,
      })
      .subscribe({
        next: () => {
          this.message.set(`Asistencia de ${row.employeeName} guardada.`);
          this.editing.set(null);
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo guardar la asistencia.'),
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
          this.message.set('El día quedó cerrado. Corregir a partir de ahora va a pedir motivo.');
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
          this.message.set('El día quedó reabierto. La foto del cierre anterior se conserva.');
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo reabrir el día.'),
        complete: () => this.saving.set(false),
      });
  }

  protected requestApproval(): void {
    this.router.navigate(['/solicitudes']);
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

  private loadDay(organizationId: string, idService: string): void {
    const service = this.services().find((item) => item.idService === idService);

    if (!service) {
      return;
    }

    this.loading.set(true);
    forkJoin({
      versions: this.api.listScheduleVersions(organizationId, service.idClient, idService),
      positions: this.api.listPositions(organizationId, service.idClient, idService),
      records: this.api
        .listAttendanceRecords(organizationId, service.idClient, idService, this.date())
        .pipe(catchError(() => of([]))),
      closures: this.api
        .listOperationDayClosures(organizationId, idService, this.date(), this.date())
        .pipe(catchError(() => of([]))),
      approvals: this.api
        .listApprovalRequests(organizationId, idService, 'Approved')
        .pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ versions, positions, records, closures, approvals }) => {
        this.versions.set(versions);
        this.positions.set(positions);
        this.records.set(records);
        this.closures.set(closures);
        this.approvals.set(approvals);
        this.loadShifts(organizationId, service.idClient, idService);
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar el día.'),
      complete: () => this.loading.set(false),
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
