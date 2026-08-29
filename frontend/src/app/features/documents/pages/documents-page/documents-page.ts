import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, Organization, ServiceContract } from '../../../clients/data-access/client.models';
import { RequestApiService } from '../../../requests/data-access/request-api.service';
import { OperationalRequest } from '../../../requests/data-access/request.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee, EmployeeEvaluation } from '../../../workforce/data-access/workforce.models';
import { DocumentApiService } from '../../data-access/document-api.service';
import {
  BusinessDocument,
  BusinessDocumentOwnerType,
  BusinessDocumentStatus,
} from '../../data-access/document.models';

@Component({
  selector: 'app-documents-page',
  imports: [ReactiveFormsModule],
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage implements OnInit {
  private readonly documentsApi = inject(DocumentApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly requestApi = inject(RequestApiService);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly contracts = signal<readonly ServiceContract[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly evaluations = signal<readonly DocumentEvaluationOption[]>([]);
  protected readonly requests = signal<readonly OperationalRequest[]>([]);
  protected readonly documents = signal<readonly BusinessDocument[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedDocumentId = signal('');
  protected readonly selectedOwnerType = signal<BusinessDocumentOwnerType>('Client');
  protected readonly selectedFilterOwnerType = signal<BusinessDocumentOwnerType | ''>('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly canWrite = computed(() => this.auth.hasPermission('DOCUMENTS.WRITE'));
  protected readonly selectedDocument = computed(
    () => this.documents().find((document) => document.idBusinessDocument === this.selectedDocumentId()) ?? null,
  );
  protected readonly expiredDocuments = computed(() => this.documents().filter((document) => document.isExpired).length);
  protected readonly pendingDocuments = computed(
    () => this.documents().filter((document) => document.status === 'PendingReview').length,
  );
  protected readonly dueSoonDocuments = computed(() => {
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 30);

    return this.documents().filter((document) => {
      if (!document.expiresDate || document.isExpired) {
        return false;
      }

      const expiresDate = new Date(`${document.expiresDate}T00:00:00`);
      return expiresDate >= today && expiresDate <= limit;
    }).length;
  });
  protected readonly sensitiveDocuments = computed(
    () => this.documents().filter((document) => document.isSensitive).length,
  );
  protected readonly ownerOptions = computed(() => {
    switch (this.selectedOwnerType()) {
      case 'Client':
        return this.clients().map((client) => ({
          value: client.idClient,
          label: `${client.codeClient} · ${client.tradeName || client.legalName}`,
        }));
      case 'ServiceContract':
        return this.contracts().map((contract) => ({
          value: contract.idServiceContract,
          label: `${contract.codeServiceContract} · ${this.clientLabel(contract.idClient)}`,
        }));
      case 'Service':
        return this.services().map((service) => ({
          value: service.idService,
          label: `${service.codeService} · ${service.name}`,
        }));
      case 'Employee':
        return this.employees().map((employee) => ({
          value: employee.idEmployee,
          label: `${employee.codeEmployee} · ${employee.fullName}`,
        }));
      case 'EmployeeEvaluation':
        return this.evaluations().map((evaluation) => ({
          value: evaluation.idEmployeeEvaluation,
          label: `${evaluation.employeeCode} · ${evaluation.employeeName} · ${evaluation.evaluationType}`,
        }));
      case 'OperationalRequest':
        return this.requests().map((request) => ({
          value: request.idOperationalRequest,
          label: `${request.codeOperationalRequest} · ${request.title}`,
        }));
      default:
        return [];
    }
  });
  protected readonly filterOwnerOptions = computed(() => this.ownerOptionsForType(this.selectedFilterOwnerType()));

  protected readonly ownerTypes: readonly { value: BusinessDocumentOwnerType; label: string; help: string }[] = [
    { value: 'Client', label: 'Cliente', help: 'Contratos, alta fiscal, requisitos iniciales.' },
    { value: 'ServiceContract', label: 'Contrato', help: 'Contrato firmado y anexos.' },
    { value: 'Service', label: 'Servicio', help: 'Configuración, consignas o instrucciones.' },
    { value: 'Employee', label: 'Empleado', help: 'Papelería personal o expediente laboral.' },
    { value: 'EmployeeEvaluation', label: 'Evaluación', help: 'Evidencias de examen o certificación.' },
    { value: 'OperationalRequest', label: 'Solicitud', help: 'Soportes ligados al flujo de solicitud.' },
  ];

  protected readonly statuses: readonly { value: BusinessDocumentStatus; label: string }[] = [
    { value: 'PendingReview', label: 'Pendiente de revisión' },
    { value: 'Validated', label: 'Validado' },
    { value: 'Rejected', label: 'Rechazado' },
    { value: 'Expired', label: 'Vencido' },
    { value: 'Archived', label: 'Archivado' },
  ];

  protected readonly filterForm = this.formBuilder.nonNullable.group({
    ownerType: ['' as BusinessDocumentOwnerType | ''],
    ownerId: [''],
    status: ['' as BusinessDocumentStatus | ''],
    search: [''],
  });

  protected readonly documentForm = this.formBuilder.nonNullable.group({
    ownerType: ['Client' as BusinessDocumentOwnerType, [Validators.required]],
    ownerId: ['', [Validators.required]],
    category: ['Contrato', [Validators.required, Validators.maxLength(80)]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    status: ['PendingReview' as BusinessDocumentStatus, [Validators.required]],
    issuedDate: [''],
    expiresDate: [''],
    storageReference: ['', [Validators.required, Validators.maxLength(500)]],
    isSensitive: [false],
    notes: [''],
  });

  ngOnInit() {
    this.loadInitialData();
  }

  protected onOrganizationChange(event: Event) {
    this.selectedOrganizationId.set((event.target as HTMLSelectElement).value);
    this.selectedDocumentId.set('');
    this.loadCatalogs();
    this.loadDocuments();
  }

  protected onOwnerTypeChange() {
    this.selectedOwnerType.set(this.documentForm.controls.ownerType.value);
    this.patchOwnerIdIfNeeded();
  }

  protected onFilterOwnerTypeChange(event: Event) {
    const ownerType = (event.target as HTMLSelectElement).value as BusinessDocumentOwnerType | '';
    this.selectedFilterOwnerType.set(ownerType);
    this.filterForm.patchValue({ ownerType, ownerId: '' });
  }

  protected applyFilters() {
    this.loadDocuments();
  }

  protected selectDocument(document: BusinessDocument) {
    this.selectedDocumentId.set(document.idBusinessDocument);
    this.selectedOwnerType.set(document.ownerType);
    this.documentForm.patchValue({
      ownerType: document.ownerType,
      ownerId: document.ownerId,
      category: document.category,
      title: document.title,
      status: document.status,
      issuedDate: document.issuedDate ?? '',
      expiresDate: document.expiresDate ?? '',
      storageReference: document.storageReference,
      isSensitive: document.isSensitive,
      notes: document.notes ?? '',
    });
  }

  protected resetForm() {
    this.selectedDocumentId.set('');
    this.selectedOwnerType.set('Client');
    this.documentForm.reset({
      ownerType: 'Client',
      ownerId: this.clients()[0]?.idClient ?? '',
      category: 'Contrato',
      title: '',
      status: 'PendingReview',
      issuedDate: '',
      expiresDate: '',
      storageReference: '',
      isSensitive: false,
      notes: '',
    });
  }

  protected saveDocument() {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || this.documentForm.invalid || !this.canWrite()) {
      this.documentForm.markAllAsTouched();
      return;
    }

    const form = this.documentForm.getRawValue();
    const payload = {
      idOrganization: organizationId,
      ownerType: form.ownerType,
      ownerId: form.ownerId,
      category: form.category.trim(),
      title: form.title.trim(),
      status: form.status,
      issuedDate: this.emptyToNull(form.issuedDate),
      expiresDate: this.emptyToNull(form.expiresDate),
      storageReference: form.storageReference.trim(),
      isSensitive: form.isSensitive,
      notes: this.emptyToNull(form.notes),
    };
    const selectedDocumentId = this.selectedDocumentId();
    const request = selectedDocumentId
      ? this.documentsApi.updateDocument(selectedDocumentId, payload)
      : this.documentsApi.createDocument(payload);

    this.beginSave();
    request.subscribe({
      next: (document) => {
        this.message.set(selectedDocumentId ? 'Documento actualizado correctamente.' : 'Documento registrado correctamente.');
        this.selectedDocumentId.set(document.idBusinessDocument);
        this.loadDocuments();
      },
      error: (error: HttpErrorResponse) =>
        this.setError(error, selectedDocumentId ? 'No se pudo actualizar el documento.' : 'No se pudo crear el documento.'),
      complete: () => this.saving.set(false),
    });
  }

  protected uploadFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.uploading.set(true);
    this.message.set('');
    this.error.set('');

    this.documentsApi.uploadDocumentFile(file).subscribe({
      next: (result) => {
        this.documentForm.patchValue({
          title: this.documentForm.controls.title.value || result.originalFileName,
          storageReference: result.storageReference,
        });
        this.message.set('Archivo cargado. Guarda el documento para terminar el registro.');
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar el archivo.'),
      complete: () => {
        this.uploading.set(false);
        input.value = '';
      },
    });
  }

  protected downloadDocument(document: BusinessDocument) {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      return;
    }

    this.documentsApi.downloadDocument(organizationId, document.idBusinessDocument).subscribe({
      next: (response) => this.openDownloadedBlob(response, document),
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo descargar el archivo.'),
    });
  }

  protected deactivateDocument(document: BusinessDocument) {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || !this.canWrite() || !window.confirm(`¿Desactivar el documento "${document.title}"?`)) {
      return;
    }

    this.beginSave();
    this.documentsApi.deactivateDocument(organizationId, document.idBusinessDocument).subscribe({
      next: () => {
        this.message.set('Documento desactivado correctamente.');
        this.resetForm();
        this.loadDocuments();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar el documento.'),
      complete: () => this.saving.set(false),
    });
  }

  protected labelForOwnerType(value: BusinessDocumentOwnerType) {
    return this.ownerTypes.find((item) => item.value === value)?.label ?? 'Relacionado';
  }

  protected labelForStatus(value: BusinessDocumentStatus) {
    return this.statuses.find((item) => item.value === value)?.label ?? 'Sin estado';
  }

  protected statusClass(document: BusinessDocument) {
    if (document.isSensitive) {
      return 'is-sensitive';
    }

    if (document.isExpired || document.status === 'Expired') {
      return 'is-expired';
    }

    return `status-${document.status.toLowerCase()}`;
  }

  protected expiryLabel(document: BusinessDocument) {
    if (!document.expiresDate) {
      return 'Sin vencimiento';
    }

    if (document.isExpired) {
      return `Vencido: ${document.expiresDate}`;
    }

    return `Vence: ${document.expiresDate}`;
  }

  protected isDueSoon(document: BusinessDocument) {
    if (!document.expiresDate || document.isExpired) {
      return false;
    }

    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 30);
    const expiresDate = new Date(`${document.expiresDate}T00:00:00`);
    return expiresDate >= today && expiresDate <= limit;
  }

  protected ownerTypeHelp() {
    return this.ownerTypes.find((item) => item.value === this.selectedOwnerType())?.help ?? '';
  }

  private loadInitialData() {
    this.loading.set(true);
    this.clientApi.listOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.selectedOrganizationId.set(organizations[0]?.idOrganization ?? '');
        this.loadCatalogs();
        this.loadDocuments();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar las organizaciones.'),
      complete: () => this.loading.set(false),
    });
  }

  private ownerOptionsForType(ownerType: BusinessDocumentOwnerType | '') {
    switch (ownerType) {
      case 'Client':
        return this.clients().map((client) => ({
          value: client.idClient,
          label: `${client.codeClient} · ${client.tradeName || client.legalName}`,
        }));
      case 'ServiceContract':
        return this.contracts().map((contract) => ({
          value: contract.idServiceContract,
          label: `${contract.codeServiceContract} · ${this.clientLabel(contract.idClient)}`,
        }));
      case 'Service':
        return this.services().map((service) => ({
          value: service.idService,
          label: `${service.codeService} · ${service.name}`,
        }));
      case 'Employee':
        return this.employees().map((employee) => ({
          value: employee.idEmployee,
          label: `${employee.codeEmployee} · ${employee.fullName}`,
        }));
      case 'EmployeeEvaluation':
        return this.evaluations().map((evaluation) => ({
          value: evaluation.idEmployeeEvaluation,
          label: `${evaluation.employeeCode} · ${evaluation.employeeName} · ${evaluation.evaluationType}`,
        }));
      case 'OperationalRequest':
        return this.requests().map((request) => ({
          value: request.idOperationalRequest,
          label: `${request.codeOperationalRequest} · ${request.title}`,
        }));
      default:
        return [];
    }
  }

  private clientLabel(idClient: string) {
    const client = this.clients().find((item) => item.idClient === idClient);
    return client?.tradeName || client?.legalName || 'Cliente';
  }

  private patchOwnerIdIfNeeded() {
    const currentOwnerId = this.documentForm.controls.ownerId.value;
    const options = this.ownerOptions();

    if (!currentOwnerId || !options.some((option) => option.value === currentOwnerId)) {
      this.documentForm.patchValue({ ownerId: this.ownerOptions()[0]?.value ?? '' });
    }
  }

  private loadCatalogs() {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      return;
    }

    forkJoin({
      clients: this.clientApi.listClients(organizationId, '', 1, 100),
      employees: this.workforceApi.listEmployees(organizationId, '', '', 1, 100),
      requests: this.requestApi.listRequests(organizationId, '', '', '', 1, 100),
    }).subscribe({
      next: ({ clients, employees, requests }) => {
        this.clients.set(clients.items);
        this.employees.set(employees.items);
        this.requests.set(requests.items);
        this.loadRelatedOwnerOptions(clients.items, employees.items);
        this.documentForm.patchValue({ ownerId: this.ownerOptions()[0]?.value ?? '' });
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los catálogos de documentos.'),
    });
  }

  private loadRelatedOwnerOptions(clients: readonly Client[], employees: readonly Employee[]) {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      this.services.set([]);
      this.contracts.set([]);
      this.evaluations.set([]);
      return;
    }

    if (clients.length) {
      forkJoin(clients.map((client) => this.clientApi.listServices(organizationId, client.idClient))).subscribe({
        next: (serviceGroups) => {
          this.services.set(serviceGroups.flat());
          this.patchOwnerIdIfNeeded();
        },
        error: () => this.services.set([]),
      });

      forkJoin(clients.map((client) => this.clientApi.listContracts(organizationId, client.idClient))).subscribe({
        next: (contractGroups) => {
          this.contracts.set(contractGroups.flat());
          this.patchOwnerIdIfNeeded();
        },
        error: () => this.contracts.set([]),
      });
    } else {
      this.services.set([]);
      this.contracts.set([]);
    }

    if (employees.length) {
      forkJoin(employees.map((employee) => this.workforceApi.getEmployee(organizationId, employee.idEmployee))).subscribe({
        next: (details) => {
          this.evaluations.set(details.flatMap((detail) =>
            detail.evaluations.map((evaluation) => ({
              ...evaluation,
              employeeCode: detail.employee.codeEmployee,
              employeeName: detail.employee.fullName,
            })),
          ));
          this.patchOwnerIdIfNeeded();
        },
        error: () => this.evaluations.set([]),
      });
    } else {
      this.evaluations.set([]);
    }
  }

  private loadDocuments() {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      this.documents.set([]);
      return;
    }

    const filters = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set('');

    this.documentsApi
      .listDocuments(
        organizationId,
        filters.ownerType,
        filters.ownerId,
        filters.status,
        filters.search,
        1,
        100,
      )
      .subscribe({
        next: (result) => this.documents.set(result.items),
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los documentos.'),
        complete: () => this.loading.set(false),
      });
  }

  private openDownloadedBlob(response: HttpResponse<Blob>, document: BusinessDocument) {
    const blob = response.body;
    if (!blob) {
      this.error.set('La descarga no regresó contenido.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = document.storageReference.split('/').at(-1) || document.title;
    link.click();
    URL.revokeObjectURL(url);
  }

  private beginSave() {
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
  }

  private setError(error: HttpErrorResponse, fallback: string) {
    this.loading.set(false);
    this.saving.set(false);
    this.uploading.set(false);
    this.error.set(error.error?.detail ?? error.error?.message ?? fallback);
  }

  private emptyToNull(value: string) {
    const cleanValue = value.trim();
    return cleanValue.length > 0 ? cleanValue : null;
  }
}

type DocumentEvaluationOption = EmployeeEvaluation & {
  readonly employeeCode: string;
  readonly employeeName: string;
};
