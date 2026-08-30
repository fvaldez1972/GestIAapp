import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  Client,
  ManagedService,
  Organization,
  ScheduleVersion,
  ScheduledShift,
  ServiceAssignment,
  ServiceAssignmentType,
  ServicePosition,
  ShiftPattern,
} from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';

@Component({
  selector: 'app-planning-page',
  imports: [ReactiveFormsModule],
  templateUrl: './planning-page.html',
  styleUrl: './planning-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanningPage implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly assignments = signal<readonly ServiceAssignment[]>([]);
  protected readonly versions = signal<readonly ScheduleVersion[]>([]);
  protected readonly shifts = signal<readonly ScheduledShift[]>([]);
  protected readonly publishedShifts = signal<readonly ScheduledShift[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly shiftPatterns = signal<readonly ShiftPattern[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClientId = signal('');
  protected readonly selectedServiceId = signal('');
  protected readonly selectedVersionId = signal('');
  protected readonly selectedPositionId = signal('');
  protected readonly selectedAssignmentId = signal('');
  protected readonly selectedShiftId = signal('');
  protected readonly editingVersionId = signal('');
  protected readonly activeTab = signal<PlanningTab>('calendar');
  protected readonly positionDrawerOpen = signal(false);
  protected readonly assignmentDrawerOpen = signal(false);
  protected readonly versionDrawerOpen = signal(false);
  protected readonly shiftDrawerOpen = signal(false);
  protected readonly shiftDetailOpen = signal(false);
  protected readonly conflictFilterRevision = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly generationWarnings = signal<readonly string[]>([]);

  protected readonly canWrite = computed(() => this.auth.hasPermission('PLANNING.WRITE'));
  protected readonly selectedService = computed(
    () => this.services().find((service) => service.idService === this.selectedServiceId()) ?? null,
  );
  protected readonly selectedVersion = computed(
    () => this.versions().find((version) => version.idScheduleVersion === this.selectedVersionId()) ?? null,
  );
  protected readonly selectedPosition = computed(
    () => this.positions().find((position) => position.idPosition === this.selectedPositionId()) ?? null,
  );
  protected readonly selectedAssignment = computed(
    () => this.assignments().find((assignment) => assignment.idServiceAssignment === this.selectedAssignmentId()) ?? null,
  );
  protected readonly selectedShift = computed(
    () => this.shifts().find((shift) => shift.idScheduledShift === this.selectedShiftId()) ?? null,
  );
  protected readonly publishedVersion = computed(
    () => this.versions().find((version) => version.status === 'Published') ?? null,
  );
  protected readonly draftVersions = computed(() =>
    this.versions().filter((version) => version.status === 'Draft').length,
  );
  protected readonly assignedEmployees = computed(
    () => new Set(this.assignments().map((assignment) => assignment.idEmployee)).size,
  );
  protected readonly activePatterns = computed(() => this.shiftPatterns().filter((pattern) => pattern.active));
  protected readonly plannedHours = computed(() =>
    Math.round((this.shifts().reduce((total, shift) => total + shift.durationMinutes, 0) / 60) * 10) / 10,
  );
  protected readonly publishedHours = computed(() =>
    Math.round((this.publishedShifts().reduce((total, shift) => total + shift.durationMinutes, 0) / 60) * 10) / 10,
  );
  protected readonly weeklyPlanning = computed<readonly PlanningDay[]>(() => {
    const selectedVersion = this.selectedVersion();
    const sortedShifts = [...this.shifts()].sort((left, right) =>
      `${left.shiftDate}${left.startTime}${left.employeeName}`.localeCompare(
        `${right.shiftDate}${right.startTime}${right.employeeName}`,
      ),
    );
    const dates = selectedVersion
      ? this.dateRange(selectedVersion.periodStartDate, selectedVersion.periodEndDate).slice(0, 14)
      : [...new Set(sortedShifts.map((shift) => shift.shiftDate))];

    return dates.map((date) => {
      const dayShifts = sortedShifts.filter((shift) => shift.shiftDate === date);
      return {
        date,
        label: this.weekdayLabel(date),
        shifts: dayShifts,
        totalHours: Math.round((dayShifts.reduce((total, shift) => total + shift.durationMinutes, 0) / 60) * 10) / 10,
        coveredPositions: new Set(dayShifts.map((shift) => shift.idPosition)).size,
      };
    });
  });
  protected readonly planningComparison = computed(() => {
    const selectedVersion = this.selectedVersion();
    const publishedVersion = this.publishedVersion();

    if (!selectedVersion || !publishedVersion || selectedVersion.idScheduleVersion === publishedVersion.idScheduleVersion) {
      return null;
    }

    return {
      draftName: selectedVersion.name,
      publishedName: publishedVersion.name,
      draftShifts: this.shifts().length,
      publishedShifts: this.publishedShifts().length,
      draftHours: this.plannedHours(),
      publishedHours: this.publishedHours(),
      shiftDelta: this.shifts().length - this.publishedShifts().length,
      hourDelta: Math.round((this.plannedHours() - this.publishedHours()) * 10) / 10,
      details: this.compareShifts(this.shifts(), this.publishedShifts()),
    };
  });
  protected readonly planningMatrix = computed<readonly PlanningMatrixRow[]>(() =>
    this.positions().map((position) => ({
      position,
      days: this.weeklyPlanning().map((day) => {
        const shifts = day.shifts.filter((shift) => shift.idPosition === position.idPosition);
        return {
          date: day.date,
          label: day.label,
          requiredWorkerCount: position.requiredWorkerCount,
          shifts,
          isUnderCovered: shifts.length < position.requiredWorkerCount,
        };
      }),
    })),
  );
  protected readonly planningValidation = computed<readonly PlanningValidationIssue[]>(() => {
    const issues: PlanningValidationIssue[] = [];
    const selectedVersion = this.selectedVersion();

    for (const row of this.planningMatrix()) {
      for (const day of row.days) {
        if (day.isUnderCovered) {
          issues.push({
            severity: 'danger',
            severityLabel: 'Alta',
            type: 'uncovered',
            label: 'Posición sin cubrir',
            day: day.date,
            positionId: row.position.idPosition,
            positionName: row.position.name,
            description: `${day.label} · ${row.position.codePosition}: ${day.shifts.length}/${day.requiredWorkerCount} persona(s) asignadas.`,
            recommendedAction: 'Asignar personal elegible para cubrir el requerimiento.',
            actionLabel: 'Asignar personal',
          });
        }
      }
    }

    for (const day of this.weeklyPlanning()) {
      const employeeCounts = new Map<string, { name: string; count: number }>();

      for (const shift of day.shifts) {
        const current = employeeCounts.get(shift.idEmployee) ?? { name: shift.employeeName, count: 0 };
        employeeCounts.set(shift.idEmployee, { ...current, count: current.count + 1 });
      }

      for (const duplicate of employeeCounts.values()) {
        if (duplicate.count > 1) {
          const duplicateShift = day.shifts.find((shift) => shift.employeeName === duplicate.name);
          issues.push({
            severity: 'warning',
            severityLabel: 'Media',
            type: 'duplicate',
            label: 'Empleado duplicado',
            day: day.date,
            positionId: duplicateShift?.idPosition ?? '',
            positionName: duplicateShift?.positionName ?? 'Sin posición',
            description: `${day.label} · ${duplicate.name} aparece en ${duplicate.count} turnos.`,
            recommendedAction: 'Revisar y ajustar la asignación del día.',
            actionLabel: 'Resolver',
          });
        }
      }
    }

    if (selectedVersion) {
      for (const shift of this.shifts()) {
        if (shift.shiftDate < selectedVersion.periodStartDate || shift.shiftDate > selectedVersion.periodEndDate) {
          issues.push({
            severity: 'danger',
            severityLabel: 'Media',
            type: 'outOfPeriod',
            label: 'Fuera de periodo',
            day: shift.shiftDate,
            positionId: shift.idPosition,
            positionName: shift.positionName,
            description: `${shift.shiftDate} · ${shift.employeeName} no pertenece al periodo de la versión.`,
            recommendedAction: 'Reasignar turno dentro del periodo seleccionado.',
            actionLabel: 'Revisar periodo',
          });
        }
      }
    }

    for (const assignment of this.assignments()) {
      if (!assignment.idPosition) {
        issues.push({
          severity: 'danger',
          severityLabel: 'Alta',
          type: 'eligibility',
          label: 'Elegibilidad',
          day: selectedVersion?.periodStartDate ?? '',
          positionId: '',
          positionName: 'Sin posición',
          description: `${assignment.employeeName} no tiene una posición válida asignada.`,
          recommendedAction: 'Asignar una posición antes de publicar.',
          actionLabel: 'Ver detalle',
        });
      }
    }

    return issues.slice(0, 16);
  });
  protected readonly blockingPlanningIssues = computed(() =>
    this.planningValidation().filter((issue) => issue.severity === 'danger'),
  );
  protected readonly coverageGapCount = computed(() =>
    this.planningMatrix().reduce(
      (total, row) =>
        total + row.days.reduce((dayTotal, day) => dayTotal + Math.max(day.requiredWorkerCount - day.shifts.length, 0), 0),
      0,
    ),
  );
  protected readonly duplicateShiftCount = computed(() =>
    this.planningValidation().filter((issue) => issue.label === 'Empleado duplicado').length,
  );
  protected readonly publishSummary = computed(() => ({
    validShifts: Math.max(this.shifts().length - this.blockingPlanningIssues().length, 0),
    gaps: this.coverageGapCount(),
    conflicts: this.blockingPlanningIssues().length,
    notEligible: this.eligibilityBlockCount(),
  }));
  protected readonly periodIsValid = computed(() => {
    const version = this.selectedVersion();

    if (!version) {
      return false;
    }

    return version.periodStartDate <= version.periodEndDate;
  });
  protected readonly coveragePercentage = computed(() => {
    const totalRequired = this.planningMatrix().reduce(
      (total, row) => total + row.days.reduce((dayTotal, day) => dayTotal + day.requiredWorkerCount, 0),
      0,
    );
    const covered = this.planningMatrix().reduce(
      (total, row) => total + row.days.reduce((dayTotal, day) => dayTotal + Math.min(day.shifts.length, day.requiredWorkerCount), 0),
      0,
    );

    return totalRequired ? Math.round((covered / totalRequired) * 100) : 0;
  });
  protected readonly eligibilityBlockCount = computed(() =>
    this.assignments().filter((assignment) => !assignment.idPosition).length,
  );
  protected readonly canPublishSelectedVersion = computed(() => {
    const version = this.selectedVersion();

    return Boolean(
      version &&
      version.status === 'Draft' &&
      this.shifts().length > 0 &&
      this.periodIsValid() &&
      this.coverageGapCount() === 0 &&
      this.blockingPlanningIssues().length === 0 &&
      this.eligibilityBlockCount() === 0,
    );
  });
  protected readonly publishPreparation = computed<readonly PublishPreparationItem[]>(() => [
    {
      label: 'Periodo válido',
      detail: this.selectedVersion()
        ? `${this.selectedVersion()?.periodStartDate} — ${this.selectedVersion()?.periodEndDate}`
        : 'Selecciona una versión',
      state: this.periodIsValid() ? 'ok' : 'blocked',
    },
    {
      label: 'Cobertura completa',
      detail: `${this.coveragePercentage()}% de cobertura · ${this.coverageGapCount()} hueco(s)`,
      state: this.coverageGapCount() === 0 ? 'ok' : 'warning',
    },
    {
      label: 'Personal elegible',
      detail: `${this.eligibilityBlockCount()} bloqueo(s) detectado(s)`,
      state: this.eligibilityBlockCount() === 0 ? 'ok' : 'blocked',
    },
    {
      label: 'Sin conflictos',
      detail: `${this.blockingPlanningIssues().length} conflicto(s) abiertos`,
      state: this.blockingPlanningIssues().length === 0 ? 'ok' : 'blocked',
    },
  ]);
  protected readonly filteredPlanningConflicts = computed(() => {
    this.conflictFilterRevision();
    const filters = this.conflictFilterForm.getRawValue();

    return this.planningValidation().filter(
      (issue) =>
        (!filters.type || issue.type === filters.type) &&
        (!filters.severity || issue.severityLabel === filters.severity) &&
        (!filters.day || issue.day === filters.day) &&
        (!filters.position || issue.positionId === filters.position),
    );
  });
  protected readonly conflictDays = computed(() =>
    [...new Set(this.planningValidation().map((issue) => issue.day).filter(Boolean))].sort(),
  );

  protected readonly assignmentTypes: readonly { value: ServiceAssignmentType; label: string }[] = [
    { value: 'Primary', label: 'Titular' },
    { value: 'Support', label: 'Apoyo' },
    { value: 'Relief', label: 'Relevo' },
    { value: 'TemporaryReplacement', label: 'Sustitución temporal' },
  ];

  protected readonly tabs: readonly { value: PlanningTab; label: string; help: string }[] = [
    { value: 'calendar', label: 'Calendario', help: 'Semana visual por posición.' },
    { value: 'positions', label: 'Posiciones', help: 'Puestos y personal asignado.' },
    { value: 'patterns', label: 'Patrones', help: 'Generación automática.' },
    { value: 'versions', label: 'Versiones', help: 'Borradores y publicación.' },
    { value: 'conflicts', label: 'Conflictos', help: 'Validación previa.' },
  ];

  protected readonly positionForm = this.formBuilder.nonNullable.group({
    codePosition: ['POS-001', [Validators.required, Validators.maxLength(40)]],
    name: ['Guardia operativo', [Validators.required, Validators.maxLength(160)]],
    requiredWorkerCount: [1, [Validators.required, Validators.min(1)]],
    requiredSkillProfile: [''],
    notes: [''],
  });

  protected readonly assignmentForm = this.formBuilder.nonNullable.group({
    idEmployee: ['', [Validators.required]],
    idPosition: ['', [Validators.required]],
    assignmentType: ['Primary' as ServiceAssignmentType, [Validators.required]],
    startDate: [this.today(), [Validators.required]],
    endDate: [''],
    isPrimary: [true],
    notes: [''],
  });

  protected readonly versionForm = this.formBuilder.nonNullable.group({
    idService: [''],
    baseVersionId: [''],
    name: [`Planeación ${this.today()}`, [Validators.required, Validators.maxLength(160)]],
    periodStartDate: [this.today(), [Validators.required]],
    periodEndDate: [this.addDays(6), [Validators.required]],
    notes: ['', [Validators.required, Validators.maxLength(1000)]],
  });

  protected readonly conflictFilterForm = this.formBuilder.nonNullable.group({
    type: ['' as PlanningConflictType | ''],
    severity: ['' as PlanningConflictSeverity | ''],
    day: [''],
    position: [''],
  });

  protected readonly shiftForm = this.formBuilder.nonNullable.group({
    idPosition: ['', [Validators.required]],
    idEmployee: ['', [Validators.required]],
    shiftDate: [this.today(), [Validators.required]],
    startTime: ['08:00', [Validators.required]],
    endTime: ['16:00', [Validators.required]],
    isOvernight: [false],
    notes: [''],
  });

  ngOnInit() {
    this.loadOrganizations();
  }

  protected onOrganizationChange(event: Event) {
    this.selectedOrganizationId.set((event.target as HTMLSelectElement).value);
    this.selectedClientId.set('');
    this.selectedServiceId.set('');
    this.selectedVersionId.set('');
    this.clients.set([]);
    this.services.set([]);
    this.clearPlanningData();
    this.loadClients();
  }

  protected onClientChange(event: Event) {
    this.selectedClientId.set((event.target as HTMLSelectElement).value);
    this.selectedServiceId.set('');
    this.selectedVersionId.set('');
    this.services.set([]);
    this.clearPlanningData();
    this.loadServices();
  }

  protected onServiceChange(event: Event) {
    this.selectedServiceId.set((event.target as HTMLSelectElement).value);
    this.selectedVersionId.set('');
    this.clearPlanningData();
    this.loadPlanningData();
  }

  protected onVersionChange(event: Event) {
    this.selectedVersionId.set((event.target as HTMLSelectElement).value);
    this.loadShifts();
  }

  protected refresh() {
    this.loadPlanningData();
  }

  protected setActiveTab(tab: PlanningTab) {
    this.activeTab.set(tab);
  }

  protected openNewPosition() {
    this.resetPositionForm();
    this.positionDrawerOpen.set(true);
  }

  protected closePositionDrawer() {
    this.positionDrawerOpen.set(false);
  }

  protected openNewAssignment() {
    this.resetAssignmentForm();
    this.assignmentDrawerOpen.set(true);
  }

  protected closeAssignmentDrawer() {
    this.assignmentDrawerOpen.set(false);
  }

  protected openNewVersion() {
    this.prepareNewVersionForm();
    this.versionDrawerOpen.set(true);
  }

  protected editSelectedVersion() {
    const version = this.selectedVersion();
    if (!version) {
      return;
    }

    this.editingVersionId.set(version.idScheduleVersion);
    this.versionForm.patchValue({
      idService: this.selectedServiceId(),
      baseVersionId: '',
      name: version.name,
      periodStartDate: version.periodStartDate,
      periodEndDate: version.periodEndDate,
      notes: version.notes ?? '',
    });
    this.versionDrawerOpen.set(true);
  }

  protected closeVersionDrawer() {
    if (!this.editingVersionId()) {
      this.message.set('Cambios descartados. La nueva versión no fue creada. Se mantiene la versión seleccionada.');
    }

    this.editingVersionId.set('');
    this.versionDrawerOpen.set(false);
  }

  protected openNewShift(positionId?: string, date?: string) {
    this.resetShiftForm();
    this.shiftForm.patchValue({
      idPosition: positionId || this.positions()[0]?.idPosition || '',
      shiftDate: date || this.selectedVersion()?.periodStartDate || this.today(),
    });
    this.shiftDrawerOpen.set(true);
    this.shiftDetailOpen.set(false);
  }

  protected openEditShift(shift: ScheduledShift) {
    this.patchShiftForm(shift);
    this.shiftDrawerOpen.set(true);
    this.shiftDetailOpen.set(false);
  }

  protected closeShiftDrawer() {
    this.shiftDrawerOpen.set(false);
  }

  protected closeShiftDetail() {
    this.shiftDetailOpen.set(false);
  }

  protected savePosition() {
    const context = this.context();

    if (!context || this.positionForm.invalid || !this.canWrite()) {
      this.positionForm.markAllAsTouched();
      return;
    }

    const form = this.positionForm.getRawValue();
    const payload = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      name: form.name.trim(),
      requiredWorkerCount: Number(form.requiredWorkerCount) || 1,
      requiredSkillProfile: this.emptyToNull(form.requiredSkillProfile),
      notes: this.emptyToNull(form.notes),
    };
    this.beginSave();

    const selectedPositionId = this.selectedPositionId();
    const operation = selectedPositionId
      ? this.api.updatePosition(context.idClient, context.idService, selectedPositionId, payload)
      : this.api.createPosition(context.idClient, context.idService, {
        ...payload,
        codePosition: form.codePosition.trim(),
      });

    operation.subscribe({
        next: (position) => {
          this.message.set(selectedPositionId ? 'Posición actualizada correctamente.' : 'Posición creada correctamente.');
          this.selectedPositionId.set(position.idPosition);
          this.positionDrawerOpen.set(false);
          this.loadPlanningData(position.idPosition);
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedPositionId ? 'No se pudo actualizar la posición.' : 'No se pudo crear la posición.'),
        complete: () => this.saving.set(false),
      });
  }

  protected saveAssignment() {
    const context = this.context();

    if (!context || this.assignmentForm.invalid || !this.canWrite()) {
      this.assignmentForm.markAllAsTouched();
      return;
    }

    const form = this.assignmentForm.getRawValue();
    const payload = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      idPosition: form.idPosition,
      assignmentType: form.assignmentType,
      startDate: form.startDate,
      endDate: this.emptyToNull(form.endDate),
      isPrimary: form.isPrimary,
      notes: this.emptyToNull(form.notes),
    };
    this.beginSave();

    const selectedAssignmentId = this.selectedAssignmentId();
    const operation = selectedAssignmentId
      ? this.api.updateAssignment(context.idClient, context.idService, selectedAssignmentId, payload)
      : this.api.createAssignment(context.idClient, context.idService, {
        ...payload,
        idEmployee: form.idEmployee,
      });

    operation.subscribe({
        next: () => {
          this.message.set(selectedAssignmentId ? 'Asignación actualizada correctamente.' : 'Personal asignado correctamente.');
          this.assignmentDrawerOpen.set(false);
          this.loadPlanningData();
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedAssignmentId ? 'No se pudo actualizar la asignación.' : 'No se pudo asignar el personal.'),
        complete: () => this.saving.set(false),
      });
  }

  protected saveVersion() {
    const context = this.context();

    if (!context || this.versionForm.invalid || !this.canWrite()) {
      this.versionForm.markAllAsTouched();
      return;
    }

    const form = this.versionForm.getRawValue();

    if (form.periodStartDate > form.periodEndDate) {
      this.error.set('El periodo no es válido. La fecha inicial debe ser anterior o igual a la fecha final.');
      return;
    }
    const payload = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      name: form.name.trim(),
      periodStartDate: form.periodStartDate,
      periodEndDate: form.periodEndDate,
      notes: this.emptyToNull(form.notes),
    };
    this.beginSave();

    const editingVersionId = this.editingVersionId();
    const operation = editingVersionId
      ? this.api.updateScheduleVersion(context.idClient, context.idService, editingVersionId, payload)
      : this.api.createScheduleVersion(context.idClient, context.idService, payload);

    operation.subscribe({
        next: (version) => {
          this.message.set(editingVersionId ? 'Versión actualizada correctamente.' : 'Borrador creado correctamente.');
          this.selectedVersionId.set(version.idScheduleVersion);
          this.editingVersionId.set('');
          this.versionDrawerOpen.set(false);
          this.loadPlanningData(undefined, version.idScheduleVersion);
        },
        error: (error: HttpErrorResponse) => this.setError(error, editingVersionId ? 'No se pudo actualizar la versión.' : 'No se pudo crear la versión de planeación.'),
        complete: () => this.saving.set(false),
      });
  }

  protected saveShift() {
    const context = this.context();
    const versionId = this.selectedVersionId();

    if (!context || !versionId || this.shiftForm.invalid || !this.canWrite()) {
      this.shiftForm.markAllAsTouched();
      return;
    }

    const form = this.shiftForm.getRawValue();
    const payload = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      idScheduleVersion: versionId,
      idPosition: form.idPosition,
      idEmployee: form.idEmployee,
      shiftDate: form.shiftDate,
      startTime: form.startTime,
      endTime: form.endTime,
      isOvernight: form.isOvernight,
      notes: this.emptyToNull(form.notes),
    };
    this.beginSave();

    const selectedShiftId = this.selectedShiftId();
    const operation = selectedShiftId
      ? this.api.updateScheduledShift(context.idClient, context.idService, versionId, selectedShiftId, payload)
      : this.api.createScheduledShift(context.idClient, context.idService, versionId, payload);

    operation.subscribe({
        next: () => {
          this.message.set(selectedShiftId ? 'Turno actualizado correctamente.' : 'Turno agregado a la planeación.');
          this.shiftDrawerOpen.set(false);
          this.loadShifts();
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedShiftId ? 'No se pudo actualizar el turno.' : 'No se pudo agregar el turno.'),
        complete: () => this.saving.set(false),
      });
  }

  protected selectPosition(position: ServicePosition) {
    this.selectedPositionId.set(position.idPosition);
    this.positionForm.patchValue({
      codePosition: position.codePosition,
      name: position.name,
      requiredWorkerCount: position.requiredWorkerCount,
      requiredSkillProfile: position.requiredSkillProfile ?? '',
      notes: position.notes ?? '',
    });
    this.positionDrawerOpen.set(true);
  }

  protected resetPositionForm() {
    this.selectedPositionId.set('');
    this.positionForm.reset({
      codePosition: this.nextCode('POS', this.positions().length + 1),
      name: 'Guardia operativo',
      requiredWorkerCount: 1,
      requiredSkillProfile: '',
      notes: '',
    });
  }

  protected deactivatePosition(position: ServicePosition) {
    const context = this.context();

    if (!context || !this.canWrite() || !window.confirm(`¿Desactivar la posición ${position.codePosition}?`)) {
      return;
    }

    this.beginSave();
    this.api.deactivatePosition(context.idOrganization, context.idClient, context.idService, position.idPosition).subscribe({
      next: () => {
        this.message.set('Posición desactivada correctamente.');
        if (this.selectedPositionId() === position.idPosition) {
          this.resetPositionForm();
        }
        this.loadPlanningData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar la posición.'),
      complete: () => this.saving.set(false),
    });
  }

  protected selectAssignment(assignment: ServiceAssignment) {
    this.selectedAssignmentId.set(assignment.idServiceAssignment);
    this.assignmentForm.patchValue({
      idEmployee: assignment.idEmployee,
      idPosition: assignment.idPosition ?? '',
      assignmentType: assignment.assignmentType,
      startDate: assignment.startDate,
      endDate: assignment.endDate ?? '',
      isPrimary: assignment.isPrimary,
      notes: assignment.notes ?? '',
    });
    this.assignmentDrawerOpen.set(true);
  }

  protected resetAssignmentForm() {
    this.selectedAssignmentId.set('');
    this.assignmentForm.reset({
      idEmployee: this.employees()[0]?.idEmployee ?? '',
      idPosition: this.positions()[0]?.idPosition ?? '',
      assignmentType: 'Primary',
      startDate: this.today(),
      endDate: '',
      isPrimary: true,
      notes: '',
    });
  }

  protected deactivateAssignment(assignment: ServiceAssignment) {
    const context = this.context();

    if (!context || !this.canWrite() || !window.confirm(`¿Desactivar la asignación de ${assignment.employeeName}?`)) {
      return;
    }

    this.beginSave();
    this.api.deactivateAssignment(context.idOrganization, context.idClient, context.idService, assignment.idServiceAssignment).subscribe({
      next: () => {
        this.message.set('Asignación desactivada correctamente.');
        if (this.selectedAssignmentId() === assignment.idServiceAssignment) {
          this.resetAssignmentForm();
        }
        this.loadPlanningData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar la asignación.'),
      complete: () => this.saving.set(false),
    });
  }

  protected selectVersion(version: ScheduleVersion) {
    this.selectedVersionId.set(version.idScheduleVersion);
    this.versionForm.patchValue({
      name: version.name,
      periodStartDate: version.periodStartDate,
      periodEndDate: version.periodEndDate,
      notes: version.notes ?? '',
    });
    this.resetShiftForm();
    this.loadShifts();
  }

  protected resetVersionForm() {
    this.prepareNewVersionForm();
  }

  protected prepareNewVersionForm() {
    const currentVersionId = this.selectedVersionId();
    this.editingVersionId.set('');
    this.versionForm.reset({
      idService: this.selectedServiceId(),
      baseVersionId: currentVersionId,
      name: `Planeación ${this.today()}`,
      periodStartDate: this.today(),
      periodEndDate: this.addDays(6),
      notes: '',
    });
  }

  protected selectShift(shift: ScheduledShift) {
    this.patchShiftForm(shift);
    this.shiftDetailOpen.set(true);
    this.shiftDrawerOpen.set(false);
  }

  private patchShiftForm(shift: ScheduledShift) {
    this.selectedShiftId.set(shift.idScheduledShift);
    this.shiftForm.patchValue({
      idPosition: shift.idPosition,
      idEmployee: shift.idEmployee,
      shiftDate: shift.shiftDate,
      startTime: shift.startTime.slice(0, 5),
      endTime: shift.endTime.slice(0, 5),
      isOvernight: shift.isOvernight,
      notes: shift.notes ?? '',
    });
  }

  protected onShiftDragStart(shift: ScheduledShift) {
    this.selectedShiftId.set(shift.idScheduledShift);
  }

  protected onMatrixDragOver(event: DragEvent) {
    event.preventDefault();
  }

  protected onMatrixDrop(event: DragEvent, position: ServicePosition, date: string) {
    event.preventDefault();
    const shift = this.selectedShift();

    if (!shift || !this.canWrite() || this.saving()) {
      return;
    }

    this.shiftForm.patchValue({
      idPosition: position.idPosition,
      shiftDate: date,
    });
    this.saveShift();
  }

  protected resetShiftForm() {
    this.selectedShiftId.set('');
    this.shiftForm.reset({
      idPosition: this.positions()[0]?.idPosition ?? '',
      idEmployee: this.employees()[0]?.idEmployee ?? '',
      shiftDate: this.today(),
      startTime: '08:00',
      endTime: '16:00',
      isOvernight: false,
      notes: '',
    });
  }

  protected deactivateShift(shift: ScheduledShift) {
    const context = this.context();
    const versionId = this.selectedVersionId();

    if (!context || !versionId || !this.canWrite() || !window.confirm(`¿Desactivar el turno de ${shift.employeeName}?`)) {
      return;
    }

    this.beginSave();
    this.api
      .deactivateScheduledShift(context.idOrganization, context.idClient, context.idService, versionId, shift.idScheduledShift)
      .subscribe({
        next: () => {
          this.message.set('Turno desactivado correctamente.');
          if (this.selectedShiftId() === shift.idScheduledShift) {
            this.resetShiftForm();
            this.shiftDetailOpen.set(false);
            this.shiftDrawerOpen.set(false);
          }
          this.loadShifts();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar el turno.'),
        complete: () => this.saving.set(false),
      });
  }

  protected scheduleStatusLabel(status: ScheduleVersion['status']) {
    switch (status) {
      case 'Published':
        return 'Publicada';
      case 'Superseded':
        return 'Reemplazada';
      default:
        return 'Borrador';
    }
  }

  protected visualScheduleStatusLabel(version: ScheduleVersion) {
    const hasBlockingIssues = version.idScheduleVersion === this.selectedVersionId() && this.blockingPlanningIssues().length > 0;
    const hasAuditableException = Boolean(version.notes?.toLowerCase().includes('excepción'));

    if (version.status === 'Published' && hasBlockingIssues && hasAuditableException) {
      return 'Publicada con excepción';
    }

    if (version.status === 'Published' && hasBlockingIssues) {
      return 'Bloqueada';
    }

    if (version.status === 'Draft' && hasBlockingIssues) {
      return 'Borrador con conflictos';
    }

    return this.scheduleStatusLabel(version.status);
  }

  protected visualScheduleStatusClass(version: ScheduleVersion) {
    const label = this.visualScheduleStatusLabel(version);

    if (label === 'Publicada') {
      return 'mini-pill is-success';
    }

    if (label === 'Publicada con excepción') {
      return 'mini-pill is-warning';
    }

    if (label === 'Bloqueada' || label === 'Borrador con conflictos') {
      return 'mini-pill is-danger';
    }

    if (label === 'Reemplazada') {
      return 'mini-pill is-muted';
    }

    return 'mini-pill';
  }

  protected scheduleStatusClass(status: ScheduleVersion['status']) {
    switch (status) {
      case 'Published':
        return 'mini-pill is-success';
      case 'Superseded':
        return 'mini-pill is-muted';
      default:
        return 'mini-pill';
    }
  }

  protected assignmentTypeLabel(type: ServiceAssignmentType) {
    return this.assignmentTypes.find((item) => item.value === type)?.label ?? 'Asignación';
  }

  protected formatHours(minutes: number) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours} h`;
  }

  protected formatDate(date: string) {
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(new Date(`${date}T00:00:00`));
  }

  protected matrixCellState(cell: PlanningMatrixCell) {
    if (cell.shifts.length === 0) {
      return { icon: '○', label: 'Sin asignar', tone: 'empty' };
    }

    if (cell.isUnderCovered) {
      return { icon: '⚠', label: 'Cobertura parcial', tone: 'warning' };
    }

    if (cell.shifts.some((shift) => this.shiftIssues(shift).length > 0)) {
      return { icon: '✕', label: 'Conflicto', tone: 'danger' };
    }

    return { icon: '✓', label: 'Asignado', tone: 'success' };
  }

  protected shiftIssues(shift: ScheduledShift): readonly string[] {
    const issues: string[] = [];
    const version = this.selectedVersion();

    if (version && (shift.shiftDate < version.periodStartDate || shift.shiftDate > version.periodEndDate)) {
      issues.push('Turno fuera del periodo de la versión.');
    }

    const sameDayEmployeeShifts = this.shifts().filter(
      (item) => item.shiftDate === shift.shiftDate && item.idEmployee === shift.idEmployee,
    );

    if (sameDayEmployeeShifts.length > 1) {
      issues.push('Empleado asignado más de una vez en el mismo día.');
    }

    return issues;
  }

  protected selectedShiftEligibilityLabel() {
    return 'Se valida con reglas de elegibilidad al guardar/asignar y antes de operar.';
  }

  protected preparationIcon(state: PublishPreparationItem['state']) {
    if (state === 'ok') {
      return '✓';
    }

    return state === 'warning' ? '⚠' : '✕';
  }

  protected conflictTypeLabel(type: PlanningConflictType) {
    switch (type) {
      case 'uncovered':
        return 'Posiciones sin cubrir';
      case 'duplicate':
        return 'Duplicados';
      case 'outOfPeriod':
        return 'Fuera de periodo';
      case 'eligibility':
        return 'Elegibilidad';
    }
  }

  protected conflictCount(type: PlanningConflictType) {
    return this.planningValidation().filter((issue) => issue.type === type).length;
  }

  protected refreshConflictFilters() {
    this.conflictFilterRevision.update((value) => value + 1);
  }

  protected clearConflictFilters() {
    this.conflictFilterForm.reset({ type: '', severity: '', day: '', position: '' });
    this.refreshConflictFilters();
  }

  protected resolveConflict(issue: PlanningValidationIssue) {
    if (issue.type === 'uncovered' || issue.type === 'eligibility') {
      this.activeTab.set('positions');
      this.openNewAssignment();
      return;
    }

    if (issue.type === 'outOfPeriod') {
      this.editSelectedVersion();
      return;
    }

    this.activeTab.set('calendar');
  }

  protected publishVersion() {
    const context = this.context();
    const versionId = this.selectedVersionId();

    if (!context || !versionId || !this.canWrite()) {
      return;
    }

    if (!this.canPublishSelectedVersion()) {
      this.error.set('No disponible hasta resolver bloqueos. Corrige conflictos, huecos obligatorios o personal no elegible antes de publicar.');
      return;
    }

    const replacementMessage = this.publishedVersion()
      ? ' Si existe una planeación publicada traslapada, será reemplazada.'
      : '';
    if (!window.confirm(`¿Publicar la planeación seleccionada?${replacementMessage}`)) {
      return;
    }

    this.beginSave();

    this.api.publishScheduleVersion(context.idOrganization, context.idClient, context.idService, versionId).subscribe({
      next: () => {
        this.message.set('Planeación publicada correctamente. Si había una versión publicada traslapada, quedó reemplazada.');
        this.loadPlanningData(undefined, versionId);
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo publicar la planeación.'),
      complete: () => this.saving.set(false),
    });
  }

  protected generateFromPatterns() {
    const context = this.context();
    const versionId = this.selectedVersionId();
    const version = this.selectedVersion();

    if (!context || !versionId || version?.status !== 'Draft' || !this.canWrite()) {
      return;
    }

    if (!window.confirm(`¿Generar turnos para "${version.name}" desde los patrones activos?`)) {
      return;
    }

    this.beginSave();
    this.generationWarnings.set([]);

    this.api
      .generateScheduledShifts(context.idClient, context.idService, versionId, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        idScheduleVersion: versionId,
        skipExisting: true,
      })
      .subscribe({
        next: (result) => {
          this.message.set(
            `Generación terminada: ${result.createdShifts} turno(s) creado(s), ${result.skippedShifts} omitido(s), ${result.missingAssignments} cobertura(s) sin personal suficiente.`,
          );
          this.generationWarnings.set(result.warnings);
          this.loadShifts();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron generar los turnos desde patrones.'),
        complete: () => this.saving.set(false),
      });
  }

  private loadOrganizations() {
    this.loading.set(true);
    this.error.set('');

    this.api.listOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.selectedOrganizationId.set(organizations[0]?.idOrganization ?? '');
        this.loadClients();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar las organizaciones.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadClients() {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api.listClients(organizationId, '', 1, 100).subscribe({
      next: (result) => {
        this.clients.set(result.items);
        this.selectedClientId.set(result.items[0]?.idClient ?? '');
        this.loadServices();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los clientes.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadServices() {
    const organizationId = this.selectedOrganizationId();
    const clientId = this.selectedClientId();

    if (!organizationId || !clientId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api.listServices(organizationId, clientId).subscribe({
      next: (services) => {
        this.services.set(services);
        this.selectedServiceId.set(services[0]?.idService ?? '');
        this.loadPlanningData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los servicios.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadPlanningData(preferredPositionId?: string, preferredVersionId?: string) {
    const context = this.context();

    if (!context) {
      this.clearPlanningData();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    forkJoin({
      positions: this.api.listPositions(context.idOrganization, context.idClient, context.idService),
      assignments: this.api.listAssignments(context.idOrganization, context.idClient, context.idService),
      versions: this.api.listScheduleVersions(context.idOrganization, context.idClient, context.idService),
      employees: this.workforceApi.listEmployees(context.idOrganization, '', 'Active', 1, 100),
    }).subscribe({
      next: ({ positions, assignments, versions, employees }) => {
        this.positions.set(positions);
        this.assignments.set(assignments);
        this.versions.set(versions);
        this.employees.set(employees.items);
        this.resetPlanningDefaults(preferredPositionId, preferredVersionId);
        this.loadPatternSummary(positions);
        this.loadPublishedShifts();
        this.loadShifts();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar la planeación del servicio.'),
      complete: () => this.loading.set(false),
    });
  }

  protected loadShifts() {
    const context = this.context();
    const versionId = this.selectedVersionId();

    if (!context || !versionId) {
      this.shifts.set([]);
      return;
    }

    this.api.listScheduledShifts(context.idOrganization, context.idClient, context.idService, versionId).subscribe({
      next: (shifts) => {
        this.shifts.set(shifts);
        if (this.selectedShiftId() && !shifts.some((shift) => shift.idScheduledShift === this.selectedShiftId())) {
          this.resetShiftForm();
        }
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los turnos de la versión.'),
    });
  }

  private loadPublishedShifts() {
    const context = this.context();
    const publishedVersion = this.publishedVersion();

    if (!context || !publishedVersion) {
      this.publishedShifts.set([]);
      return;
    }

    this.api
      .listScheduledShifts(context.idOrganization, context.idClient, context.idService, publishedVersion.idScheduleVersion)
      .subscribe({
        next: (shifts) => this.publishedShifts.set(shifts),
        error: () => this.publishedShifts.set([]),
      });
  }

  private resetPlanningDefaults(preferredPositionId?: string, preferredVersionId?: string) {
    const positionId = preferredPositionId ?? this.positions()[0]?.idPosition ?? '';
    const employeeId = this.employees()[0]?.idEmployee ?? '';
    const versionId =
      preferredVersionId ??
      this.publishedVersion()?.idScheduleVersion ??
      this.versions()[0]?.idScheduleVersion ??
      '';

    this.selectedVersionId.set(versionId);
    this.assignmentForm.patchValue({ idPosition: positionId, idEmployee: employeeId });
    this.shiftForm.patchValue({ idPosition: positionId, idEmployee: employeeId });
    if (preferredPositionId) {
      this.selectedPositionId.set(preferredPositionId);
    }
  }

  private clearPlanningData() {
    this.positions.set([]);
    this.assignments.set([]);
    this.versions.set([]);
    this.shifts.set([]);
    this.publishedShifts.set([]);
    this.shiftPatterns.set([]);
    this.employees.set([]);
    this.selectedPositionId.set('');
    this.selectedAssignmentId.set('');
    this.selectedShiftId.set('');
  }

  private context() {
    const idOrganization = this.selectedOrganizationId();
    const idClient = this.selectedClientId();
    const idService = this.selectedServiceId();

    if (!idOrganization || !idClient || !idService) {
      return null;
    }

    return { idOrganization, idClient, idService };
  }

  private loadPatternSummary(positions: readonly ServicePosition[]) {
    const context = this.context();

    if (!context || positions.length === 0) {
      this.shiftPatterns.set([]);
      return;
    }

    forkJoin(
      positions.map((position) =>
        this.api.listShiftPatterns(context.idOrganization, context.idClient, context.idService, position.idPosition),
      ),
    ).subscribe({
      next: (groups) => this.shiftPatterns.set(groups.flat()),
      error: () => this.shiftPatterns.set([]),
    });
  }

  private beginSave() {
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
  }

  private setError(error: HttpErrorResponse, fallback: string) {
    this.loading.set(false);
    this.saving.set(false);
    this.error.set(error.error?.detail ?? error.error?.message ?? fallback);
  }

  private emptyToNull(value: string) {
    const cleanValue = value.trim();
    return cleanValue.length > 0 ? cleanValue : null;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private dateRange(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const dates: string[] = [];

    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(date.toISOString().slice(0, 10));
    }

    return dates;
  }

  private weekdayLabel(date: string) {
    return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: '2-digit', month: 'short' }).format(
      new Date(`${date}T00:00:00`),
    );
  }

  private nextCode(prefix: string, value: number) {
    return `${prefix}-${value.toString().padStart(3, '0')}`;
  }

  private compareShifts(draftShifts: readonly ScheduledShift[], publishedShifts: readonly ScheduledShift[]) {
    const publishedBySlot = new Map(publishedShifts.map((shift) => [this.shiftSlotKey(shift), shift]));
    const draftBySlot = new Map(draftShifts.map((shift) => [this.shiftSlotKey(shift), shift]));
    const details: PlanningComparisonDetail[] = [];

    for (const shift of draftShifts) {
      const published = publishedBySlot.get(this.shiftSlotKey(shift));

      if (!published) {
        details.push({
          type: 'added',
          label: 'Turno agregado',
          severity: 'info',
          description: this.shiftDescription(shift),
        });
        continue;
      }

      if (published.idEmployee !== shift.idEmployee) {
        details.push({
          type: 'employee',
          label: 'Empleado cambiado',
          severity: 'warning',
          description: `${shift.shiftDate} · ${shift.positionCode}: ${published.employeeName} → ${shift.employeeName}`,
        });
      }
    }

    for (const shift of publishedShifts) {
      if (!draftBySlot.has(this.shiftSlotKey(shift))) {
        const samePositionDay = draftShifts.find(
          (draft) => draft.shiftDate === shift.shiftDate && draft.idPosition === shift.idPosition,
        );

        details.push({
          type: samePositionDay ? 'time' : 'removed',
          label: samePositionDay ? 'Horario modificado' : 'Turno eliminado',
          severity: samePositionDay ? 'warning' : 'danger',
          description: samePositionDay
            ? `${shift.shiftDate} · ${shift.positionCode}: ${shift.startTime}-${shift.endTime} → ${samePositionDay.startTime}-${samePositionDay.endTime}`
            : this.shiftDescription(shift),
        });
      }
    }

    return details.slice(0, 20);
  }

  private shiftSlotKey(shift: ScheduledShift) {
    return `${shift.shiftDate}|${shift.idPosition}|${shift.startTime}|${shift.endTime}|${shift.isOvernight}`;
  }

  private shiftDescription(shift: ScheduledShift) {
    return `${shift.shiftDate} · ${shift.positionCode} · ${shift.startTime}-${shift.endTime} · ${shift.employeeName}`;
  }
}

type PlanningDay = {
  readonly date: string;
  readonly label: string;
  readonly shifts: readonly ScheduledShift[];
  readonly totalHours: number;
  readonly coveredPositions: number;
};

type PlanningComparisonDetail = {
  readonly type: 'added' | 'removed' | 'employee' | 'time';
  readonly label: string;
  readonly severity: 'info' | 'warning' | 'danger';
  readonly description: string;
};

type PlanningMatrixRow = {
  readonly position: ServicePosition;
  readonly days: readonly PlanningMatrixCell[];
};

type PlanningMatrixCell = {
  readonly date: string;
  readonly label: string;
  readonly requiredWorkerCount: number;
  readonly shifts: readonly ScheduledShift[];
  readonly isUnderCovered: boolean;
};

type PlanningValidationIssue = {
  readonly severity: 'warning' | 'danger';
  readonly severityLabel: PlanningConflictSeverity;
  readonly type: PlanningConflictType;
  readonly label: string;
  readonly day: string;
  readonly positionId: string;
  readonly positionName: string;
  readonly description: string;
  readonly recommendedAction: string;
  readonly actionLabel: string;
};

type PlanningTab = 'calendar' | 'positions' | 'patterns' | 'versions' | 'conflicts';
type PlanningConflictType = 'uncovered' | 'duplicate' | 'outOfPeriod' | 'eligibility';
type PlanningConflictSeverity = 'Alta' | 'Media';

type PublishPreparationItem = {
  readonly label: string;
  readonly detail: string;
  readonly state: 'ok' | 'warning' | 'blocked';
};
