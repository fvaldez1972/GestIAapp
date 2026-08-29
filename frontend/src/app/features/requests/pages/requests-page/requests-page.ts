import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, Organization, ScheduledShift, ServicePosition } from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { RequestApiService } from '../../data-access/request-api.service';
import {
  ExecuteOperationalRequest,
  OperationalRequestExecutionPreview,
  OperationalRequest,
  OperationalRequestPriority,
  OperationalRequestStatus,
  OperationalRequestType,
} from '../../data-access/request.models';

@Component({
  selector: 'app-requests-page',
  imports: [ReactiveFormsModule],
  templateUrl: './requests-page.html',
  styleUrl: './requests-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestsPage implements OnInit {
  private readonly api = inject(RequestApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly scheduledShifts = signal<readonly ScheduledShift[]>([]);
  protected readonly requests = signal<readonly OperationalRequest[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClientId = signal('');
  protected readonly filterStatus = signal<OperationalRequestStatus | ''>('');
  protected readonly filterType = signal<OperationalRequestType | ''>('');
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly selectedRequestId = signal('');
  protected readonly activeExecutionType = signal<OperationalRequestType>('NewService');
  protected readonly executionPreview = signal<OperationalRequestExecutionPreview | null>(null);

  protected readonly openRequests = computed(() =>
    this.requests().filter((request) => ['Submitted', 'InReview', 'Approved'].includes(request.status)).length,
  );
  protected readonly criticalRequests = computed(
    () => this.requests().filter((request) => request.priority === 'Critical').length,
  );
  protected readonly selectedRequest = computed(
    () => this.requests().find((request) => request.idOperationalRequest === this.selectedRequestId()) ?? null,
  );
  protected readonly workflowColumns = computed<RequestWorkflowColumn[]>(() =>
    [
      { status: 'Draft' as const, label: 'Borrador', hint: 'Pendientes de enviar' },
      { status: 'Submitted' as const, label: 'Enviadas', hint: 'Listas para revisar' },
      { status: 'InReview' as const, label: 'En revisión', hint: 'Requieren decisión' },
      { status: 'Approved' as const, label: 'Aprobadas', hint: 'Listas para ejecutar' },
      { status: 'Completed' as const, label: 'Completadas', hint: 'Cerradas correctamente' },
    ].map((column) => ({
      ...column,
      requests: this.requests().filter((request) => request.status === column.status),
    })),
  );
  protected readonly overdueRequests = computed(() => {
    const today = this.today();
    return this.requests().filter((request) =>
      Boolean(
        request.neededByDate &&
        request.neededByDate < today &&
        ['Submitted', 'InReview', 'Approved'].includes(request.status),
      ),
    ).length;
  });

  protected readonly requestTypes: readonly { value: OperationalRequestType; label: string }[] = [
    { value: 'NewClient', label: 'Alta de cliente' },
    { value: 'NewService', label: 'Nuevo servicio' },
    { value: 'ServiceChange', label: 'Cambio de servicio' },
    { value: 'CoverageSupport', label: 'Apoyo de cobertura' },
    { value: 'StaffChange', label: 'Cambio de personal' },
    { value: 'Other', label: 'Otro' },
  ];

  protected readonly statuses: readonly { value: OperationalRequestStatus; label: string }[] = [
    { value: 'Draft', label: 'Borrador' },
    { value: 'Submitted', label: 'Enviada' },
    { value: 'InReview', label: 'En revisión' },
    { value: 'Approved', label: 'Aprobada' },
    { value: 'Rejected', label: 'Rechazada' },
    { value: 'Cancelled', label: 'Cancelada' },
    { value: 'Completed', label: 'Completada' },
  ];

  protected readonly priorities: readonly { value: OperationalRequestPriority; label: string }[] = [
    { value: 'Low', label: 'Baja' },
    { value: 'Medium', label: 'Media' },
    { value: 'High', label: 'Alta' },
    { value: 'Critical', label: 'Crítica' },
  ];

  protected readonly requestForm = this.formBuilder.nonNullable.group({
    codeOperationalRequest: [this.nextRequestCode(), [Validators.required, Validators.maxLength(40)]],
    idClient: [''],
    idService: [''],
    requestType: ['NewService' as OperationalRequestType, [Validators.required]],
    priority: ['Medium' as OperationalRequestPriority, [Validators.required]],
    title: ['Nueva solicitud operativa', [Validators.required, Validators.maxLength(180)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    requestedByName: ['Operación', [Validators.required, Validators.maxLength(160)]],
    neededByDate: [''],
  });

  protected readonly statusForm = this.formBuilder.nonNullable.group({
    idOperationalRequest: [''],
    status: ['InReview' as OperationalRequestStatus, [Validators.required]],
    resolutionNotes: [''],
  });

  protected readonly executionForm = this.formBuilder.nonNullable.group({
    executionNotes: [''],
    clientCode: [''],
    clientLegalName: [''],
    clientTradeName: [''],
    clientRfc: [''],
    siteCode: ['SEDE-01'],
    siteName: [''],
    siteStreet: [''],
    siteMunicipality: [''],
    siteState: [''],
    sitePostalCode: [''],
    serviceCode: [''],
    serviceName: [''],
    serviceDescription: [''],
    serviceStartDate: [this.today()],
    configEffectiveFromDate: [this.today()],
    configRequiredWorkerCount: [1],
    configHoursPerDay: [8],
    configDaysPerWeek: [6],
    configAverageMonthlyHours: [208],
    configPreparationLeadDays: [3],
    configWorkScheduleDescription: [''],
    configMonthlyPrice: [0],
    idEmployee: [''],
    idPosition: [''],
    assignmentType: ['Primary'],
    assignmentStartDate: [this.today()],
    assignmentIsPrimary: [true],
    assignmentNotes: [''],
    idScheduledShift: [''],
    idReplacementEmployee: [''],
    coverageStartTime: ['08:00:00'],
    coverageEndTime: ['16:00:00'],
    coverageIsOvernight: [false],
    coverageStatus: ['Confirmed'],
    coverageNotes: [''],
  });

  ngOnInit() {
    this.loadOrganizations();
  }

  protected onOrganizationChange(event: Event) {
    this.selectedOrganizationId.set((event.target as HTMLSelectElement).value);
    this.selectedClientId.set('');
    this.clients.set([]);
    this.services.set([]);
    this.positions.set([]);
    this.scheduledShifts.set([]);
    this.employees.set([]);
    this.executionPreview.set(null);
    this.requestForm.patchValue({ idClient: '', idService: '' });
    this.loadClients();
    this.loadEmployees();
    this.loadRequests();
  }

  protected onClientChange(event: Event) {
    const clientId = (event.target as HTMLSelectElement).value;
    this.selectedClientId.set(clientId);
    this.requestForm.patchValue({ idClient: clientId, idService: '' });
    this.loadServices(clientId);
  }

  protected onRequestClientChange(event: Event) {
    const clientId = (event.target as HTMLSelectElement).value;
    this.requestForm.patchValue({ idClient: clientId, idService: '' });
    this.positions.set([]);
    this.scheduledShifts.set([]);
    this.executionPreview.set(null);
    this.loadServices(clientId);
  }

  protected onRequestServiceChange(event: Event) {
    const serviceId = (event.target as HTMLSelectElement).value;
    const clientId = this.requestForm.controls.idClient.value;
    this.requestForm.patchValue({ idService: serviceId });
    this.executionPreview.set(null);
    this.loadExecutionContext(clientId, serviceId);
  }

  protected onRequestTypeChange(event: Event) {
    this.activeExecutionType.set((event.target as HTMLSelectElement).value as OperationalRequestType);
    this.executionPreview.set(null);
  }

  protected onFilterStatusChange(event: Event) {
    this.filterStatus.set((event.target as HTMLSelectElement).value as OperationalRequestStatus | '');
    this.loadRequests();
  }

  protected onFilterTypeChange(event: Event) {
    this.filterType.set((event.target as HTMLSelectElement).value as OperationalRequestType | '');
    this.loadRequests();
  }

  protected onSearchChange(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected applySearch() {
    this.loadRequests();
  }

  protected filterByStatus(status: OperationalRequestStatus | '') {
    this.filterStatus.set(status);
    this.loadRequests();
  }

  protected saveRequest() {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    const form = this.requestForm.getRawValue();
    const payload = {
      idOrganization: organizationId,
      idClient: this.emptyToNull(form.idClient),
      idService: this.emptyToNull(form.idService),
      requestType: form.requestType,
      priority: form.priority,
      title: form.title.trim(),
      description: form.description.trim(),
      requestedByName: form.requestedByName.trim(),
      neededByDate: this.emptyToNull(form.neededByDate),
    };
    this.beginSave();

    const selectedRequestId = this.selectedRequestId();
    const operation = selectedRequestId
      ? this.api.updateRequest(selectedRequestId, payload)
      : this.api.createRequest({
        ...payload,
        codeOperationalRequest: form.codeOperationalRequest.trim(),
      });

    operation.subscribe({
        next: (request) => {
          this.message.set(selectedRequestId ? 'Solicitud actualizada correctamente.' : 'Solicitud registrada correctamente.');
          this.selectedRequestId.set(request.idOperationalRequest);
          this.statusForm.patchValue({ idOperationalRequest: request.idOperationalRequest });
          this.loadRequests();
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedRequestId ? 'No se pudo actualizar la solicitud.' : 'No se pudo crear la solicitud.'),
        complete: () => this.saving.set(false),
      });
  }

  protected selectRequest(request: OperationalRequest) {
    this.selectedRequestId.set(request.idOperationalRequest);
    this.activeExecutionType.set(request.requestType);
    this.executionPreview.set(null);
    this.requestForm.patchValue({
      codeOperationalRequest: request.codeOperationalRequest,
      idClient: request.idClient ?? '',
      idService: request.idService ?? '',
      requestType: request.requestType,
      priority: request.priority,
      title: request.title,
      description: request.description,
      requestedByName: request.requestedByName,
      neededByDate: request.neededByDate ?? '',
    });
    this.statusForm.patchValue({
      idOperationalRequest: request.idOperationalRequest,
      status: request.status,
      resolutionNotes: request.resolutionNotes ?? '',
    });
    this.resetExecutionForm();
    this.executionForm.patchValue({
      executionNotes: request.resolutionNotes ?? '',
    });
    if (request.requestType === 'NewService') {
      this.executionForm.patchValue({
        serviceCode: `${request.codeOperationalRequest}-SRV`,
        serviceName: request.title,
        serviceDescription: request.description,
        configWorkScheduleDescription: request.description,
      });
    }

    if (request.requestType === 'ServiceChange') {
      this.executionForm.patchValue({
        configWorkScheduleDescription: request.description,
      });
    }

    if (request.requestType === 'StaffChange') {
      this.executionForm.patchValue({
        assignmentNotes: request.description,
      });
    }

    if (request.requestType === 'CoverageSupport') {
      this.executionForm.patchValue({
        coverageNotes: request.description,
      });
    }

    if (request.idClient) {
      this.selectedClientId.set(request.idClient);
      this.loadServices(request.idClient);
    }

    this.loadExecutionContext(request.idClient ?? '', request.idService ?? '');
  }

  protected resetRequestForm() {
    this.selectedRequestId.set('');
    this.activeExecutionType.set('NewService');
    this.executionPreview.set(null);
    this.requestForm.reset({
      codeOperationalRequest: this.nextRequestCode(),
      idClient: this.selectedClientId(),
      idService: '',
      requestType: 'NewService',
      priority: 'Medium',
      title: 'Nueva solicitud operativa',
      description: '',
      requestedByName: 'Operación',
      neededByDate: '',
    });
    this.resetExecutionForm();
  }

  protected changeStatus() {
    const organizationId = this.selectedOrganizationId();
    const form = this.statusForm.getRawValue();

    if (!organizationId || !form.idOperationalRequest || this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
      return;
    }

    if (form.status === 'Completed' && this.selectedRequest()?.status !== 'Completed') {
      this.error.set('Para completar una solicitud aprobada usa la ejecución; así se crean o modifican los datos reales.');
      return;
    }

    this.beginSave();

    this.api
      .changeStatus(form.idOperationalRequest, {
        idOrganization: organizationId,
        status: form.status,
        resolutionNotes: this.emptyToNull(form.resolutionNotes),
      })
      .subscribe({
        next: () => {
          this.message.set('Estado de solicitud actualizado.');
          if (form.status === 'Cancelled') {
            this.resetRequestForm();
          }
          this.loadRequests();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo actualizar el estado.'),
        complete: () => this.saving.set(false),
      });
  }

  protected advanceRequest(request: OperationalRequest) {
    const status = this.nextStatus(request);

    if (!status) {
      return;
    }

    this.updateRequestStatus(
      request,
      status,
      `Avance rápido desde tablero: ${this.labelForStatus(status)}.`,
    );
  }

  protected rejectRequest(request: OperationalRequest) {
    if (!window.confirm(`¿Rechazar la solicitud ${request.codeOperationalRequest}?`)) {
      return;
    }

    this.updateRequestStatus(request, 'Rejected', 'Rechazada desde tablero operativo.');
  }

  protected prepareExecution(request: OperationalRequest) {
    this.selectRequest(request);
    this.message.set('Solicitud seleccionada. Valida el impacto y completa los datos antes de ejecutar.');
  }

  protected previewExecution(request: OperationalRequest | null = this.selectedRequest()) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || !request || request.status !== 'Approved') {
      return;
    }

    const executionPayload = this.buildExecutionPayload(request);
    if (!executionPayload) {
      return;
    }

    this.beginSave();

    this.api
      .previewExecution(request.idOperationalRequest, {
        idOrganization: organizationId,
        executionNotes: this.emptyToNull(this.executionForm.controls.executionNotes.value),
        ...executionPayload,
      })
      .subscribe({
        next: (preview) => {
          this.executionPreview.set(preview);
          this.message.set(
            preview.canExecute
              ? 'La solicitud tiene los datos necesarios para ejecutarse.'
              : 'La solicitud todavía tiene datos pendientes.',
          );
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo validar la ejecución.'),
        complete: () => this.saving.set(false),
      });
  }

  protected executeRequest(request: OperationalRequest | null = this.selectedRequest()) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || !request || request.status !== 'Approved') {
      return;
    }

    const executionPayload = this.buildExecutionPayload(request);
    if (!executionPayload) {
      return;
    }

    const preview = this.executionPreview();
    if (!preview?.canExecute) {
      this.error.set('Primero valida el impacto y completa los datos pendientes antes de ejecutar.');
      return;
    }

    if (!window.confirm(`¿Ejecutar y completar la solicitud ${request.codeOperationalRequest}? Esta acción creará o modificará datos reales.`)) {
      return;
    }

    this.beginSave();

    this.api
      .executeRequest(request.idOperationalRequest, {
        idOrganization: organizationId,
        executionNotes: this.emptyToNull(this.executionForm.controls.executionNotes.value),
        ...executionPayload,
      })
      .subscribe({
        next: (result) => {
          const entityLabel = result.executedEntityKind && result.executedEntityId
            ? ` (${result.executedEntityKind}: ${result.executedEntityId})`
            : '';
          this.message.set(`${result.outcome}${entityLabel}`);
          this.selectedRequestId.set(result.request.idOperationalRequest);
          this.statusForm.patchValue({
            idOperationalRequest: result.request.idOperationalRequest,
            status: result.request.status,
            resolutionNotes: result.request.resolutionNotes ?? '',
          });
          this.loadRequests();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo ejecutar la solicitud.'),
        complete: () => this.saving.set(false),
      });
  }

  protected nextStatus(request: OperationalRequest): OperationalRequestStatus | null {
    switch (request.status) {
      case 'Draft':
        return 'Submitted';
      case 'Submitted':
        return 'InReview';
      case 'InReview':
        return 'Approved';
      default:
        return null;
    }
  }

  protected labelForType(value: OperationalRequestType) {
    return this.requestTypes.find((item) => item.value === value)?.label ?? 'Solicitud operativa';
  }

  protected labelForStatus(value: OperationalRequestStatus) {
    return this.statuses.find((item) => item.value === value)?.label ?? 'Sin estado';
  }

  protected labelForPriority(value: OperationalRequestPriority) {
    return this.priorities.find((item) => item.value === value)?.label ?? 'Prioridad normal';
  }

  private loadOrganizations() {
    this.loading.set(true);
    this.error.set('');

    this.clientApi.listOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.selectedOrganizationId.set(organizations[0]?.idOrganization ?? '');
        this.loadClients();
        this.loadEmployees();
        this.loadRequests();
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

    this.clientApi.listClients(organizationId, '', 1, 100).subscribe({
      next: (result) => this.clients.set(result.items),
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los clientes.'),
    });
  }

  private loadServices(clientId: string) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || !clientId) {
      this.services.set([]);
      return;
    }

    this.clientApi.listServices(organizationId, clientId).subscribe({
      next: (services) => this.services.set(services),
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los servicios.'),
    });
  }

  private loadEmployees() {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId) {
      this.employees.set([]);
      return;
    }

    this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 100).subscribe({
      next: (result) => {
        this.employees.set(result.items);
        this.executionForm.patchValue({
          idEmployee: this.executionForm.controls.idEmployee.value || result.items[0]?.idEmployee || '',
          idReplacementEmployee: this.executionForm.controls.idReplacementEmployee.value || result.items[0]?.idEmployee || '',
        });
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar el personal activo.'),
    });
  }

  private loadExecutionContext(clientId: string, serviceId: string) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || !clientId || !serviceId) {
      this.positions.set([]);
      this.scheduledShifts.set([]);
      return;
    }

    this.clientApi.listPositions(organizationId, clientId, serviceId).subscribe({
      next: (positions) => {
        this.positions.set(positions);
        this.executionForm.patchValue({
          idPosition: this.executionForm.controls.idPosition.value || positions[0]?.idPosition || '',
        });
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar las posiciones del servicio.'),
    });

    this.clientApi.listScheduleVersions(organizationId, clientId, serviceId).subscribe({
      next: (versions) => {
        const version = versions.find((item) => item.status === 'Published') ?? versions[0];
        if (!version) {
          this.scheduledShifts.set([]);
          return;
        }

        this.clientApi.listScheduledShifts(organizationId, clientId, serviceId, version.idScheduleVersion).subscribe({
          next: (shifts) => {
            this.scheduledShifts.set(shifts);
            this.executionForm.patchValue({
              idScheduledShift: this.executionForm.controls.idScheduledShift.value || shifts[0]?.idScheduledShift || '',
            });
          },
          error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los turnos publicados.'),
        });
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar las planeaciones del servicio.'),
    });
  }

  private loadRequests() {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api
      .listRequests(organizationId, this.filterStatus(), this.filterType(), this.search(), 1, 50)
      .subscribe({
        next: (result) => {
          this.requests.set(result.items);
          const first = result.items[0];
          if (first && !this.selectedRequestId()) {
            this.selectRequest(first);
          } else if (this.selectedRequestId() && !result.items.some((request) => request.idOperationalRequest === this.selectedRequestId())) {
            this.resetRequestForm();
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar las solicitudes.'),
        complete: () => this.loading.set(false),
      });
  }

  private beginSave() {
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
  }

  private resetExecutionForm() {
    this.executionForm.reset({
      executionNotes: '',
      clientCode: '',
      clientLegalName: '',
      clientTradeName: '',
      clientRfc: '',
      siteCode: 'SEDE-01',
      siteName: '',
      siteStreet: '',
      siteMunicipality: '',
      siteState: '',
      sitePostalCode: '',
      serviceCode: '',
      serviceName: '',
      serviceDescription: '',
      serviceStartDate: this.today(),
      configEffectiveFromDate: this.today(),
      configRequiredWorkerCount: 1,
      configHoursPerDay: 8,
      configDaysPerWeek: 6,
      configAverageMonthlyHours: 208,
      configPreparationLeadDays: 3,
      configWorkScheduleDescription: '',
      configMonthlyPrice: 0,
      idEmployee: this.employees()[0]?.idEmployee ?? '',
      idPosition: this.positions()[0]?.idPosition ?? '',
      assignmentType: 'Primary',
      assignmentStartDate: this.today(),
      assignmentIsPrimary: true,
      assignmentNotes: '',
      idScheduledShift: this.scheduledShifts()[0]?.idScheduledShift ?? '',
      idReplacementEmployee: this.employees()[0]?.idEmployee ?? '',
      coverageStartTime: '08:00:00',
      coverageEndTime: '16:00:00',
      coverageIsOvernight: false,
      coverageStatus: 'Confirmed',
      coverageNotes: '',
    });
  }

  private buildExecutionPayload(request = this.selectedRequest()): Partial<ExecuteOperationalRequest> | null {
    const form = this.executionForm.getRawValue();
    const type = request?.requestType ?? this.activeExecutionType();
    const payload: MutableExecutionPayload = {};
    const hasServiceDetails = this.hasAnyText(form.serviceCode, form.serviceName, form.serviceDescription);
    const hasSiteDetails = this.hasAnyText(
      form.siteName,
      form.siteStreet,
      form.siteMunicipality,
      form.siteState,
      form.sitePostalCode,
    ) || form.siteCode.trim() !== 'SEDE-01';

    if ((type === 'NewClient' || type === 'NewService') && (!request?.idClient || this.hasAnyText(
      form.clientCode,
      form.clientLegalName,
      form.clientTradeName,
      form.clientRfc,
    ))) {
      payload.client = {
        codeClient: form.clientCode.trim(),
        legalName: form.clientLegalName.trim(),
        tradeName: this.emptyToNull(form.clientTradeName),
        rfc: form.clientRfc.trim(),
        nationality: 'Mexicana',
        taxActivity: null,
        taxAddress: null,
        publicRegistryDate: null,
        commercialRegistryFolio: null,
        employerRegistrationNumber: null,
        incorporationDate: null,
        incorporationDeedNumber: null,
        legalRepresentativeInstrumentNumber: null,
      };
    }

    if ((type === 'NewClient' || type === 'NewService') && hasSiteDetails) {
      payload.clientSite = {
        codeClientSite: form.siteCode.trim(),
        name: form.siteName.trim(),
        street: form.siteStreet.trim(),
        exteriorNumber: null,
        interiorNumber: null,
        neighborhood: null,
        municipality: form.siteMunicipality.trim(),
        state: form.siteState.trim(),
        postalCode: form.sitePostalCode.trim(),
        countryCode: 'MX',
        accessInstructions: null,
        timeZoneId: 'America/Mexico_City',
      };
    }

    if (
      (type === 'NewService' && (!request?.idService || hasServiceDetails)) ||
      (type === 'NewClient' && hasServiceDetails)
    ) {
      payload.service = {
        idClientSite: null,
        idServiceContract: null,
        codeService: form.serviceCode.trim(),
        name: form.serviceName.trim(),
        description: form.serviceDescription.trim(),
        invoiceDescription: null,
        startDate: form.serviceStartDate || this.today(),
        endDate: null,
      };
    }

    if (
      type === 'ServiceChange' ||
      type === 'NewService' ||
      (type === 'NewClient' && Boolean(payload.service || request?.idService) && form.configWorkScheduleDescription.trim().length > 0)
    ) {
      payload.serviceConfiguration = {
        effectiveFromDate: form.configEffectiveFromDate || this.today(),
        effectiveToDate: null,
        requiredWorkerCount: this.toNumber(form.configRequiredWorkerCount),
        hoursPerDay: this.toNumber(form.configHoursPerDay),
        daysPerWeek: this.toNumber(form.configDaysPerWeek),
        averageMonthlyHours: this.toNumber(form.configAverageMonthlyHours),
        preparationLeadDays: this.toNumber(form.configPreparationLeadDays),
        workScheduleDescription: form.configWorkScheduleDescription.trim(),
        specificInstructions: null,
        monthlyPrice: this.toNumber(form.configMonthlyPrice),
        currencyCode: 'MXN',
        isTaxIncluded: false,
      };
    }

    if (type === 'StaffChange') {
      payload.staffAssignment = {
        idEmployee: form.idEmployee,
        idPosition: form.idPosition,
        assignmentType: form.assignmentType,
        startDate: form.assignmentStartDate || this.today(),
        endDate: null,
        isPrimary: form.assignmentIsPrimary,
        notes: this.emptyToNull(form.assignmentNotes),
      };
    }

    if (type === 'CoverageSupport') {
      payload.coverage = {
        idScheduledShift: form.idScheduledShift,
        idReplacementEmployee: form.idReplacementEmployee,
        coverageStartTime: this.normalizeTime(form.coverageStartTime),
        coverageEndTime: this.normalizeTime(form.coverageEndTime),
        isOvernight: form.coverageIsOvernight,
        status: form.coverageStatus,
        notes: this.emptyToNull(form.coverageNotes),
      };
    }

    return payload;
  }

  private hasAnyText(...values: readonly string[]) {
    return values.some((value) => value.trim().length > 0);
  }

  private toNumber(value: string | number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeTime(value: string) {
    return value.length === 5 ? `${value}:00` : value;
  }

  private updateRequestStatus(
    request: OperationalRequest,
    status: OperationalRequestStatus,
    resolutionNotes: string,
  ) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId) {
      return;
    }

    this.beginSave();

    this.api
      .changeStatus(request.idOperationalRequest, {
        idOrganization: organizationId,
        status,
        resolutionNotes,
      })
      .subscribe({
        next: (updated) => {
          this.message.set(`Solicitud ${updated.codeOperationalRequest} actualizada a ${this.labelForStatus(updated.status)}.`);
          this.selectedRequestId.set(updated.idOperationalRequest);
          this.statusForm.patchValue({
            idOperationalRequest: updated.idOperationalRequest,
            status: updated.status,
            resolutionNotes: updated.resolutionNotes ?? '',
          });
          this.loadRequests();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo avanzar la solicitud.'),
        complete: () => this.saving.set(false),
      });
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

  protected today() {
    return new Date().toISOString().slice(0, 10);
  }

  private nextRequestCode() {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
    return `SOL-${stamp}`;
  }
}

type RequestWorkflowColumn = {
  readonly status: OperationalRequestStatus;
  readonly label: string;
  readonly hint: string;
  readonly requests: readonly OperationalRequest[];
};

type MutableExecutionPayload = {
  -readonly [Property in keyof ExecuteOperationalRequest]?: ExecuteOperationalRequest[Property];
};
