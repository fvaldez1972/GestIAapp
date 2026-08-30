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
import {
  Employee,
  EmployeeDocument,
  EmployeeDocumentStatus,
  EmployeeDocumentType,
  EmployeeEvaluation,
} from '../../../workforce/data-access/workforce.models';
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
  protected readonly workforceDocuments = signal<readonly BusinessDocument[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedDocumentId = signal('');
  protected readonly selectedOwnerType = signal<BusinessDocumentOwnerType>('Client');
  protected readonly selectedFilterOwnerType = signal<BusinessDocumentOwnerType | ''>('');
  protected readonly expiryFilter = signal<DocumentExpiryFilter>('all');
  protected readonly sensitivityFilter = signal<DocumentSensitivityFilter>('all');
  protected readonly uploadStep = signal(1);
  protected readonly selectedFileName = signal('');
  protected readonly selectedFileSize = signal('');
  protected readonly editorOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly canWrite = computed(() => this.auth.hasPermission('DOCUMENTS.WRITE'));
  protected readonly canReview = computed(() => this.auth.hasPermission('DOCUMENTS.WRITE'));
  protected readonly selectedOrganization = computed(
    () => this.organizations().find((organization) => organization.idOrganization === this.selectedOrganizationId()) ?? null,
  );
  protected readonly allDocuments = computed(() => [...this.documents(), ...this.workforceDocuments()]);
  protected readonly selectedDocument = computed(
    () => this.allDocuments().find((document) => document.idBusinessDocument === this.selectedDocumentId()) ?? null,
  );
  protected readonly visibleDocuments = computed(() =>
    this.allDocuments().filter((document) => this.matchesVisibleDocument(document)),
  );
  protected readonly expiredDocuments = computed(() => this.visibleDocuments().filter((document) => document.isExpired).length);
  protected readonly pendingDocuments = computed(
    () => this.visibleDocuments().filter((document) => document.status === 'PendingReview').length,
  );
  protected readonly validatedDocuments = computed(
    () => this.visibleDocuments().filter((document) => document.status === 'Validated').length,
  );
  protected readonly dueSoonDocuments = computed(() => {
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 30);

    return this.visibleDocuments().filter((document) => {
      if (!document.expiresDate || document.isExpired) {
        return false;
      }

      const expiresDate = new Date(`${document.expiresDate}T00:00:00`);
      return expiresDate >= today && expiresDate <= limit;
    }).length;
  });
  protected readonly sensitiveDocuments = computed(
    () => this.visibleDocuments().filter((document) => document.isSensitive).length,
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

  protected readonly categories: readonly string[] = [
    'INE',
    'CURP',
    'NSS',
    'Comprobante domicilio',
    'Contrato',
    'Anexo',
    'Instructivo',
    'Evaluación',
    'Solicitud',
    'Otro',
  ];

  protected readonly employeeDocumentTypes: readonly { value: EmployeeDocumentType; label: string }[] = [
    { value: 'EmploymentApplication', label: 'Solicitud de empleo' },
    { value: 'BirthCertificate', label: 'Acta de nacimiento' },
    { value: 'MarriageCertificate', label: 'Acta de matrimonio' },
    { value: 'VoterId', label: 'INE' },
    { value: 'Curp', label: 'CURP' },
    { value: 'SocialSecurityNumber', label: 'NSS' },
    { value: 'Rfc', label: 'RFC' },
    { value: 'TaxStatusCertificate', label: 'Constancia fiscal' },
    { value: 'DriverLicense', label: 'Licencia' },
    { value: 'ProofOfAddress', label: 'Comprobante domicilio' },
    { value: 'ProofOfStudies', label: 'Comprobante estudios' },
    { value: 'MilitaryServiceCard', label: 'Cartilla militar' },
    { value: 'CriminalRecordCertificate', label: 'Antecedentes no penales' },
    { value: 'Other', label: 'Otro' },
  ];

  protected readonly filterForm = this.formBuilder.nonNullable.group({
    ownerType: ['' as BusinessDocumentOwnerType | ''],
    ownerId: [''],
    status: ['' as BusinessDocumentStatus | ''],
    category: [''],
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
    privacyLevel: ['Confidencial'],
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

  protected clearFilters() {
    this.filterForm.reset({ ownerType: '', ownerId: '', status: '', category: '', search: '' });
    this.selectedFilterOwnerType.set('');
    this.expiryFilter.set('all');
    this.sensitivityFilter.set('all');
    this.loadDocuments();
  }

  protected selectDocument(document: BusinessDocument) {
    this.patchDocumentForm(document);
    this.detailOpen.set(true);
    this.editorOpen.set(false);
  }

  protected openCreateDocument() {
    this.resetForm();
    this.uploadStep.set(1);
    this.editorOpen.set(true);
    this.detailOpen.set(false);
  }

  protected openEditDocument(document: BusinessDocument) {
    if (!this.isManagedDocument(document)) {
      this.message.set('Este documento pertenece al expediente de Personal. Ábrelo desde Personal para modificarlo.');
      return;
    }

    this.patchDocumentForm(document);
    this.uploadStep.set(3);
    this.editorOpen.set(true);
    this.detailOpen.set(false);
  }

  protected closeEditor() {
    this.editorOpen.set(false);
  }

  protected closeDetail() {
    this.detailOpen.set(false);
  }

  protected onExpiryFilterChange(event: Event) {
    this.expiryFilter.set((event.target as HTMLSelectElement).value as DocumentExpiryFilter);
  }

  protected onSensitivityFilterChange(event: Event) {
    this.sensitivityFilter.set((event.target as HTMLSelectElement).value as DocumentSensitivityFilter);
  }

  protected validateDocument(document: BusinessDocument) {
    this.updateDocumentStatus(document, 'Validated');
  }

  protected rejectDocument(document: BusinessDocument) {
    this.updateDocumentStatus(document, 'Rejected');
  }

  private patchDocumentForm(document: BusinessDocument) {
    this.selectedDocumentId.set(document.idBusinessDocument);
    this.selectedOwnerType.set(document.ownerType);
    this.selectedFileName.set(document.storageReference.split('/').at(-1) ?? document.storageReference);
    this.selectedFileSize.set('');
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
      privacyLevel: document.isSensitive ? 'Confidencial' : 'Operativo',
    });
  }

  protected resetForm() {
    this.selectedDocumentId.set('');
    this.selectedOwnerType.set('Client');
    this.selectedFileName.set('');
    this.selectedFileSize.set('');
    this.uploadStep.set(1);
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
      privacyLevel: 'Confidencial',
    });
  }

  protected saveDocument() {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || this.documentForm.invalid || !this.canWrite()) {
      this.documentForm.markAllAsTouched();
      return;
    }

    const form = this.documentForm.getRawValue();
    const selectedDocumentId = this.selectedDocumentId();
    const payload = {
      idOrganization: organizationId,
      ownerType: form.ownerType,
      ownerId: form.ownerId,
      category: form.category.trim(),
      title: form.title.trim(),
      status: selectedDocumentId ? form.status : 'PendingReview' as BusinessDocumentStatus,
      issuedDate: this.emptyToNull(form.issuedDate),
      expiresDate: this.emptyToNull(form.expiresDate),
      storageReference: form.storageReference.trim(),
      isSensitive: form.isSensitive,
      notes: this.emptyToNull(form.notes),
    };
    const request = selectedDocumentId
      ? this.documentsApi.updateDocument(selectedDocumentId, payload)
      : this.documentsApi.createDocument(payload);

    this.beginSave();
    request.subscribe({
      next: (document) => {
        this.message.set(selectedDocumentId ? 'Documento actualizado correctamente.' : 'Documento registrado correctamente.');
        this.selectedDocumentId.set(document.idBusinessDocument);
        this.detailOpen.set(true);
        this.editorOpen.set(false);
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

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxSize = 10 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      this.error.set('Formato no permitido. Usa PDF, JPG o PNG.');
      input.value = '';
      return;
    }

    if (file.size > maxSize) {
      this.error.set('El archivo supera el máximo permitido de 10 MB.');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.message.set('');
    this.error.set('');
    this.selectedFileName.set(file.name);
    this.selectedFileSize.set(this.fileSizeLabel(file.size));

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
    if (!organizationId || !this.isManagedDocument(document)) {
      if (!this.isManagedDocument(document)) {
        this.message.set('Este documento se consulta desde el expediente de Personal.');
      }
      return;
    }

    this.documentsApi.downloadDocument(organizationId, document.idBusinessDocument).subscribe({
      next: (response) => this.openDownloadedBlob(response, document),
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo descargar el archivo.'),
    });
  }

  protected deactivateDocument(document: BusinessDocument) {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || !this.canWrite() || !this.isManagedDocument(document) || !window.confirm(`¿Archivar el documento "${document.title}"?`)) {
      return;
    }

    this.beginSave();
    this.documentsApi.deactivateDocument(organizationId, document.idBusinessDocument).subscribe({
      next: () => {
        this.message.set('Documento desactivado correctamente.');
        this.resetForm();
        this.detailOpen.set(false);
        this.editorOpen.set(false);
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

  protected statusTone(document: BusinessDocument) {
    if (document.isExpired || document.status === 'Expired' || document.status === 'Rejected') {
      return 'danger';
    }

    if (document.status === 'PendingReview' || this.isDueSoon(document)) {
      return 'warning';
    }

    if (document.status === 'Validated') {
      return 'success';
    }

    return 'muted';
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

  protected formattedDate(value: string | null) {
    if (!value) {
      return 'No capturada';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00`));
  }

  protected documentSignals(document: BusinessDocument) {
    const signals: { label: string; tone: 'danger' | 'warning' | 'info' }[] = [];

    if (document.isExpired || document.status === 'Expired') {
      signals.push({ label: 'Vencido', tone: 'danger' });
    } else if (this.isDueSoon(document)) {
      signals.push({ label: 'Por vencer', tone: 'warning' });
    }

    if (document.isSensitive) {
      signals.push({ label: 'Sensible', tone: 'info' });
    }

    return signals;
  }

  protected storageStatusLabel() {
    return this.documentForm.controls.storageReference.value ? 'Archivo listo para guardar' : 'Archivo pendiente';
  }

  protected uploadedFileLabel() {
    if (this.selectedFileName()) {
      return this.selectedFileSize() ? `${this.selectedFileName()} · ${this.selectedFileSize()}` : this.selectedFileName();
    }

    const reference = this.documentForm.controls.storageReference.value;
    return reference ? reference.split('/').at(-1) ?? reference : '';
  }

  protected ownerSelectionHelp() {
    const options = this.ownerOptions();
    if (!options.length) {
      return `No hay registros disponibles para ${this.labelForOwnerType(this.selectedOwnerType()).toLowerCase()}. Crea primero el registro correspondiente.`;
    }

    return 'Elige el registro real al que pertenece este documento.';
  }

  protected ownerEmptyLabel() {
    return `Sin ${this.labelForOwnerType(this.selectedOwnerType()).toLowerCase()} disponible`;
  }

  protected filterOwnerPlaceholder() {
    const ownerType = this.selectedFilterOwnerType();

    if (!ownerType) {
      return 'Elige un propietario para seleccionar registro';
    }

    return this.filterOwnerOptions().length ? 'Todos' : `Sin ${this.labelForOwnerType(ownerType).toLowerCase()} disponible`;
  }

  protected stepIsActive(step: number) {
    return this.uploadStep() === step;
  }

  protected goToStep(step: number) {
    if (step < 1 || step > 5) {
      return;
    }

    this.uploadStep.set(step);
  }

  protected nextStep() {
    if (!this.canAdvanceStep()) {
      this.markCurrentStepTouched();
      return;
    }

    if (this.uploadStep() < 5) {
      this.uploadStep.update((step) => step + 1);
    }
  }

  protected previousStep() {
    if (this.uploadStep() > 1) {
      this.uploadStep.update((step) => step - 1);
    }
  }

  protected removeSelectedFile() {
    this.selectedFileName.set('');
    this.selectedFileSize.set('');
    this.documentForm.patchValue({ storageReference: '' });
  }

  protected isManagedDocument(document: BusinessDocument) {
    return !document.idBusinessDocument.startsWith('workforce-document-');
  }

  protected canValidateDocument(document: BusinessDocument) {
    return this.canReview() && this.isManagedDocument(document);
  }

  protected reviewOwnerLabel() {
    return this.ownerOptions().find((option) => option.value === this.documentForm.controls.ownerId.value)?.label ?? 'Sin registro seleccionado';
  }

  protected isInvalid(controlName: string) {
    const control = this.documentForm.get(controlName);
    return Boolean(control?.invalid && (control.touched || control.dirty));
  }

  protected canAdvanceStep() {
    switch (this.uploadStep()) {
      case 1:
        return this.documentForm.controls.ownerType.valid;
      case 2:
        return this.documentForm.controls.ownerId.valid;
      case 3:
        return this.documentForm.controls.category.valid && this.documentForm.controls.title.valid;
      case 4:
        return this.documentForm.controls.storageReference.valid && !this.uploading();
      default:
        return true;
    }
  }

  protected currentStepHasMissingData() {
    switch (this.uploadStep()) {
      case 2:
        return this.isInvalid('ownerId');
      case 3:
        return this.isInvalid('category') || this.isInvalid('title');
      case 4:
        return this.isInvalid('storageReference');
      default:
        return false;
    }
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

  private updateDocumentStatus(document: BusinessDocument, status: BusinessDocumentStatus) {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || !this.canWrite() || this.saving()) {
      return;
    }

    const payload = {
      idOrganization: organizationId,
      ownerType: document.ownerType,
      ownerId: document.ownerId,
      category: document.category,
      title: document.title,
      status,
      issuedDate: document.issuedDate,
      expiresDate: document.expiresDate,
      storageReference: document.storageReference,
      isSensitive: document.isSensitive,
      notes: document.notes,
    };

    this.beginSave();
    this.documentsApi.updateDocument(document.idBusinessDocument, payload).subscribe({
      next: (updatedDocument) => {
        this.message.set(
          status === 'Validated' ? 'Documento validado correctamente.' : 'Documento rechazado correctamente.',
        );
        this.selectedDocumentId.set(updatedDocument.idBusinessDocument);
        this.loadDocuments();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo actualizar el estado del documento.'),
      complete: () => this.saving.set(false),
    });
  }

  private markCurrentStepTouched() {
    switch (this.uploadStep()) {
      case 2:
        this.documentForm.controls.ownerId.markAsTouched();
        break;
      case 3:
        this.documentForm.controls.category.markAsTouched();
        this.documentForm.controls.title.markAsTouched();
        break;
      case 4:
        this.documentForm.controls.storageReference.markAsTouched();
        break;
    }
  }

  private matchesExpiryFilter(document: BusinessDocument) {
    switch (this.expiryFilter()) {
      case 'expired':
        return document.isExpired || document.status === 'Expired';
      case 'dueSoon':
        return this.isDueSoon(document);
      case 'withoutExpiry':
        return !document.expiresDate;
      default:
        return true;
    }
  }

  private matchesSensitivityFilter(document: BusinessDocument) {
    switch (this.sensitivityFilter()) {
      case 'sensitive':
        return document.isSensitive;
      case 'public':
        return !document.isSensitive;
      default:
        return true;
    }
  }

  private matchesVisibleDocument(document: BusinessDocument) {
    const filters = this.filterForm.getRawValue();
    const normalizedSearch = filters.search.trim().toLowerCase();

    if (filters.ownerType && document.ownerType !== filters.ownerType) {
      return false;
    }

    if (filters.ownerId && document.ownerId !== filters.ownerId) {
      return false;
    }

    if (filters.status && document.status !== filters.status) {
      return false;
    }

    if (filters.category && document.category !== filters.category) {
      return false;
    }

    if (normalizedSearch) {
      const searchableText = [
        document.title,
        document.category,
        document.ownerLabel,
        document.ownerId,
        this.labelForOwnerType(document.ownerType),
        this.labelForStatus(document.status),
      ]
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(normalizedSearch)) {
        return false;
      }
    }

    return this.matchesExpiryFilter(document) && this.matchesSensitivityFilter(document);
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
          this.workforceDocuments.set(
            details.flatMap((detail) =>
              detail.documents.map((document) => this.mapEmployeeDocument(document, detail.employee, organizationId)),
            ),
          );
          this.evaluations.set(details.flatMap((detail) =>
            detail.evaluations.map((evaluation) => ({
              ...evaluation,
              employeeCode: detail.employee.codeEmployee,
              employeeName: detail.employee.fullName,
            })),
          ));
          this.patchOwnerIdIfNeeded();
        },
        error: () => {
          this.evaluations.set([]);
          this.workforceDocuments.set([]);
        },
      });
    } else {
      this.evaluations.set([]);
      this.workforceDocuments.set([]);
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

  private mapEmployeeDocument(
    document: EmployeeDocument,
    employee: Employee,
    organizationId: string,
  ): BusinessDocument {
    return {
      idBusinessDocument: `workforce-document-${document.idEmployeeDocument}`,
      idOrganization: organizationId,
      ownerType: 'Employee',
      ownerId: employee.idEmployee,
      ownerLabel: `${employee.fullName} · ${employee.codeEmployee}`,
      category: this.documentCategoryFromEmployeeType(document.documentType),
      title: `${this.employeeDocumentTypeLabel(document.documentType)} · ${employee.fullName}`,
      status: this.statusFromEmployeeDocument(document.status, document.expiresDate),
      issuedDate: document.issuedDate,
      expiresDate: document.expiresDate,
      isExpired: Boolean(document.expiresDate && document.expiresDate < this.today()),
      storageReference: document.storageReference ?? '',
      isSensitive: true,
      notes: document.notes,
      active: document.active,
      createdAt: document.receivedDate ?? employee.createdAt,
      updatedAt: null,
    };
  }

  private documentCategoryFromEmployeeType(type: EmployeeDocumentType): string {
    if (type === 'VoterId') {
      return 'INE';
    }

    if (type === 'SocialSecurityNumber') {
      return 'NSS';
    }

    if (type === 'ProofOfAddress') {
      return 'Comprobante domicilio';
    }

    return this.employeeDocumentTypeLabel(type);
  }

  private statusFromEmployeeDocument(status: EmployeeDocumentStatus, expiresDate: string | null): BusinessDocumentStatus {
    if (expiresDate && expiresDate < this.today()) {
      return 'Expired';
    }

    const statusMap: Record<EmployeeDocumentStatus, BusinessDocumentStatus> = {
      Pending: 'PendingReview',
      Received: 'PendingReview',
      Validated: 'Validated',
      Rejected: 'Rejected',
      Expired: 'Expired',
      NotApplicable: 'Archived',
    };

    return statusMap[status];
  }

  private employeeDocumentTypeLabel(type: EmployeeDocumentType): string {
    return this.employeeDocumentTypes.find((item) => item.value === type)?.label ?? 'Documento';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
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

  private fileSizeLabel(size: number) {
    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
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

type DocumentExpiryFilter = 'all' | 'dueSoon' | 'expired' | 'withoutExpiry';
type DocumentSensitivityFilter = 'all' | 'sensitive' | 'public';
