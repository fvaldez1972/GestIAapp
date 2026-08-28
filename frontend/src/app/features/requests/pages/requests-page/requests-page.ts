import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, Organization } from '../../../clients/data-access/client.models';
import { RequestApiService } from '../../data-access/request-api.service';
import {
  ExecuteOperationalRequest,
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
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
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
    executionPayload: [''],
  });

  ngOnInit() {
    this.loadOrganizations();
  }

  protected onOrganizationChange(event: Event) {
    this.selectedOrganizationId.set((event.target as HTMLSelectElement).value);
    this.selectedClientId.set('');
    this.clients.set([]);
    this.services.set([]);
    this.requestForm.patchValue({ idClient: '', idService: '' });
    this.loadClients();
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
    this.loadServices(clientId);
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
    this.executionForm.patchValue({
      executionNotes: request.resolutionNotes ?? '',
      executionPayload: this.executionPayloadExample(request.requestType),
    });

    if (request.idClient) {
      this.selectedClientId.set(request.idClient);
      this.loadServices(request.idClient);
    }
  }

  protected resetRequestForm() {
    this.selectedRequestId.set('');
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
  }

  protected changeStatus() {
    const organizationId = this.selectedOrganizationId();
    const form = this.statusForm.getRawValue();

    if (!organizationId || !form.idOperationalRequest || this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
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
    this.updateRequestStatus(request, 'Rejected', 'Rechazada desde tablero operativo.');
  }

  protected executeRequest(request: OperationalRequest = this.selectedRequest()!) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || !request) {
      return;
    }

    const executionPayload = this.buildExecutionPayload();
    if (!executionPayload) {
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
      case 'Approved':
        return 'Completed';
      default:
        return null;
    }
  }

  protected labelForType(value: OperationalRequestType) {
    return this.requestTypes.find((item) => item.value === value)?.label ?? value;
  }

  protected labelForStatus(value: OperationalRequestStatus) {
    return this.statuses.find((item) => item.value === value)?.label ?? value;
  }

  protected labelForPriority(value: OperationalRequestPriority) {
    return this.priorities.find((item) => item.value === value)?.label ?? value;
  }

  protected executionPayloadExample(type: OperationalRequestType | undefined = this.selectedRequest()?.requestType) {
    switch (type) {
      case 'NewClient':
        return JSON.stringify({
          client: {
            codeClient: 'CLI-NUEVO',
            legalName: 'Razón Social del Cliente S.A. de C.V.',
            tradeName: 'Cliente Comercial',
            rfc: 'XAXX010101000',
            nationality: 'Mexicana',
            taxActivity: null,
            taxAddress: 'Domicilio fiscal pendiente',
            publicRegistryDate: null,
            commercialRegistryFolio: null,
            employerRegistrationNumber: null,
            incorporationDate: null,
            incorporationDeedNumber: null,
            legalRepresentativeInstrumentNumber: null,
          },
          clientSite: {
            codeClientSite: 'SEDE-01',
            name: 'Sede principal',
            street: 'Calle pendiente',
            exteriorNumber: null,
            interiorNumber: null,
            neighborhood: null,
            municipality: 'Municipio',
            state: 'Estado',
            postalCode: '00000',
            countryCode: 'MX',
            accessInstructions: null,
            timeZoneId: 'America/Mexico_City',
          },
        }, null, 2);
      case 'NewService':
        return JSON.stringify({
          clientSite: {
            codeClientSite: 'SEDE-01',
            name: 'Sede operativa',
            street: 'Calle pendiente',
            exteriorNumber: null,
            interiorNumber: null,
            neighborhood: null,
            municipality: 'Municipio',
            state: 'Estado',
            postalCode: '00000',
            countryCode: 'MX',
            accessInstructions: null,
            timeZoneId: 'America/Mexico_City',
          },
          service: {
            idClientSite: null,
            idServiceContract: null,
            codeService: 'SRV-NUEVO',
            name: 'Nuevo servicio',
            description: 'Servicio solicitado desde flujo operativo',
            invoiceDescription: null,
            startDate: this.today(),
            endDate: null,
          },
          serviceConfiguration: {
            effectiveFromDate: this.today(),
            effectiveToDate: null,
            requiredWorkerCount: 1,
            hoursPerDay: 8,
            daysPerWeek: 6,
            averageMonthlyHours: 208,
            preparationLeadDays: 3,
            workScheduleDescription: 'Turno por definir',
            specificInstructions: null,
            monthlyPrice: 0,
            currencyCode: 'MXN',
            isTaxIncluded: false,
          },
        }, null, 2);
      case 'ServiceChange':
        return JSON.stringify({
          serviceConfiguration: {
            effectiveFromDate: this.today(),
            effectiveToDate: null,
            requiredWorkerCount: 1,
            hoursPerDay: 8,
            daysPerWeek: 6,
            averageMonthlyHours: 208,
            preparationLeadDays: 3,
            workScheduleDescription: 'Nueva configuración solicitada',
            specificInstructions: null,
            monthlyPrice: 0,
            currencyCode: 'MXN',
            isTaxIncluded: false,
          },
        }, null, 2);
      case 'StaffChange':
        return JSON.stringify({
          staffAssignment: {
            idEmployee: '00000000-0000-0000-0000-000000000000',
            idPosition: '00000000-0000-0000-0000-000000000000',
            assignmentType: 'Primary',
            startDate: this.today(),
            endDate: null,
            isPrimary: true,
            notes: null,
          },
        }, null, 2);
      case 'CoverageSupport':
        return JSON.stringify({
          coverage: {
            idScheduledShift: '00000000-0000-0000-0000-000000000000',
            idReplacementEmployee: '00000000-0000-0000-0000-000000000000',
            coverageStartTime: '08:00:00',
            coverageEndTime: '16:00:00',
            isOvernight: false,
            status: 'Confirmed',
            notes: null,
          },
        }, null, 2);
      default:
        return '{}';
    }
  }

  private loadOrganizations() {
    this.loading.set(true);
    this.error.set('');

    this.clientApi.listOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.selectedOrganizationId.set(organizations[0]?.idOrganization ?? '');
        this.loadClients();
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

  private buildExecutionPayload(): Partial<ExecuteOperationalRequest> | null {
    const rawPayload = this.executionForm.controls.executionPayload.value.trim();

    if (!rawPayload) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawPayload) as Partial<ExecuteOperationalRequest>;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        this.error.set('Los datos de ejecución deben ser un objeto JSON.');
        return null;
      }

      return parsed;
    } catch {
      this.error.set('Los datos de ejecución no tienen formato JSON válido.');
      return null;
    }
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
