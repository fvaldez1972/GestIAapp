import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import {
  GiCandidate,
  GiCandidatePicker,
  GiDetailPanel,
  GiEmptyState,
  GiOperationDayBar,
  GiSelectOption,
  GiTab,
  GiTabContent,
} from '../../../../shared/ui/gi-ui';
import { operationalDatesBetween, shiftOperationalDate } from '../../../../shared/util/operational-date';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  GenerateScheduledShiftsResponse,
  ScheduledShift,
  ScheduleVersion,
  ServiceAssignment,
  ServicePosition,
  ShiftSegment,
} from '../../../clients/data-access/client.models';
import { ServiceApiService } from '../../../services/data-access/service-api.service';
import { ServiceListItem } from '../../../services/data-access/service.models';
import {
  PlanningCell,
  buildCandidates,
  buildPlanningWeek,
  mondayOfWeek,
  planningConflicts,
  serverDayOfWeek,
} from '../../data-access/planning.models';
import { loadActiveSegments } from '../../data-access/active-segments';
import { ConflictList } from '../../ui/conflict-list';
import { PatternEditor, SegmentDraft } from '../../ui/pattern-editor';
import { PositionDraft, PositionForm } from '../../ui/position-form';
import { PublishPanel } from '../../ui/publish-panel';
import { PlanningCellPick, WeekGrid } from '../../ui/week-grid';

/**
 * Planeación.
 *
 * <p>Esta clase compone y carga. Los cuerpos viven en <c>ui/</c> —la rejilla, la fila de posición,
 * el editor de patrón, la lista de conflictos y el panel de publicación— y las piezas transversales
 * en <c>shared/ui</c>. Aquí sólo se pide al servidor, se reparte y se encadena.</p>
 *
 * <p><b>Sin cascada de cliente.</b> La organización se hereda de la barra de contexto y el servicio
 * sale del listado plano, así que no hay que elegir un cliente antes de ver una semana. Es el mismo
 * cambio que hizo Servicios cuando se encontró que el endpoint plano estaba construido y el
 * frontend nunca lo había llamado.</p>
 *
 * <p><b>La semana se deriva del día, y el día viene del servidor.</b> Nunca se calcula «hoy» aquí:
 * `systemInfo.operationDate()` lo dice en el huso operativo. Calcularlo en el navegador es el
 * defecto que estuvo vivo en diez pantallas y proponía el día siguiente cada tarde.</p>
 *
 * <p><b>Pendiente anotado, no olvidado.</b> Esta clase quedó en unas setecientas líneas, más de las
 * que se estimaron, y la razón es que sostiene <b>cinco flujos de escritura</b>: guardar un
 * segmento, quitarlo, preparar la semana, asignar a alguien y publicar. Lo que era lógica de
 * negocio ya salió a <c>buildCandidates</c> y lo que era fontanería a <c>loadActiveSegments</c>;
 * lo que queda es composición y llamadas. <b>La siguiente extracción natural es sacar esas cinco
 * escrituras a un servicio de casos de uso</b>, y se decidió no hacerla ahora para no abrir una
 * tanda extra a media pantalla.</p>
 */
