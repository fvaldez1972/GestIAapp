import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  OperationEvidence,
  OperationEvidenceType,
  OperationsSummary,
  Organization,
  ScheduledShift,
  ScheduleVersion,
} from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';

@Component({
  selector: 'app-operations-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './operations-page.html',
  styleUrl: './operations-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsPage implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly attendance = signal<readonly AttendanceRecord[]>([]);
  protected readonly incidents = signal<readonly Incident[]>([]);
  protected readonly coverages = signal<readonly CoverageRecord[]>([]);
  protected readonly evidences = signal<readonly OperationEvidence[]>([]);
  protected readonly scheduleVersions = signal<readonly ScheduleVersion[]>([]);
  protected readonly scheduledShifts = signal<readonly ScheduledShift[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly summary = signal<OperationsSummary | null>(null);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClientId = signal('');
  protected readonly selectedServiceId = signal('');
  protected readonly selectedIncidentId = signal('');
  protected readonly selectedCoverageId = signal('');
  protected readonly selectedEvidenceId = signal('');
  protected readonly selectedAttendanceId = signal('');
  protected readonly selectedOperationDate = signal(this.today());
  protected readonly activeSection = signal<OperationSection>('asistencia');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploadingEvidenceFile = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly selectedService = computed(
    () => this.services().find((service) => service.idService === this.selectedServiceId()) ?? null,
  );

  protected readonly attendanceCount = computed(() => this.summary()?.attendanceRecords ?? this.attendance().length);
  protected readonly incidentCount = computed(() => this.summary()?.incidents ?? this.incidents().length);
  protected readonly coverageCount = computed(() => this.summary()?.coverageRecords ?? this.coverages().length);
  protected readonly coveredHours = computed(() => Math.round(((this.summary()?.coveredMinutes ?? 0) / 60) * 10) / 10);
  protected readonly sectionTitle = computed(() => {
    switch (this.activeSection()) {
      case 'incidencias':
        return 'Incidencias';
      case 'cobertura':
        return 'Cobertura';
      default:
        return 'Asistencia';
    }
  });
  protected readonly sectionDescription = computed(() => {
    switch (this.activeSection()) {
      case 'incidencias':
        return 'Registra excepciones del servicio, clasifica su severidad y deja seguimiento para operación.';
      case 'cobertura':
        return 'Captura sustituciones de personal para mantener trazable quién cubrió cada turno.';
      default:
        return 'Confirma entrada, salida, estado y retardos de los turnos publicados.';
    }
  });
  protected readonly publishedVersion = computed(
    () => this.scheduleVersions().find((version) => version.status === 'Published') ?? null,
  );
  protected readonly hasPublishedShifts = computed(() => this.scheduledShifts().length > 0);
  protected readonly selectedIncident = computed(
    () => this.incidents().find((incident) => incident.idIncident === this.selectedIncidentId()) ?? null,
  );
  protected readonly selectedCoverage = computed(
    () => this.coverages().find((coverage) => coverage.idCoverageRecord === this.selectedCoverageId()) ?? null,
  );
  protected readonly selectedEvidence = computed(
    () => this.evidences().find((evidence) => evidence.idOperationEvidence === this.selectedEvidenceId()) ?? null,
  );
  protected readonly selectedAttendance = computed(
    () => this.attendance().find((record) => record.idAttendanceRecord === this.selectedAttendanceId()) ?? null,
  );
  protected readonly evidenceRelatedOptions = computed(() => {
    switch (this.activeSection()) {
      case 'incidencias':
        return this.incidents().map((incident) => ({
          value: incident.idIncident,
          label: `${incident.incidentDate} · ${incident.incidentType} · ${incident.employeeName || 'Servicio'}`,
        }));
      case 'cobertura':
        return this.coverages().map((coverage) => ({
          value: coverage.idCoverageRecord,
          label: `${coverage.originalEmployeeName} → ${coverage.replacementEmployeeName} · ${coverage.coverageStartTime}`,
        }));
      default:
        return this.attendance().map((record) => ({
          value: record.idAttendanceRecord,
          label: `${record.attendanceDate} · ${record.employeeCode} · ${record.employeeName}`,
        }));
    }
  });
  protected readonly visibleEvidences = computed(() =>
    this.evidences().filter((evidence) => this.evidenceSection(evidence) === this.activeSection()),
  );
  protected readonly dailyBoard = computed<readonly OperationDayShift[]>(() => {
    const operationDate = this.selectedOperationDate();
    return this.scheduledShifts()
      .filter((shift) => shift.shiftDate === operationDate)
      .map((shift) => ({
        shift,
        attendance: this.attendance().find((record) => record.idScheduledShift === shift.idScheduledShift) ?? null,
        coverage: this.coverages().find((coverage) => coverage.idScheduledShift === shift.idScheduledShift) ?? null,
        incidents: this.incidents().filter((incident) => incident.idScheduledShift === shift.idScheduledShift),
      }));
  });
  protected readonly pendingAttendanceCount = computed(
    () => this.dailyBoard().filter((item) => !item.attendance).length,
  );
  protected readonly openDailyIncidents = computed(
    () =>
      this.incidents().filter(
        (incident) =>
          incident.incidentDate === this.selectedOperationDate() &&
          (incident.status === 'Open' || incident.status === 'InReview'),
      ).length,
  );

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

  protected readonly evidenceTypes: readonly { value: OperationEvidenceType; label: string }[] = [
    { value: 'Photo', label: 'Foto' },
    { value: 'Document', label: 'Documento' },
    { value: 'Report', label: 'Reporte' },
    { value: 'Signature', label: 'Firma' },
    { value: 'Other', label: 'Otro' },
  ];

  protected readonly attendanceForm = this.formBuilder.nonNullable.group({
    idScheduledShift: ['', [Validators.required]],
    status: ['Present' as AttendanceStatus, [Validators.required]],
    actualStartTime: [''],
    actualEndTime: [''],
    minutesLate: [0, [Validators.min(0)]],
    notes: [''],
    correctionAuthorizationNotes: [''],
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

  protected readonly evidenceForm = this.formBuilder.nonNullable.group({
    relatedRecordId: ['', [Validators.required]],
    evidenceType: ['Photo' as OperationEvidenceType, [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    storageReference: ['', [Validators.required, Validators.maxLength(500)]],
    notes: [''],
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const section = params.get('section');

      if (isOperationSection(section)) {
        const previousSection = this.activeSection();
        this.activeSection.set(section);
        if (previousSection !== section) {
          this.resetEvidenceForm();
        }
        return;
      }

      void this.router.navigateByUrl('/operacion/asistencia');
    });

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

  protected onOperationDateChange(event: Event) {
    this.selectedOperationDate.set((event.target as HTMLInputElement).value);
  }

  protected confirmDailyAttendance() {
    const context = this.operationContext();
    const pending = this.dailyBoard().filter((item) => !item.attendance);

    if (!context || pending.length === 0 || !window.confirm(`¿Confirmar ${pending.length} asistencia(s) como presente?`)) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    forkJoin(
      pending.map((item) =>
        this.api.upsertAttendanceRecord(context.idClient, context.idService, {
          idOrganization: context.idOrganization,
          idClient: context.idClient,
          idService: context.idService,
          idScheduledShift: item.shift.idScheduledShift,
          status: 'Present',
          actualStartTime: item.shift.startTime,
          actualEndTime: item.shift.endTime,
          minutesLate: 0,
          notes: 'Confirmación masiva desde tablero diario.',
        }),
      ),
    ).subscribe({
      next: () => {
        this.message.set('Asistencia diaria confirmada correctamente.');
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo confirmar la asistencia masiva.'),
      complete: () => this.saving.set(false),
    });
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
        correctionAuthorizationNotes: this.selectedAttendance()
          ? this.emptyToNull(form.correctionAuthorizationNotes)
          : null,
      })
      .subscribe({
        next: () => {
          this.message.set('Asistencia guardada correctamente.');
          this.loadOperationData();
          this.resetAttendanceForm();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo guardar la asistencia.'),
        complete: () => this.saving.set(false),
      });
  }

  protected selectAttendance(record: AttendanceRecord) {
    this.selectedAttendanceId.set(record.idAttendanceRecord);
    this.attendanceForm.patchValue({
      idScheduledShift: record.idScheduledShift,
      status: record.status,
      actualStartTime: record.actualStartTime?.slice(0, 5) ?? '',
      actualEndTime: record.actualEndTime?.slice(0, 5) ?? '',
      minutesLate: record.minutesLate,
      notes: record.notes ?? '',
      correctionAuthorizationNotes: '',
    });
  }

  protected resetAttendanceForm() {
    this.selectedAttendanceId.set('');
    const firstShift = this.scheduledShifts()[0];
    this.attendanceForm.reset({
      idScheduledShift: firstShift?.idScheduledShift ?? '',
      status: 'Present',
      actualStartTime: firstShift?.startTime?.slice(0, 5) ?? '',
      actualEndTime: firstShift?.endTime?.slice(0, 5) ?? '',
      minutesLate: 0,
      notes: '',
      correctionAuthorizationNotes: '',
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

    const payload = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      idScheduledShift: this.emptyToNull(form.idScheduledShift),
      idEmployee: shift?.idEmployee ?? this.selectedIncident()?.idEmployee ?? null,
      incidentDate: form.incidentDate,
      incidentType: form.incidentType.trim(),
      severity: form.severity,
      status: form.status,
      description: form.description.trim(),
      resolutionNotes: this.emptyToNull(form.resolutionNotes),
    };
    const selectedIncidentId = this.selectedIncidentId();
    const request = selectedIncidentId
      ? this.api.updateIncident(context.idClient, context.idService, selectedIncidentId, payload)
      : this.api.createIncident(context.idClient, context.idService, payload);

    request.subscribe({
        next: () => {
          this.message.set(selectedIncidentId ? 'Incidencia actualizada correctamente.' : 'Incidencia registrada correctamente.');
          if (!selectedIncidentId) {
            this.incidentForm.patchValue({ description: '', resolutionNotes: '' });
          }
          this.loadOperationData();
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedIncidentId ? 'No se pudo actualizar la incidencia.' : 'No se pudo registrar la incidencia.'),
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

    const payload = {
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
    };
    const selectedCoverageId = this.selectedCoverageId();
    const request = selectedCoverageId
      ? this.api.updateCoverageRecord(context.idClient, context.idService, selectedCoverageId, payload)
      : this.api.createCoverageRecord(context.idClient, context.idService, payload);

    request.subscribe({
        next: () => {
          this.message.set(selectedCoverageId ? 'Cobertura actualizada correctamente.' : 'Cobertura registrada correctamente.');
          if (!selectedCoverageId) {
            this.coverageForm.patchValue({ notes: '' });
          }
          this.loadOperationData();
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedCoverageId ? 'No se pudo actualizar la cobertura.' : 'No se pudo registrar la cobertura.'),
        complete: () => this.saving.set(false),
      });
  }

  protected selectIncident(incident: Incident) {
    this.selectedIncidentId.set(incident.idIncident);
    this.incidentForm.patchValue({
      idScheduledShift: incident.idScheduledShift ?? '',
      incidentDate: incident.incidentDate,
      incidentType: incident.incidentType,
      severity: incident.severity,
      status: incident.status,
      description: incident.description,
      resolutionNotes: incident.resolutionNotes ?? '',
    });
  }

  protected resetIncidentForm() {
    this.selectedIncidentId.set('');
    this.incidentForm.reset({
      idScheduledShift: this.scheduledShifts()[0]?.idScheduledShift ?? '',
      incidentDate: this.today(),
      incidentType: 'OPERATIVA',
      severity: 'Medium',
      status: 'Open',
      description: '',
      resolutionNotes: '',
    });
  }

  protected resolveSelectedIncident() {
    const selectedIncident = this.selectedIncident();

    if (!selectedIncident) {
      return;
    }

    const resolutionNotes = this.incidentForm.controls.resolutionNotes.value.trim();
    if (!resolutionNotes) {
      this.error.set('Para cerrar formalmente una incidencia necesitas capturar la resolución.');
      return;
    }

    this.incidentForm.patchValue({ status: 'Resolved' });
    this.saveIncident();
  }

  protected selectCoverage(coverage: CoverageRecord) {
    this.selectedCoverageId.set(coverage.idCoverageRecord);
    this.coverageForm.patchValue({
      idScheduledShift: coverage.idScheduledShift,
      idReplacementEmployee: coverage.idReplacementEmployee,
      coverageStartTime: coverage.coverageStartTime.slice(0, 5),
      coverageEndTime: coverage.coverageEndTime.slice(0, 5),
      isOvernight: coverage.isOvernight,
      status: coverage.status,
      notes: coverage.notes ?? '',
    });
  }

  protected resetCoverageForm() {
    const firstShift = this.scheduledShifts()[0];
    const firstReplacement = this.employees().find((employee) => employee.idEmployee !== firstShift?.idEmployee);

    this.selectedCoverageId.set('');
    this.coverageForm.reset({
      idScheduledShift: firstShift?.idScheduledShift ?? '',
      idReplacementEmployee: firstReplacement?.idEmployee ?? '',
      coverageStartTime: firstShift?.startTime?.slice(0, 5) ?? '08:00',
      coverageEndTime: firstShift?.endTime?.slice(0, 5) ?? '16:00',
      isOvernight: firstShift?.isOvernight ?? false,
      status: 'Confirmed',
      notes: '',
    });
  }

  protected saveEvidence() {
    const context = this.operationContext();

    if (!context || this.evidenceForm.invalid) {
      this.evidenceForm.markAllAsTouched();
      return;
    }

    const form = this.evidenceForm.getRawValue();
    const relation = this.evidenceRelationPayload(form.relatedRecordId);

    if (!relation) {
      this.error.set('Selecciona un registro operativo válido para ligar la evidencia.');
      return;
    }

    const payload = {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      idAttendanceRecord: relation.idAttendanceRecord,
      idIncident: relation.idIncident,
      idCoverageRecord: relation.idCoverageRecord,
      evidenceType: form.evidenceType,
      title: form.title.trim(),
      storageReference: form.storageReference.trim(),
      notes: this.emptyToNull(form.notes),
    };
    const selectedEvidenceId = this.selectedEvidenceId();
    const request = selectedEvidenceId
      ? this.api.updateOperationEvidence(context.idClient, context.idService, selectedEvidenceId, payload)
      : this.api.createOperationEvidence(context.idClient, context.idService, payload);

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    request.subscribe({
      next: () => {
        this.message.set(selectedEvidenceId ? 'Evidencia actualizada correctamente.' : 'Evidencia registrada correctamente.');
        this.resetEvidenceForm();
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) =>
        this.setError(error, selectedEvidenceId ? 'No se pudo actualizar la evidencia.' : 'No se pudo registrar la evidencia.'),
      complete: () => this.saving.set(false),
    });
  }

  protected onEvidenceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.uploadingEvidenceFile.set(true);
    this.message.set('');
    this.error.set('');

    this.api.uploadOperationEvidenceFile(file).subscribe({
      next: (result) => {
        this.evidenceForm.patchValue({
          title: this.evidenceForm.controls.title.value || result.originalFileName,
          storageReference: result.storageReference,
        });
        this.message.set('Archivo cargado correctamente. Guarda la evidencia para ligarlo al registro.');
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar el archivo.'),
      complete: () => {
        this.uploadingEvidenceFile.set(false);
        input.value = '';
      },
    });
  }

  protected selectEvidence(evidence: OperationEvidence) {
    this.selectedEvidenceId.set(evidence.idOperationEvidence);
    this.evidenceForm.patchValue({
      relatedRecordId: evidence.idAttendanceRecord ?? evidence.idIncident ?? evidence.idCoverageRecord ?? '',
      evidenceType: evidence.evidenceType,
      title: evidence.title,
      storageReference: evidence.storageReference,
      notes: evidence.notes ?? '',
    });
  }

  protected resetEvidenceForm() {
    this.selectedEvidenceId.set('');
    this.evidenceForm.reset({
      relatedRecordId: this.evidenceRelatedOptions()[0]?.value ?? '',
      evidenceType: 'Photo',
      title: '',
      storageReference: '',
      notes: '',
    });
  }

  protected deactivateEvidence(evidence: OperationEvidence) {
    const context = this.operationContext();

    if (!context) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api
      .deactivateOperationEvidence(
        context.idOrganization,
        context.idClient,
        context.idService,
        evidence.idOperationEvidence,
      )
      .subscribe({
        next: () => {
          this.message.set('Evidencia desactivada correctamente.');
          this.resetEvidenceForm();
          this.loadOperationData();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar la evidencia.'),
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
      evidences: this.api.listOperationEvidences(organizationId, clientId, serviceId),
      summary: this.api.getOperationsSummary(organizationId, clientId, serviceId),
      versions: this.api.listScheduleVersions(organizationId, clientId, serviceId),
      employees: this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 100),
    }).subscribe({
      next: ({ attendance, incidents, coverages, evidences, summary, versions, employees }) => {
        this.attendance.set(attendance);
        this.incidents.set(incidents);
        this.coverages.set(coverages);
        this.evidences.set(evidences);
        this.summary.set(summary);
        this.scheduleVersions.set(versions);
        this.employees.set(employees.items);
        this.resetEvidenceForm();
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
    this.evidences.set([]);
    this.scheduleVersions.set([]);
    this.scheduledShifts.set([]);
    this.employees.set([]);
    this.summary.set(null);
    this.selectedIncidentId.set('');
    this.selectedAttendanceId.set('');
    this.selectedCoverageId.set('');
    this.selectedEvidenceId.set('');
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

    if (!this.evidenceForm.controls.relatedRecordId.value) {
      this.evidenceForm.patchValue({
        relatedRecordId: this.evidenceRelatedOptions()[0]?.value ?? '',
      });
    }
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

  private evidenceRelationPayload(relatedRecordId: string) {
    if (!relatedRecordId) {
      return null;
    }

    switch (this.activeSection()) {
      case 'incidencias':
        return { idAttendanceRecord: null, idIncident: relatedRecordId, idCoverageRecord: null };
      case 'cobertura':
        return { idAttendanceRecord: null, idIncident: null, idCoverageRecord: relatedRecordId };
      default:
        return { idAttendanceRecord: relatedRecordId, idIncident: null, idCoverageRecord: null };
    }
  }

  private evidenceSection(evidence: OperationEvidence): OperationSection {
    if (evidence.idIncident) {
      return 'incidencias';
    }

    if (evidence.idCoverageRecord) {
      return 'cobertura';
    }

    return 'asistencia';
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }
}

type OperationSection = 'asistencia' | 'incidencias' | 'cobertura';

type OperationDayShift = {
  readonly shift: ScheduledShift;
  readonly attendance: AttendanceRecord | null;
  readonly coverage: CoverageRecord | null;
  readonly incidents: readonly Incident[];
};

function isOperationSection(value: string | null): value is OperationSection {
  return value === 'asistencia' || value === 'incidencias' || value === 'cobertura';
}
