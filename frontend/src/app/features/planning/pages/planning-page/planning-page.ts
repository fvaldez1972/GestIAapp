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
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClientId = signal('');
  protected readonly selectedServiceId = signal('');
  protected readonly selectedVersionId = signal('');
  protected readonly selectedPositionId = signal('');
  protected readonly selectedAssignmentId = signal('');
  protected readonly selectedShiftId = signal('');
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
    };
  });

  protected readonly assignmentTypes: readonly { value: ServiceAssignmentType; label: string }[] = [
    { value: 'Primary', label: 'Titular' },
    { value: 'Support', label: 'Apoyo' },
    { value: 'Relief', label: 'Relevo' },
    { value: 'TemporaryReplacement', label: 'Sustitución temporal' },
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
    name: [`Planeación ${this.today()}`, [Validators.required, Validators.maxLength(160)]],
    periodStartDate: [this.today(), [Validators.required]],
    periodEndDate: [this.addDays(6), [Validators.required]],
    notes: [''],
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

    const selectedVersionId = this.selectedVersionId();
    const operation = selectedVersionId
      ? this.api.updateScheduleVersion(context.idClient, context.idService, selectedVersionId, payload)
      : this.api.createScheduleVersion(context.idClient, context.idService, payload);

    operation.subscribe({
        next: (version) => {
          this.message.set(selectedVersionId ? 'Versión actualizada correctamente.' : 'Versión de planeación creada correctamente.');
          this.selectedVersionId.set(version.idScheduleVersion);
          this.loadPlanningData(undefined, version.idScheduleVersion);
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedVersionId ? 'No se pudo actualizar la versión.' : 'No se pudo crear la versión de planeación.'),
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
    this.selectedVersionId.set('');
    this.versionForm.reset({
      name: `Planeación ${this.today()}`,
      periodStartDate: this.today(),
      periodEndDate: this.addDays(6),
      notes: '',
    });
    this.shifts.set([]);
    this.resetShiftForm();
  }

  protected selectShift(shift: ScheduledShift) {
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
          }
          this.loadShifts();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar el turno.'),
        complete: () => this.saving.set(false),
      });
  }

  protected publishVersion() {
    const context = this.context();
    const versionId = this.selectedVersionId();

    if (!context || !versionId || !this.canWrite()) {
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
}

type PlanningDay = {
  readonly date: string;
  readonly label: string;
  readonly shifts: readonly ScheduledShift[];
  readonly totalHours: number;
  readonly coveredPositions: number;
};