@Component({
  selector: 'app-planning-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConflictList,
    GiCandidatePicker,
    GiDetailPanel,
    GiEmptyState,
    GiOperationDayBar,
    GiTabContent,
    PatternEditor,
    PositionForm,
    PublishPanel,
    WeekGrid,
  ],
  templateUrl: './planning-page.html',
  styleUrl: './planning-page.scss',
})
export class PlanningPage {
  private readonly api = inject(ClientApiService);
  private readonly serviceApi = inject(ServiceApiService);
  private readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);

  protected readonly organizationId = this.auth.operationalOrganizationId;
  protected readonly today = this.systemInfo.operationDate;

  protected readonly canRead = computed(() => this.auth.hasPermission('PLANNING.READ'));
  protected readonly canWrite = computed(() => this.auth.hasPermission('PLANNING.WRITE'));

  protected readonly loading = signal(false);
  /** Lo que el servidor observó al proyectar. Se enseña; no se resume ni se esconde. */
  protected readonly warnings = signal<readonly string[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');

  protected readonly services = signal<readonly ServiceListItem[]>([]);
  protected readonly idService = signal('');

  /** El día que ancla la semana. Arranca en el día operativo, nunca en el reloj del navegador. */
  protected readonly date = signal('');

  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly segments = signal<ReadonlyMap<string, readonly ShiftSegment[]>>(new Map());
  protected readonly versions = signal<readonly ScheduleVersion[]>([]);
  protected readonly shifts = signal<readonly ScheduledShift[]>([]);
  protected readonly assignments = signal<readonly ServiceAssignment[]>([]);

  protected readonly selectedPositionId = signal('');
  protected readonly creatingPosition = signal(false);
  protected readonly pendingCell = signal<PlanningCell | null>(null);

  protected readonly serviceOptions = computed<readonly GiSelectOption[]>(() =>
    this.services().map((service) => ({ value: service.idService, label: service.name })),
  );

  protected readonly selectedService = computed(
    () => this.services().find((service) => service.idService === this.idService()) ?? null,
  );

  protected readonly weekStart = computed(() => mondayOfWeek(this.date()));
  protected readonly weekEnd = computed(() => shiftOperationalDate(this.weekStart(), 6));
  protected readonly days = computed(() =>
    this.weekStart() ? operationalDatesBetween(this.weekStart(), this.weekEnd()) : [],
  );

  protected readonly publishedVersion = computed(
    () =>
      this.versions().find(
        (version) => version.status === 'Published' && version.periodStartDate === this.weekStart(),
      ) ?? null,
  );

  protected readonly publishedLabel = computed(() => {
    const version = this.publishedVersion();

    return version ? `${version.name}, publicada ${version.publishedAt?.slice(0, 10) ?? ''}`.trim() : '';
  });

  /** La versión sobre la que se trabaja: la publicada de esta semana, o su borrador. */
  protected readonly workingVersion = computed(
    () =>
      this.publishedVersion() ??
      this.versions().find((version) => version.periodStartDate === this.weekStart()) ??
      null,
  );

  protected readonly rows = computed(() =>
    buildPlanningWeek({
      positions: this.positions(),
      segments: this.segments(),
      shifts: this.shifts(),
      weekStart: this.weekStart(),
      weekEnd: this.weekEnd(),
    }),
  );

  protected readonly conflicts = computed(() => planningConflicts(this.rows()));

  /**
   * Los códigos de posición ya usados en el servicio, <b>activas e inactivas</b>.
   *
   * <p>Una clave única sigue ocupada aunque el registro esté inactivo, porque aquí no se borra.
   * Filtrar por activas dejaría que el alta dijera que un código está libre y el servidor
   * respondiera 409 con el formulario ya escrito.</p>
   */
  protected readonly usedPositionCodes = computed(() =>
    this.positions().map((position) => position.codePosition),
  );

  protected readonly shiftCount = computed(() =>
    this.rows().reduce(
      (total, row) => total + row.cells.reduce((suma, cell) => suma + cell.assignedWorkerCount, 0),
      0,
    ),
  );

  protected readonly selectedPosition = computed(
    () => this.positions().find((position) => position.idPosition === this.selectedPositionId()) ?? null,
  );

  protected readonly selectedSegments = computed(
    () => this.segments().get(this.selectedPositionId()) ?? [],
  );

  /** La primera pestaña se llama Datos, que es la regla del sistema para toda ficha. */
  protected readonly positionTabs: readonly GiTab[] = [
    { id: 'datos', label: 'Datos' },
    { id: 'patron', label: 'Patrón' },
  ];

  protected readonly activePositionTab = signal('datos');

  protected readonly candidates = computed<readonly GiCandidate[]>(() => {
    const cell = this.pendingCell();

    return cell
      ? buildCandidates({
          assignments: this.assignments(),
          shifts: this.shifts(),
          idPosition: this.selectedPositionId(),
          date: cell.date,
        })
      : [];
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
      const weekStart = this.weekStart();

      if (organizationId && idService && weekStart) {
        this.loadWeek(organizationId, idService);
      }
    });
  }

  protected onDateChange(date: string): void {
    this.date.set(date);
  }

  protected onServiceChange(idService: string): void {
    this.idService.set(idService);
    this.selectedPositionId.set('');
    this.pendingCell.set(null);
  }

  protected openNewPosition(): void {
    this.selectedPositionId.set('');
    this.pendingCell.set(null);
    this.creatingPosition.set(true);
  }

  protected savePosition(draft: PositionDraft): void {
    const context = this.context();

    if (!context || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.api
      .createPosition(context.idClient, context.idService, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        codePosition: draft.codePosition,
        name: draft.name,
        requiredWorkerCount: draft.requiredWorkerCount,
        requiredSkillProfile: null,
        notes: draft.notes,
      })
      .subscribe({
        next: (position) => {
          this.message.set(
            `${position.codePosition} quedó creada. Ahora declara qué turnos tiene cada día.`,
          );
          this.creatingPosition.set(false);
          this.selectedPositionId.set(position.idPosition);
          this.activePositionTab.set('patron');
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo crear la posición.'),
        complete: () => this.saving.set(false),
      });
  }

  /**
   * Da de baja la posición.
   *
   * <p><b>Se desactiva, no se borra</b>, y por eso el mensaje no dice «eliminada»: los turnos ya
   * proyectados y la asistencia que se registró contra ella siguen existiendo y siguen siendo
   * ciertos. Lo que cambia es que deja de proyectar semanas nuevas.</p>
   */
  protected deactivatePosition(): void {
    const context = this.context();
    const position = this.selectedPosition();

    if (!context || !position || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivatePosition(context.idOrganization, context.idClient, context.idService, position.idPosition)
      .subscribe({
        next: () => {
          this.message.set(
            `${position.codePosition} deja de proyectar turnos. Lo ya registrado contra ella se conserva.`,
          );
          this.selectedPositionId.set('');
          this.reload();
        },
        error: (error: HttpErrorResponse) =>
          this.setError(error, 'No se pudo dar de baja la posición.'),
        complete: () => this.saving.set(false),
      });
  }

  protected openPosition(idPosition: string): void {
    this.selectedPositionId.set(idPosition);
  }

  protected closePosition(): void {
    this.selectedPositionId.set('');
    this.creatingPosition.set(false);
  }

  /**
   * Una celda corta abre el cajón de candidatos; el resto abre la posición.
   *
   * <p>Es lo que hace que el hueco tenga salida desde donde se ve, en lugar de obligar a recordar
   * en qué posición estaba y buscarla en otra lista.</p>
   */
  protected onCellSelect({ idPosition, cell }: PlanningCellPick): void {
    this.selectedPositionId.set(idPosition);
    this.activePositionTab.set('patron');
    this.pendingCell.set(cell.kind === 'short' ? cell : null);
  }

  protected closeCandidates(): void {
    this.pendingCell.set(null);
  }

  protected chooseCandidate(candidate: GiCandidate): void {
    const cell = this.pendingCell();
    const version = this.workingVersion();
    const context = this.context();

    if (!cell || !version || !context || !this.canWrite()) {
      return;
    }

    const segmento = this.selectedSegments().find(
      (item) => item.active && item.dayOfWeek === this.diaDe(cell.date),
    );

    if (!segmento) {
      this.error.set('Ese día no tiene turno declarado en el patrón de la posición.');
      return;
    }

    this.saving.set(true);
    this.api
      .createScheduledShift(context.idClient, context.idService, version.idScheduleVersion, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        idScheduleVersion: version.idScheduleVersion,
        idPosition: this.selectedPositionId(),
        idEmployee: candidate.id,
        shiftDate: cell.date,
        startTime: segmento.startTime,
        endTime: segmento.endTime,
        isOvernight: segmento.isOvernight,
        notes: null,
      })
      .subscribe({
        next: () => {
          this.message.set(`${candidate.name} queda asignado al ${cell.date}.`);
          this.pendingCell.set(null);
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo asignar el turno.'),
        complete: () => this.saving.set(false),
      });
  }

  protected publish(): void {
    const context = this.context();
    const version = this.workingVersion();

    if (!context || !version || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.api
      .publishScheduleVersion(
        context.idOrganization,
        context.idClient,
        context.idService,
        version.idScheduleVersion,
      )
      .subscribe({
        next: () => {
          this.message.set('La semana quedó publicada.');
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo publicar la semana.'),
        complete: () => this.saving.set(false),
      });
  }

  /**
   * Guarda el día del patrón: lo crea si es nuevo, lo corrige si ya existía.
   *
   * <p>El patrón se crea solo la primera vez, con la vigencia arrancando en el lunes de la semana
   * que se está viendo. <b>No se pide al usuario que lo cree aparte</b>: declarar el primer turno
   * de una posición ya dice todo lo que el patrón necesita, y pedir dos pasos donde el segundo no
   * agrega información es lo que hace que nadie llegue al final.</p>
   */
  protected saveSegment(draft: SegmentDraft): void {
    const context = this.context();
    const idPosition = this.selectedPositionId();

    if (!context || !idPosition || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.ensurePattern(context, idPosition).subscribe({
      next: (idShiftPattern) => {
        const payload = {
          idOrganization: context.idOrganization,
          idClient: context.idClient,
          idService: context.idService,
          idPosition,
          idShiftPattern,
          dayOfWeek: draft.dayOfWeek,
          startTime: `${draft.startTime}:00`,
          endTime: `${draft.endTime}:00`,
          isOvernight: draft.isOvernight,
          requiredWorkerCount: draft.requiredWorkerCount,
          notes: null,
        };

        const peticion = draft.idShiftSegment
          ? this.api.updateShiftSegment(
              context.idClient,
              context.idService,
              idPosition,
              idShiftPattern,
              draft.idShiftSegment,
              payload,
            )
          : this.api.createShiftSegment(
              context.idClient,
              context.idService,
              idPosition,
              idShiftPattern,
              payload,
            );

        peticion.subscribe({
          next: () => {
            this.message.set('El patrón quedó guardado.');
            this.reload();
          },
          error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo guardar el turno.'),
          complete: () => this.saving.set(false),
        });
      },
      error: (error: HttpErrorResponse) => {
        this.setError(error, 'No se pudo crear el patrón de la posición.');
        this.saving.set(false);
      },
    });
  }

  protected removeSegment(segment: ShiftSegment): void {
    const context = this.context();
    const idPosition = this.selectedPositionId();

    if (!context || !idPosition || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivateShiftSegment(
        context.idOrganization,
        context.idClient,
        context.idService,
        idPosition,
        segment.idShiftPattern,
        segment.idShiftSegment,
      )
      .subscribe({
        next: () => {
          this.message.set('El día quedó sin turno declarado.');
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo quitar el turno.'),
        complete: () => this.saving.set(false),
      });
  }

  /**
   * Prepara la semana: crea la versión si no existe y proyecta los turnos desde los patrones.
   *
   * <p><b>Es un solo botón y no dos.</b> Crear una versión vacía no sirve de nada —nadie quiere una
   * semana sin turnos— y generarlos exige una versión. Separarlos dejaría un estado intermedio que
   * sólo se puede describir como «a medias».</p>
   *
   * <p><c>skipExisting</c> va en verdadero: regenerar no pisa lo que ya se asignó a mano. Volver a
   * proyectar es una operación que se repite, y perder las asignaciones cada vez la haría
   * inservible.</p>
   */
  protected prepareWeek(): void {
    const context = this.context();

    if (!context || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.ensureVersion(context).subscribe({
      next: (idScheduleVersion) => {
        this.api
          .generateScheduledShifts(context.idClient, context.idService, idScheduleVersion, {
            idOrganization: context.idOrganization,
            idClient: context.idClient,
            idService: context.idService,
            idScheduleVersion,
            skipExisting: true,
          })
          .subscribe({
            next: (resultado) => {
              this.describirProyeccion(resultado);
              this.reload();
            },
            error: (error: HttpErrorResponse) =>
              this.setError(error, 'No se pudieron proyectar los turnos.'),
            complete: () => this.saving.set(false),
          });
      },
      error: (error: HttpErrorResponse) => {
        this.setError(error, 'No se pudo preparar la semana.');
        this.saving.set(false);
      },
    });
  }

  /**
   * Qué pasó al proyectar, dicho completo.
   *
   * <p><b>«Se proyectaron 0 turnos» sin decir por qué es un resultado mudo.</b> El servidor sabe
   * cuántos se saltó porque ya existían y a cuántos les falta gente asignada, y esas dos cosas son
   * exactamente lo que explica un cero. Callarlas deja al usuario mirando una semana vacía sin
   * saber si el sistema falló o si le falta asignar personal.</p>
   */
  private describirProyeccion(resultado: GenerateScheduledShiftsResponse): void {
    const partes: string[] = [];

    partes.push(
      resultado.createdShifts === 1
        ? 'Se proyectó 1 turno desde los patrones'
        : `Se proyectaron ${resultado.createdShifts} turnos desde los patrones`,
    );

    if (resultado.skippedShifts > 0) {
      partes.push(`${resultado.skippedShifts} ya existían y no se tocaron`);
    }

    if (resultado.missingAssignments > 0) {
      partes.push(
        `${resultado.missingAssignments} ${resultado.missingAssignments === 1 ? 'turno se quedó' : 'turnos se quedaron'} ` +
          'sin gente porque no hay suficiente personal asignado al servicio',
      );
    }

    this.message.set(`${partes.join('. ')}.`);
    this.warnings.set(resultado.warnings);
  }

  /** El patrón activo de la posición, creándolo la primera vez. */
  private ensurePattern(
    context: { idOrganization: string; idClient: string; idService: string },
    idPosition: string,
  ): Observable<string> {
    const existente = this.selectedSegments()[0]?.idShiftPattern;

    if (existente) {
      return of(existente);
    }

    return this.api
      .createShiftPattern(context.idClient, context.idService, idPosition, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        idPosition,
        codeShiftPattern: `PAT-${this.selectedPosition()?.codePosition ?? idPosition.slice(0, 8)}`,
        name: `Patrón de ${this.selectedPosition()?.codePosition ?? 'la posición'}`,
        description: null,
        effectiveFromDate: this.weekStart(),
        effectiveToDate: null,
      })
      .pipe(map((pattern) => pattern.idShiftPattern));
  }

  /** La versión de esta semana, creándola la primera vez. */
  private ensureVersion(context: {
    idOrganization: string;
    idClient: string;
    idService: string;
  }): Observable<string> {
    const existente = this.workingVersion();

    if (existente) {
      return of(existente.idScheduleVersion);
    }

    return this.api
      .createScheduleVersion(context.idClient, context.idService, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        name: `Semana del ${this.weekStart()}`,
        periodStartDate: this.weekStart(),
        periodEndDate: this.weekEnd(),
        notes: null,
      })
      .pipe(map((version) => version.idScheduleVersion));
  }


  private diaDe(isoDate: string): string {
    return this.days().includes(isoDate) ? serverDayOfWeek(isoDate) : '';
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

  private loadWeek(organizationId: string, idService: string): void {
    const service = this.services().find((item) => item.idService === idService);

    if (!service) {
      return;
    }

    this.loading.set(true);
    forkJoin({
      positions: this.api.listPositions(organizationId, service.idClient, idService),
      versions: this.api.listScheduleVersions(organizationId, service.idClient, idService),
      assignments: this.api.listAssignments(organizationId, service.idClient, idService),
    }).subscribe({
      next: ({ positions, versions, assignments }) => {
        this.positions.set(positions);
        this.versions.set(versions);
        this.assignments.set(assignments);
        loadActiveSegments(this.api, {
          organizationId,
          idClient: service.idClient,
          idService,
          positions,
        }).subscribe((segments) => this.segments.set(segments));
        this.loadShifts(organizationId, service.idClient, idService);
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar la planeación.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadShifts(organizationId: string, idClient: string, idService: string): void {
    const version = this.workingVersion();

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
      this.loadWeek(organizationId, idService);
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

