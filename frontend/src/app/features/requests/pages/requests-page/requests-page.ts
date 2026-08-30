import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, Organization, ScheduledShift, ServicePosition } from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { RequestApiService } from '../../data-access/request-api.service';
import {
  ExecuteOperationalRequest,
  ExecuteOperationalRequestResult,
  OperationalRequestExecutionPreview,
  OperationalRequest,
  OperationalRequestPriority,
  OperationalRequestStatus,
  OperationalRequestType,
} from '../../data-access/request.models';

@Component({
  selector: 'app-requests-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './requests-page.html',
  styleUrl: './requests-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestsPage implements OnInit {
  private readonly api = inject(RequestApiService);
  private readonly auth = inject(AuthService);
  private readonly clientApi = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly filterServices = signal<readonly ManagedService[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly scheduledShifts = signal<readonly ScheduledShift[]>([]);
  protected readonly requests = signal<readonly OperationalRequest[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClientId = signal('');
  protected readonly filterStatus = signal<OperationalRequestStatus | ''>('');
  protected readonly stageFilter = signal<RequestStageFilter>('all');
  protected readonly filterType = signal<OperationalRequestType | ''>('');
  protected readonly filterPriority = signal<OperationalRequestPriority | ''>('');
  protected readonly filterServiceId = signal('');
  protected readonly filterResponsible = signal('');
  protected readonly filterDateFrom = signal(this.today());
  protected readonly filterDateTo = signal(this.today());
  protected readonly search = signal('');
  protected readonly sortMode = signal<RequestSortMode>('recent');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly selectedRequestId = signal('');
  protected readonly workspaceOpen = signal(false);
  protected readonly workspaceTab = signal<RequestWorkspaceTab>('details');
  protected readonly newRequestStep = signal<NewRequestStep>(1);
  protected readonly detailPanelOpen = signal(false);
  protected readonly detailPanelTab = signal<RequestWorkspaceTab>('details');
  protected readonly activeExecutionType = signal<OperationalRequestType>('NewService');
  protected readonly requestTypeSelected = signal(false);
  protected readonly attemptedNewRequestNext = signal(false);
  protected readonly executionPreview = signal<OperationalRequestExecutionPreview | null>(null);
  protected readonly executionResult = signal<ExecuteOperationalRequestResult | null>(null);
  protected readonly selectedOrganization = computed(
    () => this.organizations().find((organization) => organization.idOrganization === this.selectedOrganizationId()) ?? null,
  );

  protected readonly selectedRequest = computed(
    () => this.requests().find((request) => request.idOperationalRequest === this.selectedRequestId()) ?? null,
  );
  protected readonly filteredRequests = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('es-MX');
    const status = this.filterStatus();
    const type = this.filterType();
    const priority = this.filterPriority();
    const serviceId = this.filterServiceId();
    const responsible = this.filterResponsible().trim().toLocaleLowerCase('es-MX');
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();

    return this.requests().filter((request) => {
      const searchMatches =
        !search ||
        request.codeOperationalRequest.toLocaleLowerCase('es-MX').includes(search) ||
        request.title.toLocaleLowerCase('es-MX').includes(search) ||
        request.requestedByName.toLocaleLowerCase('es-MX').includes(search) ||
        (request.clientName ?? '').toLocaleLowerCase('es-MX').includes(search) ||
        (request.serviceName ?? '').toLocaleLowerCase('es-MX').includes(search);
      const dateMatches =
        (!dateFrom || (request.neededByDate ?? '') >= dateFrom) &&
        (!dateTo || (request.neededByDate ?? '') <= dateTo);

      return (
        searchMatches &&
        (!status || request.status === status) &&
        (!type || request.requestType === type) &&
        (!priority || request.priority === priority) &&
        (!serviceId || request.idService === serviceId) &&
        (!responsible || request.requestedByName.toLocaleLowerCase('es-MX').includes(responsible)) &&
        dateMatches
      );
    });
  });
  protected readonly visibleRequests = computed(() => {
    const priorityWeight: Record<OperationalRequestPriority, number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1,
    };

    return [...this.filteredRequests()]
      .filter((request) => this.matchesStage(request, this.stageFilter()))
      .sort((left, right) => {
      switch (this.sortMode()) {
        case 'priority':
          return priorityWeight[right.priority] - priorityWeight[left.priority];
        case 'needed':
          return this.dateWeight(left.neededByDate) - this.dateWeight(right.neededByDate);
        case 'recent':
        default:
          return this.dateWeight(right.updatedAt ?? right.createdAt) - this.dateWeight(left.updatedAt ?? left.createdAt);
        }
      });
  });
  protected readonly stageDefinitions = computed<readonly RequestStageDefinition[]>(() => [
    { stage: 'all', label: 'Todas', hint: 'Vista general', count: this.filteredRequests().length },
    { stage: 'draft', label: 'Borrador', hint: 'Pendientes de enviar', count: this.countStage('draft') },
    { stage: 'open', label: 'Abiertas', hint: 'Por atender', count: this.countStage('open') },
    { stage: 'approved', label: 'Aprobadas', hint: 'Aprobadas', count: this.countStage('approved') },
    { stage: 'execution', label: 'En ejecución', hint: 'En curso', count: this.countStage('execution') },
    { stage: 'completed', label: 'Completadas', hint: 'Cerradas', count: this.countStage('completed') },
    { stage: 'cancelled', label: 'Canceladas', hint: 'Canceladas', count: this.countStage('cancelled') },
  ]);
  protected readonly totalRequests = computed(() => this.filteredRequests().length);
  protected readonly openRequests = computed(() => this.filteredRequests().filter((request) => this.isOpenStatus(request.status)).length);
  protected readonly completedRequests = computed(() => this.filteredRequests().filter((request) => request.status === 'Completed').length);
  protected readonly blockedRequests = computed(
    () =>
      this.filteredRequests().filter((request) => ['Rejected', 'Cancelled'].includes(request.status) || this.isOverdue(request)).length,
  );

  protected readonly requestTypes: readonly { value: OperationalRequestType; label: string }[] = [
    { value: 'NewClient', label: 'Alta de cliente' },
    { value: 'NewService', label: 'Nuevo servicio' },
    { value: 'ServiceChange', label: 'Cambio de configuración' },
    { value: 'StaffChange', label: 'Cambio de personal' },
    { value: 'CoverageSupport', label: 'Solicitud de cobertura' },
    { value: 'Other', label: 'Otro' },
  ];

  protected readonly requestTypeCards: readonly RequestTypeCard[] = [
    { value: 'NewClient', label: 'Alta de cliente', hint: 'Registrar un cliente nuevo en el sistema.', icon: '🏢' },
    { value: 'NewService', label: 'Nuevo servicio', hint: 'Solicitar un servicio adicional para un cliente.', icon: '🛡️' },
    { value: 'ServiceChange', label: 'Cambio de configuración', hint: 'Ajustar horarios, personal requerido o condiciones.', icon: '⚙️' },
    { value: 'StaffChange', label: 'Cambio de personal', hint: 'Mover, reemplazar o asignar personal operativo.', icon: '👥' },
    { value: 'CoverageSupport', label: 'Solicitud de cobertura', hint: 'Cubrir una falta, turno o apoyo puntual.', icon: '✅' },
    { value: 'Other', label: 'Otro', hint: 'Registrar una necesidad operativa especial.', icon: '✦' },
  ];

  protected readonly statuses: readonly { value: OperationalRequestStatus; label: string }[] = [
    { value: 'Draft', label: 'Borrador' },
    { value: 'Submitted', label: 'Abierta' },
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

  protected readonly savedFilters: readonly SavedRequestFilter[] = [
    { label: 'Completadas', icon: '✓', status: 'Completed' },
    { label: 'Pendientes de aprobación', icon: '!', status: 'InReview' },
    { label: 'Alta de cliente', icon: '+', type: 'NewClient' },
    { label: 'Vence hoy', icon: '↘', dueToday: true },
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
    neededByDate: ['', [Validators.required]],
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
    this.filterServices.set([]);
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
  }

  protected onFilterTypeChange(event: Event) {
    this.filterType.set((event.target as HTMLSelectElement).value as OperationalRequestType | '');
  }

  protected onFilterPriorityChange(event: Event) {
    this.filterPriority.set((event.target as HTMLSelectElement).value as OperationalRequestPriority | '');
  }

  protected onFilterServiceChange(event: Event) {
    this.filterServiceId.set((event.target as HTMLSelectElement).value);
  }

  protected onFilterResponsibleChange(event: Event) {
    this.filterResponsible.set((event.target as HTMLInputElement).value);
  }

  protected onDateFromChange(event: Event) {
    this.filterDateFrom.set((event.target as HTMLInputElement).value);
  }

  protected onDateToChange(event: Event) {
    this.filterDateTo.set((event.target as HTMLInputElement).value);
  }

  protected onSearchChange(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected applySearch() {
    this.message.set('Filtros aplicados.');
  }

  protected onSortModeChange(event: Event) {
    this.sortMode.set((event.target as HTMLSelectElement).value as RequestSortMode);
  }

  protected filterByStage(stage: RequestStageFilter) {
    this.stageFilter.set(stage);
  }

  protected clearQuickFilters() {
    this.clearFilters();
  }

  protected clearFilters() {
    this.stageFilter.set('all');
    this.filterStatus.set('');
    this.filterType.set('');
    this.filterPriority.set('');
    this.filterServiceId.set('');
    this.filterResponsible.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.search.set('');
  }

  protected applySavedFilter(filter: SavedRequestFilter) {
    this.stageFilter.set('all');
    this.filterStatus.set(filter.status ?? '');
    this.filterType.set(filter.type ?? '');
    this.filterPriority.set('');
    this.filterServiceId.set('');
    this.filterResponsible.set('');
    if (filter.dueToday) {
      this.filterDateFrom.set(this.today());
      this.filterDateTo.set(this.today());
    } else {
      this.filterDateFrom.set('');
      this.filterDateTo.set('');
    }
  }

  protected openNewRequest() {
    this.resetRequestForm();
    this.detailPanelOpen.set(false);
    this.workspaceTab.set('details');
    this.newRequestStep.set(1);
    this.requestTypeSelected.set(false);
    this.attemptedNewRequestNext.set(false);
    this.workspaceOpen.set(true);
  }

  protected openSelectedRequest(tab: RequestWorkspaceTab = 'details') {
    if (!this.selectedRequest() && tab !== 'details') {
      return;
    }

    this.detailPanelTab.set(tab);
    this.detailPanelOpen.set(true);
  }

  protected closeWorkspace() {
    this.workspaceOpen.set(false);
    this.executionPreview.set(null);
    this.executionResult.set(null);
  }

  protected closeDetailPanel() {
    this.detailPanelOpen.set(false);
    this.executionPreview.set(null);
    this.executionResult.set(null);
  }

  protected showDetailPanelTab(tab: RequestWorkspaceTab) {
    if (tab !== 'details' && !this.selectedRequest()) {
      return;
    }

    this.detailPanelTab.set(tab);
  }

  protected showWorkspaceTab(tab: RequestWorkspaceTab) {
    if (tab !== 'details' && !this.selectedRequest()) {
      return;
    }

    this.workspaceTab.set(tab);
  }

  protected nextNewRequestStep() {
    this.attemptedNewRequestNext.set(true);
    if (this.newRequestStep() === 1 && !this.canContinueNewRequest()) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.newRequestStep.set(Math.min(3, this.newRequestStep() + 1) as NewRequestStep);
  }

  protected previousNewRequestStep() {
    this.newRequestStep.set(Math.max(1, this.newRequestStep() - 1) as NewRequestStep);
  }

  protected selectRequestType(type: OperationalRequestType) {
    this.requestTypeSelected.set(true);
    this.activeExecutionType.set(type);
    this.executionPreview.set(null);
    this.executionResult.set(null);
    this.requestForm.patchValue({
      requestType: type,
      idClient: type === 'NewClient' ? '' : this.requestForm.controls.idClient.value,
      title: this.defaultTitleForType(type),
    });
  }

  protected canContinueNewRequest() {
    const form = this.requestForm.getRawValue();
    return Boolean(
      this.selectedOrganizationId() &&
      this.requestTypeSelected() &&
      form.priority &&
      form.neededByDate &&
      form.requestedByName.trim() &&
      form.title.trim() &&
      form.description.trim() &&
      (form.requestType === 'NewClient' || form.idClient),
    );
  }

  protected shouldShowFieldError(controlName: keyof typeof this.requestForm.controls) {
    const control = this.requestForm.controls[controlName];
    return control.invalid && (control.touched || this.attemptedNewRequestNext());
  }

  protected saveRequest(targetStatus: OperationalRequestStatus | null = null) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || this.requestForm.invalid || (!this.selectedRequest() && !this.requestTypeSelected())) {
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

    operation.pipe(
      switchMap((request) => {
        if (!targetStatus || request.status === targetStatus) {
          return of(request);
        }

        return this.api.changeStatus(request.idOperationalRequest, {
          idOrganization: organizationId,
          status: targetStatus,
          resolutionNotes: targetStatus === 'Submitted'
            ? 'Solicitud enviada para revisión.'
            : null,
        });
      }),
    ).subscribe({
        next: (request) => {
          this.message.set(
            targetStatus === 'Submitted'
              ? 'Solicitud enviada a revisión.'
              : selectedRequestId ? 'Solicitud actualizada correctamente.' : 'Borrador guardado correctamente.',
          );
          this.selectedRequestId.set(request.idOperationalRequest);
          this.statusForm.patchValue({ idOperationalRequest: request.idOperationalRequest });
          this.loadRequests();
          if (!selectedRequestId && targetStatus === 'Submitted') {
            this.detailPanelOpen.set(true);
            this.workspaceOpen.set(false);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error, selectedRequestId ? 'No se pudo actualizar la solicitud.' : 'No se pudo crear la solicitud.'),
        complete: () => this.saving.set(false),
      });
  }

  protected selectRequest(
    request: OperationalRequest,
    options: { readonly open?: boolean; readonly modal?: boolean; readonly tab?: RequestWorkspaceTab } = {},
  ) {
    this.selectedRequestId.set(request.idOperationalRequest);
    this.activeExecutionType.set(request.requestType);
    this.requestTypeSelected.set(true);
    this.executionPreview.set(null);
    this.executionResult.set(null);
    this.workspaceOpen.set(options.modal ?? false);
    this.detailPanelOpen.set(options.open ?? true);
    this.workspaceTab.set(options.tab ?? 'details');
    this.detailPanelTab.set(options.tab ?? 'details');
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
    this.requestTypeSelected.set(false);
    this.executionPreview.set(null);
    this.executionResult.set(null);
    this.requestForm.reset({
      codeOperationalRequest: this.nextRequestCode(),
      idClient: this.selectedClientId(),
      idService: '',
      requestType: 'NewService',
      priority: 'Medium',
      title: '',
      description: '',
      requestedByName: this.currentRequesterName(),
      neededByDate: this.today(),
    });
    this.resetExecutionForm();
  }

  protected changeStatus() {
    const request = this.selectedRequest();
    const form = this.statusForm.getRawValue();

    if (!request || !form.idOperationalRequest || this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
      return;
    }

    const rule = this.transitionRule(request, form.status);
    if (!rule.enabled) {
      this.error.set(rule.reason);
      return;
    }

    this.updateRequestStatus(request, form.status, this.emptyToNull(form.resolutionNotes) ?? rule.note);
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
    this.selectRequest(request, { open: true, tab: 'execution' });
    this.message.set('Solicitud seleccionada. Valida el impacto y completa los datos antes de ejecutar.');
  }

  protected openEditRequest(request: OperationalRequest) {
    if (request.status === 'Completed') {
      this.selectRequest(request, { open: true, tab: 'execution' });
      return;
    }

    this.selectRequest(request, { modal: true, open: false, tab: 'details' });
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
          this.executionResult.set(null);
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
    this.executionResult.set(null);

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
          this.executionPreview.set(null);
          this.executionResult.set(result);
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

  protected transitionRule(request: OperationalRequest, target: OperationalRequestStatus): RequestTransitionRule {
    if (request.status === 'Completed') {
      return {
        label: `Cambiar a ${this.labelForStatus(target)}`,
        target,
        enabled: false,
        reason: 'No disponible para solicitudes completadas.',
        note: 'Solicitud completada sin cambios.',
      };
    }

    const allowed: Partial<Record<OperationalRequestStatus, readonly OperationalRequestStatus[]>> = {
      Draft: ['Submitted', 'Cancelled'],
      Submitted: ['InReview', 'Cancelled'],
      InReview: ['Approved', 'Rejected', 'Cancelled'],
      Approved: ['Cancelled'],
      Rejected: ['Draft'],
      Cancelled: ['Draft'],
    };
    const enabled = allowed[request.status]?.includes(target) ?? false;

    return {
      label: `Cambiar a ${this.labelForStatus(target)}`,
      target,
      enabled,
      reason: enabled ? '' : `No se puede pasar de ${this.labelForStatus(request.status)} a ${this.labelForStatus(target)}.`,
      note: `Cambio de estado: ${this.labelForStatus(request.status)} → ${this.labelForStatus(target)}.`,
    };
  }

  protected transitionTo(request: OperationalRequest, status: OperationalRequestStatus) {
    const rule = this.transitionRule(request, status);
    if (!rule.enabled) {
      return;
    }

    if (status === 'Rejected' && !window.confirm(`¿Rechazar la solicitud ${request.codeOperationalRequest}?`)) {
      return;
    }

    this.updateRequestStatus(request, status, rule.note);
  }

  protected primaryTransitions(request: OperationalRequest) {
    const targets: OperationalRequestStatus[] = ['Submitted', 'InReview', 'Approved', 'Rejected', 'Cancelled', 'Draft'];
    return targets
      .filter((target) => target !== request.status)
      .map((target) => this.transitionRule(request, target));
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

  protected labelForStage(value: RequestStageFilter) {
    return this.stageDefinitions().find((item) => item.stage === value)?.label ?? 'Solicitudes visibles';
  }

  protected actionLabelForRequest(request: OperationalRequest) {
    switch (request.status) {
      case 'Draft':
        return 'Enviar';
      case 'Submitted':
        return 'Tomar revisión';
      case 'InReview':
        return 'Aprobar';
      case 'Approved':
        return 'Validar impacto';
      case 'Completed':
        return 'Ver resultado';
      default:
        return 'Ver detalle';
    }
  }

  protected statusClass(value: OperationalRequestStatus) {
    return `status-${value.toLocaleLowerCase('en-US')}`;
  }

  protected serviceStateLabel(request: OperationalRequest) {
    switch (request.status) {
      case 'Completed':
        return 'Ejecutado';
      case 'Approved':
        return 'Listo para ejecutar';
      case 'Rejected':
      case 'Cancelled':
        return 'No aplica';
      case 'Draft':
        return request.serviceName ? 'Sin ejecutar' : 'Por definir';
      case 'Submitted':
      case 'InReview':
      default:
        return request.serviceName ? 'En revisión' : 'Pendiente';
    }
  }

  protected serviceStateClass(request: OperationalRequest) {
    if (request.status === 'Completed') {
      return 'service-executed';
    }
    if (request.status === 'Approved') {
      return 'service-ready';
    }
    if (['Rejected', 'Cancelled'].includes(request.status)) {
      return 'service-muted';
    }
    return 'service-pending';
  }

  protected requestCycle(request: OperationalRequest): readonly RequestCycleItem[] {
    const base: RequestCycleItem[] = [
      { label: 'Borrador', status: 'Draft' },
      { label: 'Abierta', status: 'Submitted' },
      { label: 'Aprobada', status: 'Approved' },
      { label: 'Ejecutada', status: 'Completed' },
    ];
    const order: OperationalRequestStatus[] = ['Draft', 'Submitted', 'InReview', 'Approved', 'Completed'];
    const currentIndex = order.indexOf(request.status);

    return base.map((item) => ({
      ...item,
      done: request.status === 'Completed' || order.indexOf(item.status) <= currentIndex,
      active: item.status === request.status || (item.status === 'Submitted' && request.status === 'InReview'),
    }));
  }

  protected previewCreatedItems(preview: OperationalRequestExecutionPreview) {
    return preview.impact.filter((item) => this.containsAny(item, 'crear', 'creará', 'alta', 'nuev'));
  }

  protected previewUpdatedItems(preview: OperationalRequestExecutionPreview) {
    return preview.impact.filter((item) => this.containsAny(item, 'actualizar', 'modificar', 'cambiar', 'ajustar'));
  }

  protected previewOtherItems(preview: OperationalRequestExecutionPreview) {
    const created = new Set(this.previewCreatedItems(preview));
    const updated = new Set(this.previewUpdatedItems(preview));
    return preview.impact.filter((item) => !created.has(item) && !updated.has(item));
  }

  protected formatDate(value: string | null) {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
  }

  protected isOverdue(request: OperationalRequest) {
    return Boolean(request.neededByDate && request.neededByDate < this.today() && request.status !== 'Completed');
  }

  protected todayLabel() {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
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
      next: (result) => {
        this.clients.set(result.items);
        this.loadFilterServices(result.items);
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los clientes.'),
    });
  }

  private loadFilterServices(clients: readonly Client[]) {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || clients.length === 0) {
      this.filterServices.set([]);
      return;
    }

    forkJoin(clients.map((client) => this.clientApi.listServices(organizationId, client.idClient))).subscribe({
      next: (serviceGroups) => this.filterServices.set(serviceGroups.flat()),
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los servicios para filtros.'),
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
      .listRequests(organizationId, '', '', '', 1, 200)
      .subscribe({
        next: (result) => {
          this.requests.set(result.items);
          const first = result.items[0];
          const currentSelection = result.items.find((request) => request.idOperationalRequest === this.selectedRequestId());

          if (currentSelection) {
            this.selectRequest(currentSelection, {
              open: this.detailPanelOpen(),
              modal: this.workspaceOpen(),
              tab: this.detailPanelOpen() ? this.detailPanelTab() : this.workspaceTab(),
            });
          } else if (first && !(this.workspaceOpen() && !this.selectedRequestId())) {
            this.selectRequest(first, { open: false });
          } else {
            this.resetRequestForm();
            this.workspaceOpen.set(false);
            this.detailPanelOpen.set(false);
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

  private currentRequesterName() {
    return this.auth.displayName() || this.auth.session()?.user.email || 'Operación';
  }

  private defaultTitleForType(type: OperationalRequestType) {
    switch (type) {
      case 'NewClient':
        return 'Alta de cliente';
      case 'NewService':
        return 'Nuevo servicio operativo';
      case 'ServiceChange':
        return 'Cambio de configuración de servicio';
      case 'StaffChange':
        return 'Cambio de personal';
      case 'CoverageSupport':
        return 'Solicitud de cobertura';
      case 'Other':
      default:
        return 'Solicitud operativa';
    }
  }

  private matchesStage(request: OperationalRequest, stage: RequestStageFilter) {
    switch (stage) {
      case 'draft':
        return request.status === 'Draft';
      case 'open':
        return request.status === 'Submitted' || request.status === 'InReview';
      case 'approved':
        return request.status === 'Approved';
      case 'execution':
        return request.status === 'Approved';
      case 'completed':
        return request.status === 'Completed';
      case 'cancelled':
        return request.status === 'Rejected' || request.status === 'Cancelled';
      case 'all':
      default:
        return true;
    }
  }

  private countStage(stage: RequestStageFilter) {
    return this.filteredRequests().filter((request) => this.matchesStage(request, stage)).length;
  }

  private isOpenStatus(status: OperationalRequestStatus) {
    return status === 'Submitted' || status === 'InReview' || status === 'Approved';
  }

  private containsAny(value: string, ...needles: readonly string[]) {
    const normalized = value.toLocaleLowerCase('es-MX');
    return needles.some((needle) => normalized.includes(needle));
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

  private dateWeight(value: string | null) {
    if (!value) {
      return Number.MAX_SAFE_INTEGER;
    }

    const normalizedValue = value.includes('T') ? value : `${value}T00:00:00Z`;
    const parsed = new Date(normalizedValue).getTime();
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
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

type RequestStageDefinition = {
  readonly stage: RequestStageFilter;
  readonly label: string;
  readonly hint: string;
  readonly count: number;
};

type RequestWorkspaceTab = 'details' | 'status' | 'documents' | 'execution';
type RequestSortMode = 'recent' | 'priority' | 'needed';
type RequestStageFilter = 'all' | 'draft' | 'open' | 'approved' | 'execution' | 'completed' | 'cancelled';
type NewRequestStep = 1 | 2 | 3;

type RequestTypeCard = {
  readonly value: OperationalRequestType;
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
};

type SavedRequestFilter = {
  readonly label: string;
  readonly icon: string;
  readonly status?: OperationalRequestStatus;
  readonly type?: OperationalRequestType;
  readonly dueToday?: boolean;
};

type RequestTransitionRule = {
  readonly label: string;
  readonly target: OperationalRequestStatus;
  readonly enabled: boolean;
  readonly reason: string;
  readonly note: string;
};

type RequestCycleItem = {
  readonly label: string;
  readonly status: OperationalRequestStatus;
  readonly done?: boolean;
  readonly active?: boolean;
};

type MutableExecutionPayload = {
  -readonly [Property in keyof ExecuteOperationalRequest]?: ExecuteOperationalRequest[Property];
};
