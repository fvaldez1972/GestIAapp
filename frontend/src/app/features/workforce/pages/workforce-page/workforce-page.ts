import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Organization } from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../data-access/workforce-api.service';
import {
  CreateEmployee,
  Employee,
  EmployeeDocument,
  EmployeeDocumentInput,
  EmployeeDocumentStatus,
  EmployeeDocumentType,
  EmployeeEvaluation,
  EmployeeEvaluationInput,
  EmployeeEvaluationResult,
  EmployeeEvaluationType,
  EmployeeInput,
  EmployeeStatus,
  PagedResult,
} from '../../data-access/workforce.models';

@Component({
  selector: 'app-workforce-page',
  imports: [ReactiveFormsModule],
  templateUrl: './workforce-page.html',
  styleUrl: './workforce-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkforcePage implements OnInit {
  private readonly api = inject(WorkforceApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedEmployee = signal<Employee | null>(null);
  protected readonly documents = signal<readonly EmployeeDocument[]>([]);
  protected readonly evaluations = signal<readonly EmployeeEvaluation[]>([]);
  protected readonly result = signal<PagedResult<Employee>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  protected readonly loading = signal(false);
  protected readonly loadingDetail = signal(false);
  protected readonly saving = signal(false);
  protected readonly employeeEditorOpen = signal(false);
  protected readonly documentEditorOpen = signal(false);
  protected readonly evaluationEditorOpen = signal(false);
  protected readonly editingEmployee = signal<Employee | null>(null);
  protected readonly editingDocument = signal<EmployeeDocument | null>(null);
  protected readonly editingEvaluation = signal<EmployeeEvaluation | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<EmployeeStatus | ''>('');
  protected readonly selectedEmployeeName = computed(() => this.selectedEmployee()?.fullName ?? 'Sin empleado seleccionado');

  protected readonly employeeStatuses: readonly { value: EmployeeStatus; label: string }[] = [
    { value: 'Candidate', label: 'Candidato' },
    { value: 'Active', label: 'Activo' },
    { value: 'OnLeave', label: 'Suspendido / permiso' },
    { value: 'Inactive', label: 'Inactivo' },
    { value: 'Terminated', label: 'Baja' },
  ];

  protected readonly documentTypes: readonly { value: EmployeeDocumentType; label: string }[] = [
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

  protected readonly documentStatuses: readonly { value: EmployeeDocumentStatus; label: string }[] = [
    { value: 'Pending', label: 'Pendiente' },
    { value: 'Received', label: 'Recibido' },
    { value: 'Validated', label: 'Validado' },
    { value: 'Rejected', label: 'Rechazado' },
    { value: 'Expired', label: 'Vencido' },
    { value: 'NotApplicable', label: 'No aplica' },
  ];

  protected readonly evaluationTypes: readonly { value: EmployeeEvaluationType; label: string }[] = [
    { value: 'Polygraph', label: 'Polígrafo' },
    { value: 'SocioeconomicStudy', label: 'Estudio socioeconómico' },
    { value: 'CriminalRecordReview', label: 'Revisión antecedentes' },
    { value: 'DrugTest', label: 'Antidoping' },
    { value: 'Other', label: 'Otro' },
  ];

  protected readonly evaluationResults: readonly { value: EmployeeEvaluationResult; label: string }[] = [
    { value: 'Pending', label: 'Pendiente' },
    { value: 'Approved', label: 'Aprobado' },
    { value: 'ApprovedWithObservations', label: 'Aprobado con observaciones' },
    { value: 'NotApproved', label: 'No aprobado' },
    { value: 'Inconclusive', label: 'Inconcluso' },
  ];

  protected readonly employeeForm = this.formBuilder.nonNullable.group({
    codeEmployee: ['', [Validators.required, Validators.maxLength(30)]],
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    jobTitle: ['', [Validators.maxLength(120)]],
    hireDate: ['', [Validators.required]],
    birthDate: [''],
    birthPlace: ['', [Validators.maxLength(150)]],
    sex: ['', [Validators.maxLength(30)]],
    maritalStatus: ['', [Validators.maxLength(40)]],
    rfc: ['', [Validators.maxLength(13)]],
    curp: ['', [Validators.maxLength(18)]],
    socialSecurityNumber: ['', [Validators.maxLength(20)]],
    voterIdNumber: ['', [Validators.maxLength(30)]],
    driverLicenseNumber: ['', [Validators.maxLength(40)]],
    militaryServiceCardNumber: ['', [Validators.maxLength(40)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    mobilePhone: ['', [Validators.maxLength(30)]],
    homePhone: ['', [Validators.maxLength(30)]],
    emergencyContactName: ['', [Validators.maxLength(200)]],
    emergencyContactPhone: ['', [Validators.maxLength(30)]],
    address: ['', [Validators.maxLength(500)]],
    municipality: ['', [Validators.maxLength(120)]],
    state: ['', [Validators.maxLength(120)]],
    postalCode: ['', [Validators.maxLength(10)]],
    housingType: ['', [Validators.maxLength(30)]],
    residenceSinceDate: [''],
  });

  protected readonly documentForm = this.formBuilder.nonNullable.group({
    documentType: ['EmploymentApplication' as EmployeeDocumentType, [Validators.required]],
    status: ['Pending' as EmployeeDocumentStatus, [Validators.required]],
    documentNumber: ['', [Validators.maxLength(80)]],
    receivedDate: [''],
    issuedDate: [''],
    expiresDate: [''],
    storageReference: ['', [Validators.maxLength(500)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly evaluationForm = this.formBuilder.nonNullable.group({
    evaluationType: ['Polygraph' as EmployeeEvaluationType, [Validators.required]],
    result: ['Pending' as EmployeeEvaluationResult, [Validators.required]],
    evaluatedDate: ['', [Validators.required]],
    expiresDate: [''],
    certificateNumber: ['', [Validators.maxLength(80)]],
    storageReference: ['', [Validators.maxLength(500)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  ngOnInit(): void {
    this.loadOrganizations();
  }

  protected loadOrganizations(): void {
    this.loading.set(true);
    this.clientApi
      .listOrganizations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (organizations) => {
          this.organizations.set(organizations);
          const organizationId = this.selectedOrganizationId() || organizations[0]?.idOrganization || '';
          this.selectedOrganizationId.set(organizationId);
          if (organizationId) {
            this.loadEmployees(1);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectOrganization(organizationId: string): void {
    this.selectedOrganizationId.set(organizationId);
    this.selectedEmployee.set(null);
    this.documents.set([]);
    this.evaluations.set([]);
    this.loadEmployees(1);
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
  }

  protected updateStatusFilter(value: EmployeeStatus | ''): void {
    this.statusFilter.set(value);
    this.loadEmployees(1);
  }

  protected loadEmployees(page = this.result().page): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.api
      .listEmployees(organizationId, this.search(), this.statusFilter(), page, this.result().pageSize)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          if (!this.selectedEmployee() && result.items.length) {
            this.selectEmployee(result.items[0]);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectEmployee(employee: Employee): void {
    this.selectedEmployee.set(employee);
    this.loadingDetail.set(true);
    this.api
      .getEmployee(this.selectedOrganizationId(), employee.idEmployee)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => {
          this.selectedEmployee.set(detail.employee);
          this.documents.set(detail.documents);
          this.evaluations.set(detail.evaluations);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateEmployee(): void {
    this.editingEmployee.set(null);
    this.employeeForm.reset(this.emptyEmployeeForm());
    this.employeeEditorOpen.set(true);
  }

  protected openEditEmployee(employee: Employee): void {
    this.editingEmployee.set(employee);
    this.employeeForm.reset({
      codeEmployee: employee.codeEmployee,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle ?? '',
      hireDate: this.dateOnly(employee.hireDate),
      birthDate: this.dateOnly(employee.birthDate),
      birthPlace: employee.birthPlace ?? '',
      sex: employee.sex ?? '',
      maritalStatus: employee.maritalStatus ?? '',
      rfc: employee.rfc ?? '',
      curp: employee.curp ?? '',
      socialSecurityNumber: employee.socialSecurityNumber ?? '',
      voterIdNumber: employee.voterIdNumber ?? '',
      driverLicenseNumber: employee.driverLicenseNumber ?? '',
      militaryServiceCardNumber: employee.militaryServiceCardNumber ?? '',
      email: employee.email ?? '',
      mobilePhone: employee.mobilePhone ?? '',
      homePhone: employee.homePhone ?? '',
      emergencyContactName: employee.emergencyContactName ?? '',
      emergencyContactPhone: employee.emergencyContactPhone ?? '',
      address: employee.address ?? '',
      municipality: employee.municipality ?? '',
      state: employee.state ?? '',
      postalCode: employee.postalCode ?? '',
      housingType: employee.housingType ?? '',
      residenceSinceDate: this.dateOnly(employee.residenceSinceDate),
    });
    this.employeeEditorOpen.set(true);
  }

  protected saveEmployee(): void {
    if (this.employeeForm.invalid || !this.selectedOrganizationId()) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const form = this.employeeForm.getRawValue();
    const input: EmployeeInput = {
      idOrganization: this.selectedOrganizationId(),
      fullName: form.fullName,
      jobTitle: this.optional(form.jobTitle),
      hireDate: form.hireDate,
      birthDate: this.optional(form.birthDate),
      birthPlace: this.optional(form.birthPlace),
      sex: this.optional(form.sex),
      maritalStatus: this.optional(form.maritalStatus),
      rfc: this.optional(form.rfc),
      curp: this.optional(form.curp),
      socialSecurityNumber: this.optional(form.socialSecurityNumber),
      voterIdNumber: this.optional(form.voterIdNumber),
      driverLicenseNumber: this.optional(form.driverLicenseNumber),
      militaryServiceCardNumber: this.optional(form.militaryServiceCardNumber),
      email: this.optional(form.email),
      mobilePhone: this.optional(form.mobilePhone),
      homePhone: this.optional(form.homePhone),
      emergencyContactName: this.optional(form.emergencyContactName),
      emergencyContactPhone: this.optional(form.emergencyContactPhone),
      address: this.optional(form.address),
      municipality: this.optional(form.municipality),
      state: this.optional(form.state),
      postalCode: this.optional(form.postalCode),
      housingType: this.optional(form.housingType),
      residenceSinceDate: this.optional(form.residenceSinceDate),
    };
    const editing = this.editingEmployee();
    const request = editing
      ? this.api.updateEmployee(editing.idEmployee, input)
      : this.api.createEmployee({ ...input, codeEmployee: form.codeEmployee } satisfies CreateEmployee);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (employee) => {
        this.employeeEditorOpen.set(false);
        this.message.set(editing ? 'Empleado actualizado correctamente.' : 'Empleado creado correctamente.');
        this.selectedEmployee.set(employee);
        this.loadEmployees(editing ? this.result().page : 1);
        this.selectEmployee(employee);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected changeStatus(status: EmployeeStatus): void {
    const employee = this.selectedEmployee();
    if (!employee) {
      return;
    }

    this.api.changeStatus(employee.idEmployee, this.selectedOrganizationId(), status).subscribe({
      next: (updated) => {
        this.message.set('Estatus actualizado correctamente.');
        this.selectedEmployee.set(updated);
        this.loadEmployees();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateEmployee(employee: Employee): void {
    if (!window.confirm(`¿Deseas desactivar a ${employee.fullName}?`)) {
      return;
    }

    this.api.deactivateEmployee(this.selectedOrganizationId(), employee.idEmployee).subscribe({
      next: () => {
        this.message.set('Empleado desactivado correctamente.');
        this.selectedEmployee.set(null);
        this.documents.set([]);
        this.evaluations.set([]);
        this.loadEmployees(1);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected openCreateDocument(): void {
    if (!this.selectedEmployee()) {
      return;
    }

    this.editingDocument.set(null);
    this.documentForm.reset({
      documentType: 'EmploymentApplication',
      status: 'Pending',
      documentNumber: '',
      receivedDate: '',
      issuedDate: '',
      expiresDate: '',
      storageReference: '',
      notes: '',
    });
    this.documentEditorOpen.set(true);
  }

  protected openEditDocument(document: EmployeeDocument): void {
    this.editingDocument.set(document);
    this.documentForm.reset({
      documentType: document.documentType,
      status: document.status,
      documentNumber: document.documentNumber ?? '',
      receivedDate: this.dateOnly(document.receivedDate),
      issuedDate: this.dateOnly(document.issuedDate),
      expiresDate: this.dateOnly(document.expiresDate),
      storageReference: document.storageReference ?? '',
      notes: document.notes ?? '',
    });
    this.documentEditorOpen.set(true);
  }

  protected saveDocument(): void {
    const employee = this.selectedEmployee();
    if (!employee || this.documentForm.invalid) {
      this.documentForm.markAllAsTouched();
      return;
    }

    const form = this.documentForm.getRawValue();
    const input: EmployeeDocumentInput = {
      idOrganization: this.selectedOrganizationId(),
      idEmployee: employee.idEmployee,
      documentType: form.documentType,
      status: form.status,
      documentNumber: this.optional(form.documentNumber),
      receivedDate: this.optional(form.receivedDate),
      issuedDate: this.optional(form.issuedDate),
      expiresDate: this.optional(form.expiresDate),
      storageReference: this.optional(form.storageReference),
      notes: this.optional(form.notes),
    };
    const editing = this.editingDocument();
    const request = editing
      ? this.api.updateDocument(employee.idEmployee, editing.idEmployeeDocument, input)
      : this.api.createDocument(employee.idEmployee, input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.documentEditorOpen.set(false);
        this.message.set(editing ? 'Documento actualizado correctamente.' : 'Documento agregado correctamente.');
        this.selectEmployee(employee);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateDocument(document: EmployeeDocument): void {
    const employee = this.selectedEmployee();
    if (!employee || !window.confirm('¿Deseas desactivar este documento?')) {
      return;
    }

    this.api.deactivateDocument(this.selectedOrganizationId(), employee.idEmployee, document.idEmployeeDocument).subscribe({
      next: () => {
        this.message.set('Documento desactivado correctamente.');
        this.selectEmployee(employee);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected openCreateEvaluation(): void {
    if (!this.selectedEmployee()) {
      return;
    }

    this.editingEvaluation.set(null);
    this.evaluationForm.reset({
      evaluationType: 'Polygraph',
      result: 'Pending',
      evaluatedDate: this.today(),
      expiresDate: '',
      certificateNumber: '',
      storageReference: '',
      notes: '',
    });
    this.evaluationEditorOpen.set(true);
  }

  protected openEditEvaluation(evaluation: EmployeeEvaluation): void {
    this.editingEvaluation.set(evaluation);
    this.evaluationForm.reset({
      evaluationType: evaluation.evaluationType,
      result: evaluation.result,
      evaluatedDate: this.dateOnly(evaluation.evaluatedDate),
      expiresDate: this.dateOnly(evaluation.expiresDate),
      certificateNumber: evaluation.certificateNumber ?? '',
      storageReference: evaluation.storageReference ?? '',
      notes: evaluation.notes ?? '',
    });
    this.evaluationEditorOpen.set(true);
  }

  protected saveEvaluation(): void {
    const employee = this.selectedEmployee();
    if (!employee || this.evaluationForm.invalid) {
      this.evaluationForm.markAllAsTouched();
      return;
    }

    const form = this.evaluationForm.getRawValue();
    const input: EmployeeEvaluationInput = {
      idOrganization: this.selectedOrganizationId(),
      idEmployee: employee.idEmployee,
      evaluationType: form.evaluationType,
      result: form.result,
      evaluatedDate: form.evaluatedDate,
      expiresDate: this.optional(form.expiresDate),
      certificateNumber: this.optional(form.certificateNumber),
      storageReference: this.optional(form.storageReference),
      notes: this.optional(form.notes),
    };
    const editing = this.editingEvaluation();
    const request = editing
      ? this.api.updateEvaluation(employee.idEmployee, editing.idEmployeeEvaluation, input)
      : this.api.createEvaluation(employee.idEmployee, input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.evaluationEditorOpen.set(false);
        this.message.set(editing ? 'Evaluación actualizada correctamente.' : 'Evaluación agregada correctamente.');
        this.selectEmployee(employee);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateEvaluation(evaluation: EmployeeEvaluation): void {
    const employee = this.selectedEmployee();
    if (!employee || !window.confirm('¿Deseas desactivar esta evaluación?')) {
      return;
    }

    this.api
      .deactivateEvaluation(this.selectedOrganizationId(), employee.idEmployee, evaluation.idEmployeeEvaluation)
      .subscribe({
        next: () => {
          this.message.set('Evaluación desactivada correctamente.');
          this.selectEmployee(employee);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected closeEditors(): void {
    this.employeeEditorOpen.set(false);
    this.documentEditorOpen.set(false);
    this.evaluationEditorOpen.set(false);
  }

  protected statusLabel(status: EmployeeStatus): string {
    return this.employeeStatuses.find((item) => item.value === status)?.label ?? status;
  }

  protected documentTypeLabel(type: EmployeeDocumentType): string {
    return this.documentTypes.find((item) => item.value === type)?.label ?? type;
  }

  protected documentStatusLabel(status: EmployeeDocumentStatus): string {
    return this.documentStatuses.find((item) => item.value === status)?.label ?? status;
  }

  protected evaluationTypeLabel(type: EmployeeEvaluationType): string {
    return this.evaluationTypes.find((item) => item.value === type)?.label ?? type;
  }

  protected evaluationResultLabel(result: EmployeeEvaluationResult): string {
    return this.evaluationResults.find((item) => item.value === result)?.label ?? result;
  }

  private emptyEmployeeForm() {
    return {
      codeEmployee: '',
      fullName: '',
      jobTitle: '',
      hireDate: this.today(),
      birthDate: '',
      birthPlace: '',
      sex: '',
      maritalStatus: '',
      rfc: '',
      curp: '',
      socialSecurityNumber: '',
      voterIdNumber: '',
      driverLicenseNumber: '',
      militaryServiceCardNumber: '',
      email: '',
      mobilePhone: '',
      homePhone: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      address: '',
      municipality: '',
      state: '',
      postalCode: '',
      housingType: '',
      residenceSinceDate: '',
    };
  }

  private optional(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private dateOnly(value: string | null): string {
    return value?.slice(0, 10) ?? '';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private setError(error: HttpErrorResponse): void {
    const detail =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)['detail']
        : null;
    this.error.set(typeof detail === 'string' ? detail : 'No fue posible completar la operación.');
  }
}
