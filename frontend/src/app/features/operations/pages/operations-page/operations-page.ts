import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  AttendanceRecord,
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalRequestType,
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
  OperationDayClosure,
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
  protected readonly approvalRequests = signal<readonly ApprovalRequest[]>([]);
  protected readonly dayClosures = signal<readonly OperationDayClosure[]>([]);
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
  protected readonly selectedApprovalRequestId = signal('');
  protected readonly selectedAttendanceId = signal('');
  protected readonly selectedOperationDate = signal(this.today());
  protected readonly activeSection = signal<OperationSection>('asistencia');
  protected readonly activeTab = signal<OperationTab>('asistencia');
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
  protected readonly expectedShiftCount = computed(() => this.dailyBoard().length);
  protected readonly presentTodayCount = computed(
    () => this.dailyBoard().filter((item) => item.attendance?.status === 'Present').length,
  );
  protected readonly absentTodayCount = computed(
    () => this.dailyBoard().filter((item) => item.attendance?.status === 'Absent').length,
  );
  protected readonly lateTodayCount = computed(
    () => this.dailyBoard().filter((item) => item.attendance?.status === 'Late').length,
  );
  protected readonly pendingCoverageCount = computed(
    () =>
      this.dailyBoard().filter(
        (item) =>
          item.attendance?.status === 'Absent' &&
          (!item.coverage || item.coverage.status === 'Requested'),
      ).length,
  );
  protected readonly pendingApprovalCount = computed(
    () => this.approvalRequests().filter((approval) => approval.status === 'Pending').length,
  );
  protected readonly selectedApprovalRequest = computed(
    () => this.approvalRequests().find((approval) => approval.idApprovalRequest === this.selectedApprovalRequestId()) ?? null,
  );
  protected readonly currentDayClosure = computed(
    () =>
      this.dayClosures().find(
        (closure) => closure.operationDate === this.selectedOperationDate() && closure.status === 'Closed',
      ) ?? null,
  );
  protected readonly canCloseDay = computed(
    () =>
      this.dailyBoard().length > 0 &&
      this.pendingAttendanceCount() === 0 &&
      this.openDailyIncidents() === 0 &&
      !this.currentDayClosure(),
  );
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
  protected readonly tabTitle = computed(() => {
    switch (this.activeTab()) {
      case 'incidencias':
        return 'Incidencias';
      case 'cobertura':
        return 'Cobertura';
      case 'evidencias':
        return 'Evidencias';
      case 'cierre':
        return 'Cierre diario';
      default:
        return 'Asistencia';
    }
  });
  protected readonly tabDescription = computed(() => {
    switch (this.activeTab()) {
      case 'incidencias':
        return 'Prioriza excepciones abiertas y cierra incidencias con evidencia y seguimiento.';
      case 'cobertura':
        return 'Controla sustituciones, reemplazos y horas cubiertas sin mezclarlo con la asistencia planeada.';
      case 'evidencias':
        return 'Consulta y adjunta respaldos operativos ligados a asistencia, incidencias o coberturas.';
      case 'cierre':
        return 'Revisa pendientes, autorizaciones y confirma el cierre del día sólo cuando la operación esté lista.';
      default:
        return 'Confirma lo ocurrido por turno: presente, retardo, falta o justificación.';
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
  protected readonly approvedAttendanceApprovals = computed(() => {
    const attendance = this.selectedAttendance();
    if (!attendance) {
      return [];
    }

    return this.approvalRequests().filter(
      (approval) =>
        approval.status === 'Approved' &&
        approval.approvalType === 'AttendanceCorrection' &&
        approval.entityType === 'AttendanceRecord' &&
        approval.entityId === attendance.idAttendanceRecord,
    );
  });
  protected readonly approvalEvidenceOptions = computed(() => {
    const target = this.currentApprovalTarget();

    if (!target) {
      return [];
    }

    return this.evidences()
      .filter((evidence) => this.evidenceMatchesTarget(evidence, target))
      .map((evidence) => ({
        value: evidence.idOperationEvidence,
        label: `${this.evidenceTypeLabel(evidence.evidenceType)} · ${evidence.title}`,
      }));
  });
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
  protected readonly evidenceList = computed(() =>
    this.activeTab() === 'evidencias' ? this.evidences() : this.visibleEvidences(),
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

  protected readonly approvalStatuses: readonly { value: ApprovalRequestStatus; label: string }[] = [
    { value: 'Pending', label: 'Pendiente' },
    { value: 'Approved', label: 'Aprobada' },
    { value: 'Rejected', label: 'Rechazada' },
    { value: 'Cancelled', label: 'Cancelada' },
  ];

  protected readonly attendanceForm = this.formBuilder.nonNullable.group({
    idScheduledShift: ['', [Validators.required]],
    status: ['Present' as AttendanceStatus, [Validators.required]],
    actualStartTime: [''],
    actualEndTime: [''],
    minutesLate: [0, [Validators.min(0)]],
    notes: [''],
    correctionAuthorizationNotes: [''],
    idApprovalRequest: [''],
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

  protected readonly approvalForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(1200)]],
    requestedChangeSummary: ['', [Validators.maxLength(2000)]],
    assignedApproverName: ['Supervisor operativo', [Validators.maxLength(100)]],
    idOperationEvidence: [''],
    decisionNotes: ['', [Validators.maxLength(1200)]],
  });

  protected readonly dayClosureForm = this.formBuilder.nonNullable.group({
    notes: ['', [Validators.maxLength(1200)]],
    reopenReason: ['', [Validators.maxLength(1200)]],
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const section = params.get('section');

      if (isOperationSection(section)) {
        const previousSection = this.activeSection();
        this.activeSection.set(section);
        this.activeTab.set(section);
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

  protected setActiveTab(tab: OperationTab) {
    this.activeTab.set(tab);

    if (isOperationSection(tab)) {
      void this.router.navigateByUrl(`/operacion/${tab}`);
    }
  }

  protected quickAttendance(item: OperationDayShift, status: AttendanceStatus) {
    const context = this.operationContext();

    if (!context || this.saving()) {
      return;
    }

    if (item.attendance) {
      this.selectAttendance(item.attendance);
      this.activeTab.set('asistencia');
      this.error.set('Ese turno ya tiene asistencia. Para corregirlo usa el formulario y una autorización aprobada.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api.upsertAttendanceRecord(context.idClient, context.idService, {
      idOrganization: context.idOrganization,
      idClient: context.idClient,
      idService: context.idService,
      idScheduledShift: item.shift.idScheduledShift,
      status,
      actualStartTime: status === 'Absent' ? null : item.shift.startTime,
      actualEndTime: status === 'Absent' ? null : item.shift.endTime,
      minutesLate: status === 'Late' ? 10 : 0,
      notes: `Captura rápida desde centro de control: ${this.attendanceStatusLabel(status)}.`,
    }).subscribe({
      next: () => {
        this.message.set(`Asistencia marcada como ${this.attendanceStatusLabel(status).toLowerCase()}.`);
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo registrar la asistencia rápida.'),
      complete: () => this.saving.set(false),
    });
  }

  protected closeOperationDay() {
    const context = this.operationContext();
    if (!context || this.dayClosureForm.controls.notes.invalid) {
      this.dayClosureForm.markAllAsTouched();
      return;
    }

    if (!this.canCloseDay()) {
      this.error.set('Para cerrar el día necesitas turnos publicados, asistencia completa y cero incidencias abiertas.');
      return;
    }

    if (!window.confirm(`¿Cerrar la operación del ${this.selectedOperationDate()} para este servicio?`)) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api.closeOperationDay(context.idClient, context.idService, {
      idOrganization: context.idOrganization,
      operationDate: this.selectedOperationDate(),
      notes: this.emptyToNull(this.dayClosureForm.controls.notes.value),
    }).subscribe({
      next: () => {
        this.message.set('Día operativo cerrado correctamente.');
        this.dayClosureForm.patchValue({ notes: '' });
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cerrar el día operativo.'),
      complete: () => this.saving.set(false),
    });
  }

  protected reopenOperationDay() {
    const context = this.operationContext();
    const closure = this.currentDayClosure();
    const reason = this.dayClosureForm.controls.reopenReason.value.trim();

    if (!context || !closure) {
      return;
    }

    if (!reason) {
      this.error.set('Captura el motivo para reabrir el día operativo.');
      return;
    }

    if (!window.confirm(`¿Reabrir el cierre operativo del ${closure.operationDate}?`)) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api.reopenOperationDay(context.idClient, context.idService, closure.idOperationDayClosure, {
      idOrganization: context.idOrganization,
      reason,
    }).subscribe({
      next: () => {
        this.message.set('Día operativo reabierto correctamente.');
        this.dayClosureForm.patchValue({ reopenReason: '' });
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo reabrir el día operativo.'),
      complete: () => this.saving.set(false),
    });
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

    if (!this.attendanceCorrectionReady()) {
      this.error.set('Selecciona una autorización aprobada antes de guardar la corrección de asistencia.');
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
        idApprovalRequest: this.selectedAttendance()
          ? this.emptyToNull(form.idApprovalRequest)
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
      idApprovalRequest: '',
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
      idApprovalRequest: '',
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

    if (!context || !window.confirm(`¿Desactivar la evidencia "${evidence.title}"?`)) {
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

  protected downloadEvidence(evidence: OperationEvidence) {
    if (!evidence.storageReference) {
      this.error.set('La evidencia no tiene una referencia de archivo para descargar.');
      return;
    }

    this.api.downloadOperationEvidenceFile(evidence.storageReference).subscribe({
      next: (response) => this.openDownloadedEvidence(response, evidence),
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo descargar la evidencia.'),
    });
  }

  protected requestApprovalForSelection() {
    const context = this.operationContext();
    const target = this.currentApprovalTarget();

    if (!context || !target || this.approvalForm.controls.reason.invalid || this.approvalForm.controls.requestedChangeSummary.invalid) {
      this.approvalForm.markAllAsTouched();
      if (!target) {
        this.error.set('Selecciona una asistencia, incidencia o cobertura para solicitar autorización.');
      }
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api.createApprovalRequest({
      idOrganization: context.idOrganization,
      idService: context.idService,
      approvalType: target.approvalType,
      entityType: target.entityType,
      entityId: target.entityId,
      reason: this.approvalForm.controls.reason.value.trim(),
      requestedChangeSummary: this.emptyToNull(this.approvalForm.controls.requestedChangeSummary.value),
      assignedApproverName: this.emptyToNull(this.approvalForm.controls.assignedApproverName.value),
      idOperationEvidence: this.emptyToNull(this.approvalForm.controls.idOperationEvidence.value),
    }).subscribe({
      next: () => {
        this.message.set('Autorización solicitada correctamente.');
        this.approvalForm.patchValue({ reason: '', requestedChangeSummary: '', idOperationEvidence: '' });
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo solicitar la autorización.'),
      complete: () => this.saving.set(false),
    });
  }

  protected decideApproval(approval: ApprovalRequest, status: 'Approved' | 'Rejected') {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      return;
    }

    if (!window.confirm(`¿${status === 'Approved' ? 'Aprobar' : 'Rechazar'} esta autorización?`)) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api.decideApprovalRequest(approval.idApprovalRequest, {
      idOrganization: organizationId,
      status,
      decisionNotes: this.emptyToNull(this.approvalForm.controls.decisionNotes.value),
    }).subscribe({
      next: () => {
        this.message.set(status === 'Approved' ? 'Autorización aprobada.' : 'Autorización rechazada.');
        this.approvalForm.patchValue({ decisionNotes: '' });
        this.loadOperationData();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo resolver la autorización.'),
      complete: () => this.saving.set(false),
    });
  }

  protected approvalStatusLabel(status: ApprovalRequestStatus) {
    switch (status) {
      case 'Approved':
        return 'Aprobada';
      case 'Rejected':
        return 'Rechazada';
      case 'Cancelled':
        return 'Cancelada';
      default:
        return 'Pendiente';
    }
  }

  protected approvalTypeLabel(type: ApprovalRequestType) {
    switch (type) {
      case 'IncidentClosure':
        return 'Cierre de incidencia';
      case 'CoverageCorrection':
        return 'Corrección de cobertura';
      case 'ServiceConfigurationChange':
        return 'Cambio de configuración';
      case 'DocumentException':
        return 'Excepción documental';
      case 'Other':
        return 'Autorización operativa';
      default:
        return 'Corrección de asistencia';
    }
  }

  protected attendanceStatusLabel(status?: AttendanceStatus | null) {
    return this.attendanceStatuses.find((item) => item.value === status)?.label ?? 'Sin asistencia';
  }

  protected incidentSeverityLabel(severity: IncidentSeverity) {
    return this.incidentSeverities.find((item) => item.value === severity)?.label ?? 'Sin clasificar';
  }

  protected incidentStatusLabel(status: IncidentStatus) {
    return this.incidentStatuses.find((item) => item.value === status)?.label ?? 'Sin estado';
  }

  protected coverageStatusLabel(status: CoverageStatus) {
    return this.coverageStatuses.find((item) => item.value === status)?.label ?? 'Sin estado';
  }

  protected evidenceTypeLabel(type: OperationEvidenceType) {
    return this.evidenceTypes.find((item) => item.value === type)?.label ?? 'Evidencia';
  }

  protected attendanceCorrectionReady() {
    return !this.selectedAttendance() || Boolean(this.attendanceForm.controls.idApprovalRequest.value);
  }

  protected assignedApproverLabel(approval: ApprovalRequest) {
    return approval.assignedApproverName || approval.decidedByName || 'Supervisor operativo';
  }

  protected approvalEvidenceLabel(approval: ApprovalRequest) {
    if (!approval.idOperationEvidence) {
      return 'Sin evidencia ligada';
    }

    const evidence = this.evidences().find((item) => item.idOperationEvidence === approval.idOperationEvidence);
    return evidence ? `${this.evidenceTypeLabel(evidence.evidenceType)} · ${evidence.title}` : 'Evidencia ligada';
  }

  protected compactReference(value: string) {
    if (!value) {
      return 'Sin referencia';
    }

    return value.length > 54 ? `${value.slice(0, 26)}…${value.slice(-18)}` : value;
  }

  protected shiftStatusClass(item: OperationDayShift) {
    if (item.attendance?.status === 'Present') {
      return 'is-present';
    }

    if (item.attendance?.status === 'Late') {
      return 'is-late';
    }

    if (item.attendance?.status === 'Absent') {
      return 'is-absent';
    }

    if (item.coverage) {
      return 'is-covered';
    }

    return 'is-pending';
  }

  protected actualEmployeeLabel(item: OperationDayShift) {
    if (item.coverage) {
      return `${item.coverage.replacementEmployeeCode} · ${item.coverage.replacementEmployeeName}`;
    }

    if (item.attendance && item.attendance.status !== 'Absent') {
      return `${item.attendance.employeeCode} · ${item.attendance.employeeName}`;
    }

    return 'Pendiente de confirmar';
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
      approvals: this.api.listApprovalRequests(organizationId, serviceId),
      closures: this.api.listOperationDayClosures(organizationId, serviceId),
      summary: this.api.getOperationsSummary(organizationId, clientId, serviceId),
      versions: this.api.listScheduleVersions(organizationId, clientId, serviceId),
      employees: this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 100),
    }).subscribe({
      next: ({ attendance, incidents, coverages, evidences, approvals, closures, summary, versions, employees }) => {
        this.attendance.set(attendance);
        this.incidents.set(incidents);
        this.coverages.set(coverages);
        this.evidences.set(evidences);
        this.approvalRequests.set(approvals);
        this.dayClosures.set(closures);
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
    this.approvalRequests.set([]);
    this.dayClosures.set([]);
    this.scheduleVersions.set([]);
    this.scheduledShifts.set([]);
    this.employees.set([]);
    this.summary.set(null);
    this.selectedIncidentId.set('');
    this.selectedAttendanceId.set('');
    this.selectedCoverageId.set('');
    this.selectedEvidenceId.set('');
    this.selectedApprovalRequestId.set('');
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

  private openDownloadedEvidence(response: HttpResponse<Blob>, evidence: OperationEvidence) {
    const blob = response.body;
    if (!blob) {
      this.error.set('La descarga no regresó contenido.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = evidence.storageReference.split('/').at(-1) || evidence.title;
    link.click();
    URL.revokeObjectURL(url);
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

  private currentApprovalTarget(): ApprovalTarget | null {
    switch (this.activeSection()) {
      case 'incidencias': {
        const incident = this.selectedIncident();
        return incident
          ? {
              approvalType: 'IncidentClosure',
              entityType: 'Incident',
              entityId: incident.idIncident,
            }
          : null;
      }
      case 'cobertura': {
        const coverage = this.selectedCoverage();
        return coverage
          ? {
              approvalType: 'CoverageCorrection',
              entityType: 'CoverageRecord',
              entityId: coverage.idCoverageRecord,
            }
          : null;
      }
      default: {
        const attendance = this.selectedAttendance();
        return attendance
          ? {
              approvalType: 'AttendanceCorrection',
              entityType: 'AttendanceRecord',
              entityId: attendance.idAttendanceRecord,
            }
          : null;
      }
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

  private evidenceMatchesTarget(evidence: OperationEvidence, target: ApprovalTarget) {
    return (
      (target.entityType === 'AttendanceRecord' && evidence.idAttendanceRecord === target.entityId) ||
      (target.entityType === 'Incident' && evidence.idIncident === target.entityId) ||
      (target.entityType === 'CoverageRecord' && evidence.idCoverageRecord === target.entityId)
    );
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }
}

type OperationSection = 'asistencia' | 'incidencias' | 'cobertura';

type OperationTab = OperationSection | 'evidencias' | 'cierre';

type OperationDayShift = {
  readonly shift: ScheduledShift;
  readonly attendance: AttendanceRecord | null;
  readonly coverage: CoverageRecord | null;
  readonly incidents: readonly Incident[];
};

type ApprovalTarget = {
  readonly approvalType: ApprovalRequestType;
  readonly entityType: string;
  readonly entityId: string;
};

function isOperationSection(value: string | null): value is OperationSection {
  return value === 'asistencia' || value === 'incidencias' || value === 'cobertura';
}
