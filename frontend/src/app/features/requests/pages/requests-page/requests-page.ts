import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, Organization } from '../../../clients/data-access/client.models';
import { RequestApiService } from '../../data-access/request-api.service';
import {
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

  protected labelForType(value: OperationalRequestType) {
    return this.requestTypes.find((item) => item.value === value)?.label ?? value;
  }

  protected labelForStatus(value: OperationalRequestStatus) {
    return this.statuses.find((item) => item.value === value)?.label ?? value;
  }

  protected labelForPriority(value: OperationalRequestPriority) {
    return this.priorities.find((item) => item.value === value)?.label ?? value;
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

  private setError(error: HttpErrorResponse, fallback: string) {
    this.loading.set(false);
    this.saving.set(false);
    this.error.set(error.error?.detail ?? error.error?.message ?? fallback);
  }

  private emptyToNull(value: string) {
    const cleanValue = value.trim();
    return cleanValue.length > 0 ? cleanValue : null;
  }

  private nextRequestCode() {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
    return `SOL-${stamp}`;
  }
}
