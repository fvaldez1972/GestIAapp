import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  AttendanceRecord,
  AttendanceStatus,
  Client,
  CoverageRecord,
  CoverageStatus,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  ManagedService,
  OperationsSummary,
  Organization,
  ScheduledShift,
  ScheduleVersion,
} from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';

@Component({
  selector: 'app-operations-page',
  imports: [ReactiveFormsModule],
  templateUrl: './operations-page.html',
  styleUrl: './operations-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsPage implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly attendance = signal<readonly AttendanceRecord[]>([]);
  protected readonly incidents = signal<readonly Incident[]>([]);
  protected readonly coverages = signal<readonly CoverageRecord[]>([]);
  protected readonly scheduleVersions = signal<readonly ScheduleVersion[]>([]);
  protected readonly scheduledShifts = signal<readonly ScheduledShift[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly summary = signal<OperationsSummary | null>(null);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClientId = signal('');
  protected readonly selectedServiceId = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly selectedService = computed(
    () => this.services().find((service) => service.idService === this.selectedServiceId()) ?? null,
  );

  protected readonly attendanceCount = computed(() => this.summary()?.attendanceRecords ?? this.attendance().length);
  protected readonly incidentCount = computed(() => this.summary()?.incidents ?? this.incidents().length);
  protected readonly coverageCount = computed(() => this.summary()?.coverageRecords ?? this.coverages().length);
  protected readonly coveredHours = computed(() => Math.round(((this.summary()?.coveredMinutes ?? 0) / 60) * 10) / 10);
  protected readonly publishedVersion = computed(
    () => this.scheduleVersions().find((version) => version.status === 'Published') ?? null,
  );
  protected readonly hasPublishedShifts = computed(() => this.scheduledShifts().length > 0);

  protected readonly attendanceStatuses: readonly { value: AttendanceStatus; label: string }[] = [
    { value: 'Present', label: 'Presente' },
    { value: 'Late', label: 'Retardo' },
    { value: 'Absent', label: 'Falta' },
    { value: 'Excused', label: 'Justificada' },
  ];

  protected readonly incidentSeverities: readonly { value: IncidentSeverity; label: string }[] = [
    { value: 'Low', label: 'Baja' },
    { value: 'Medium', label: 'Media' },
    { value: 'High', label: 'Alta' },
    { value: 'Critical', label: 'Crítica' },
  ];

  protected readonly incidentStatuses: readonly { value: IncidentStatus; label: string }[] = [
    { value: 'Open', label: 'Abierta' },
    { value: 'InReview', label: 'En revisión' },
    { value: 'Resolved', label: 'Resuelta' },
    { value: 'Cancelled', label: 'Cancelada' },
  ];

  protected readonly coverageStatuses: readonly { value: CoverageStatus; label: string }[] = [
    { value: 'Requested', label: 'Solicitada' },
    { value: 'Confirmed', label: 'Confirmada' },
    { value: 'Completed', label: 'Completada' },
    { value: 'Cancelled', label: 'Cancelada' },
  ];

  protected readonly attendanceForm = this.formBuilder.nonNullable.group({
    idScheduledShift: ['', [Validators.required]],
    status: ['Present' as AttendanceStatus, [Validators.required]],
    actualStartTime: [''],
    actualEndTime: [''],
    minutesLate: [0, [Validators.min(0)]],
    notes: [''],
  });

  protected readonly incidentForm = this.formBuilder.nonNullable.group({
    idScheduledShift: [''],
    incidentDate: [this.today(), [Validators.required]],
    incidentType: ['OPERATIVA', [Validators.required, Validators.maxLength(80)]],
    severity: ['Medium' as IncidentSeverity, [Validators.required]],
    status: ['Open' as IncidentStatus, [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
    resolutionNotes: [''],
  });

  protected readonly coverageForm = this.formBuilder.nonNullable.group({
    idScheduledShift: ['', [Validators.required]],
    idReplacementEmployee: ['', [Validators.required]],
    coverageStartTime: ['08:00', [Validators.required]],
    coverageEndTime: ['16:00', [Validators.required]],
    isOvernight: [false],
    status: ['Confirmed' as CoverageStatus, [Validators.required]],
    notes: [''],
  });

  ngOnInit() {
    this.loadOrganizations();
  }

  protected onOrganizationChange(event: Event) {
    this.selectedOrganizationId.set((event.target as HTMLSelectElement).value);
    this.selectedClientId.set('');
    this.selectedServiceId.set('');
    this.clients.set([]);
    this.services.set([]);
    this.clearOperationLists();
    this.loadClients();
  }

  protected onClientChange(event: Event) {
    this.selectedClientId.set((event.target as HTMLSelectElement).value);
    this.selectedServiceId.set('');
    this.services.set([]);
    this.clearOperationLists();
    this.loadServices();
  }

  protected onServiceChange(event: Event) {
    this.selectedServiceId.set((event.target as HTMLSelectElement).value);
    this.loadOperationData();
  }

  protected refresh() {
    this.loadOperationData();
  }

  protected saveAttendance() {
    const context = this.operationContext();

    if (!context || this.attendanceForm.invalid) {
      this.attendanceForm.markAllAsTouched();
      return;
    }

    const form = this.attendanceForm.getRawValue();
    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api
      .upsertAttendanceRecord(context.idClient, context.idService, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        idScheduledShift: form.idScheduledShift,
        status: form.status,
        actualStartTime: this.emptyToNull(form.actualStartTime),
        actualEndTime: this.emptyToNull(form.actualEndTime),
        minutesLate: Number(form.minutesLate) || 0,
        notes: this.emptyToNull(form.notes),
      })
      .subscribe({
        next: () => {
          this.message.set('Asistencia guardada correctamente.');
          this.loadOperationData();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo guardar la asistencia.'),
        complete: () => this.saving.set(false),
      });
  }

  protected saveIncident() {
    const context = this.operationContext();

    if (!context || this.incidentForm.invalid) {
      this.incidentForm.markAllAsTouched();
      return;
    }

    const form = this.incidentForm.getRawValue();
    const shift = this.scheduledShifts().find((item) => item.idScheduledShift === form.idScheduledShift);
    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api
      .createIncident(context.idClient, context.idService, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        idScheduledShift: this.emptyToNull(form.idScheduledShift),
        idEmployee: shift?.idEmployee ?? null,
        incidentDate: form.incidentDate,
        incidentType: form.incidentType.trim(),
        severity: form.severity,
        status: form.status,
        description: form.description.trim(),
        resolutionNotes: this.emptyToNull(form.resolutionNotes),
      })
      .subscribe({
        next: () => {
          this.message.set('Incidencia registrada correctamente.');
          this.incidentForm.patchValue({ description: '', resolutionNotes: '' });
          this.loadOperationData();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo registrar la incidencia.'),
        complete: () => this.saving.set(false),
      });
  }

  protected saveCoverage() {
    const context = this.operationContext();

    if (!context || this.coverageForm.invalid) {
      this.coverageForm.markAllAsTouched();
      return;
    }

    const form = this.coverageForm.getRawValue();
    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api
      .createCoverageRecord(context.idClient, context.idService, {
        idOrganization: context.idOrganization,
        idClient: context.idClient,
        idService: context.idService,
        idScheduledShift: form.idScheduledShift,
        idReplacementEmployee: form.idReplacementEmployee,
        coverageStartTime: form.coverageStartTime,
        coverageEndTime: form.coverageEndTime,
        isOvernight: form.isOvernight,
        status: form.status,
        notes: this.emptyToNull(form.notes),
      })
      .subscribe({
        next: () => {
          this.message.set('Cobertura registrada correctamente.');
          this.coverageForm.patchValue({ notes: '' });
          this.loadOperationData();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo registrar la cobertura.'),
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
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los servicios.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadOperationData() {
    const organizationId = this.selectedOrganizationId();
    const clientId = this.selectedClientId();
    const serviceId = this.selectedServiceId();

    if (!organizationId || !clientId || !serviceId) {
      this.clearOperationLists();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    forkJoin({
      attendance: this.api.listAttendanceRecords(organizationId, clientId, serviceId),
      incidents: this.api.listIncidents(organizationId, clientId, serviceId),
      coverages: this.api.listCoverageRecords(organizationId, clientId, serviceId),
      summary: this.api.getOperationsSummary(organizationId, clientId, serviceId),
      versions: this.api.listScheduleVersions(organizationId, clientId, serviceId),
      employees: this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 100),
    }).subscribe({
      next: ({ attendance, incidents, coverages, summary, versions, employees }) => {
        this.attendance.set(attendance);
        this.incidents.set(incidents);
        this.coverages.set(coverages);
        this.summary.set(summary);
        this.scheduleVersions.set(versions);
        this.employees.set(employees.items);
        this.loadPublishedShifts();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar la operación del servicio.'),
      complete: () => this.loading.set(false),
    });
  }

  private clearOperationLists() {
    this.attendance.set([]);
    this.incidents.set([]);
    this.coverages.set([]);
    this.scheduleVersions.set([]);
    this.scheduledShifts.set([]);
    this.employees.set([]);
    this.summary.set(null);
  }

  private loadPublishedShifts() {
    const context = this.operationContext();
    const version = this.publishedVersion();

    if (!context || !version) {
      this.scheduledShifts.set([]);
      this.resetShiftDefaults();
      return;
    }

    this.api
      .listScheduledShifts(context.idOrganization, context.idClient, context.idService, version.idScheduleVersion)
      .subscribe({
        next: (shifts) => {
          this.scheduledShifts.set(shifts);
          this.resetShiftDefaults();
        },
        error: (error: HttpErrorResponse) =>
          this.setError(error, 'No se pudieron cargar los turnos publicados del servicio.'),
      });
  }

  private resetShiftDefaults() {
    const firstShift = this.scheduledShifts()[0];
    const firstReplacement = this.employees().find((employee) => employee.idEmployee !== firstShift?.idEmployee);

    this.attendanceForm.patchValue({
      idScheduledShift: firstShift?.idScheduledShift ?? '',
      actualStartTime: firstShift?.startTime?.slice(0, 5) ?? '',
      actualEndTime: firstShift?.endTime?.slice(0, 5) ?? '',
    });

    this.incidentForm.patchValue({
      idScheduledShift: firstShift?.idScheduledShift ?? '',
    });

    this.coverageForm.patchValue({
      idScheduledShift: firstShift?.idScheduledShift ?? '',
      idReplacementEmployee: firstReplacement?.idEmployee ?? '',
      coverageStartTime: firstShift?.startTime?.slice(0, 5) ?? '08:00',
      coverageEndTime: firstShift?.endTime?.slice(0, 5) ?? '16:00',
      isOvernight: firstShift?.isOvernight ?? false,
    });
  }

  private operationContext() {
    const idOrganization = this.selectedOrganizationId();
    const idClient = this.selectedClientId();
    const idService = this.selectedServiceId();

    if (!idOrganization || !idClient || !idService) {
      return null;
    }

    return { idOrganization, idClient, idService };
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
}
