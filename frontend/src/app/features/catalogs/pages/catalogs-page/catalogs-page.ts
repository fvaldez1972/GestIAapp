import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, Organization, PagedResult, ServicePosition } from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { CatalogApiService } from '../../data-access/catalog-api.service';
import {
  BusinessCatalogItemType,
  CatalogItem,
  EligibilityCheck,
  EligibilityRequirement,
  EligibilityRequirementTargetType,
  EligibilityRequirementType,
} from '../../data-access/catalog.models';

@Component({
  selector: 'app-catalogs-page',
  imports: [ReactiveFormsModule],
  templateUrl: './catalogs-page.html',
  styleUrl: './catalogs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogsPage implements OnInit {
  private readonly api = inject(CatalogApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly items = signal<readonly CatalogItem[]>([]);
  protected readonly requirements = signal<readonly EligibilityRequirement[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedCatalogItemId = signal('');
  protected readonly selectedRequirementId = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly eligibilityResult = signal<EligibilityCheck | null>(null);

  protected readonly selectedCatalogItem = computed(
    () => this.items().find((item) => item.idCatalogItem === this.selectedCatalogItemId()) ?? null,
  );
  protected readonly selectedRequirement = computed(
    () => this.requirements().find((item) => item.idEligibilityRequirement === this.selectedRequirementId()) ?? null,
  );
  protected readonly activeSkills = computed(() => this.items().filter((item) => item.type === 'Skill' && item.active));

  protected readonly catalogTypes: readonly { value: BusinessCatalogItemType; label: string }[] = [
    { value: 'Skill', label: 'Habilidad' },
    { value: 'JobPosition', label: 'Puesto operativo' },
    { value: 'DocumentRequirement', label: 'Documento requerido' },
    { value: 'EvaluationRequirement', label: 'Evaluación requerida' },
    { value: 'ClientRestriction', label: 'Restricción por cliente' },
    { value: 'ServiceRestriction', label: 'Restricción por servicio' },
    { value: 'Zone', label: 'Zona' },
    { value: 'IncidentReason', label: 'Motivo de incidencia' },
    { value: 'CoverageReason', label: 'Motivo de cobertura' },
    { value: 'CancellationReason', label: 'Motivo de baja/cancelación' },
  ];

  protected readonly targetTypes: readonly { value: EligibilityRequirementTargetType; label: string }[] = [
    { value: 'Organization', label: 'Organización completa' },
    { value: 'Client', label: 'Cliente' },
    { value: 'Service', label: 'Servicio' },
    { value: 'Position', label: 'Posición' },
  ];

  protected readonly requirementTypes: readonly { value: EligibilityRequirementType; label: string }[] = [
    { value: 'Skill', label: 'Habilidad' },
    { value: 'Document', label: 'Documento' },
    { value: 'Evaluation', label: 'Evaluación' },
    { value: 'Restriction', label: 'Restricción bloqueante' },
  ];

  protected readonly documentCodes = [
    'EmploymentApplication',
    'BirthCertificate',
    'VoterId',
    'Curp',
    'SocialSecurityNumber',
    'Rfc',
    'TaxStatusCertificate',
    'ProofOfAddress',
    'ProofOfStudies',
    'CriminalRecordCertificate',
    'Other',
  ];

  protected readonly evaluationCodes = ['Polygraph', 'SocioeconomicStudy', 'CriminalRecordReview', 'DrugTest', 'Other'];

  protected readonly catalogForm = this.formBuilder.nonNullable.group({
    type: ['Skill' as BusinessCatalogItemType, [Validators.required]],
    code: ['', [Validators.required, Validators.maxLength(80)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(1000)]],
  });

  protected readonly requirementForm = this.formBuilder.nonNullable.group({
    targetType: ['Organization' as EligibilityRequirementTargetType, [Validators.required]],
    idClient: [''],
    idService: [''],
    idPosition: [''],
    requirementType: ['Skill' as EligibilityRequirementType, [Validators.required]],
    requiredCode: ['', [Validators.required, Validators.maxLength(80)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(1000)]],
    isBlocking: [true],
  });

  protected readonly eligibilityForm = this.formBuilder.nonNullable.group({
    idEmployee: ['', [Validators.required]],
    idClient: [''],
    idService: [''],
    idPosition: [''],
    referenceDate: [this.today(), [Validators.required]],
  });

  ngOnInit(): void {
    this.loadOrganizations();
  }

  protected loadOrganizations(): void {
    this.loading.set(true);
    this.clientApi.listOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.selectedOrganizationId.set(this.selectedOrganizationId() || organizations[0]?.idOrganization || '');
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected selectOrganization(idOrganization: string): void {
    this.selectedOrganizationId.set(idOrganization);
    this.clients.set([]);
    this.services.set([]);
    this.positions.set([]);
    this.employees.set([]);
    this.eligibilityResult.set(null);
    this.loadData();
  }

  protected loadData(): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    forkJoin({
      items: this.api.listItems(organizationId),
      requirements: this.api.listEligibilityRequirements(organizationId),
      clients: this.clientApi.listClients(organizationId, '', 1, 100),
      employees: this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 100),
    }).subscribe({
      next: ({ items, requirements, clients, employees }) => {
        this.items.set(items);
        this.requirements.set(requirements);
        this.clients.set((clients as PagedResult<Client>).items);
        this.employees.set(employees.items);
        this.syncDefaults();
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected selectClient(idClient: string): void {
    this.requirementForm.patchValue({ idClient, idService: '', idPosition: '' });
    this.eligibilityForm.patchValue({ idClient, idService: '', idPosition: '' });
    this.services.set([]);
    this.positions.set([]);

    if (!idClient) {
      return;
    }

    this.clientApi.listServices(this.selectedOrganizationId(), idClient).subscribe({
      next: (services) => this.services.set(services),
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected selectService(idService: string): void {
    const clientId = this.requirementForm.getRawValue().idClient || this.eligibilityForm.getRawValue().idClient;
    this.requirementForm.patchValue({ idService, idPosition: '' });
    this.eligibilityForm.patchValue({ idService, idPosition: '' });
    this.positions.set([]);

    if (!clientId || !idService) {
      return;
    }

    this.clientApi.listPositions(this.selectedOrganizationId(), clientId, idService).subscribe({
      next: (positions) => this.positions.set(positions),
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected selectCatalogItem(item: CatalogItem): void {
    this.selectedCatalogItemId.set(item.idCatalogItem);
    this.catalogForm.reset({
      type: item.type,
      code: item.code,
      name: item.name,
      description: item.description ?? '',
    });
  }

  protected saveCatalogItem(): void {
    if (!this.selectedOrganizationId() || this.catalogForm.invalid) {
      this.catalogForm.markAllAsTouched();
      return;
    }

    const form = this.catalogForm.getRawValue();
    const request = {
      idOrganization: this.selectedOrganizationId(),
      type: form.type,
      code: form.code.trim(),
      name: form.name.trim(),
      description: this.optional(form.description),
    };
    const selected = this.selectedCatalogItem();
    this.saving.set(true);
    const call = selected
      ? this.api.updateItem(selected.idCatalogItem, request)
      : this.api.createItem(request);

    call.subscribe({
      next: () => {
        this.message.set(selected ? 'Catálogo actualizado.' : 'Catálogo creado.');
        this.resetCatalogForm();
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
      complete: () => this.saving.set(false),
    });
  }

  protected deactivateCatalogItem(item: CatalogItem): void {
    if (!window.confirm(`¿Desactivar el catálogo "${item.name}"?`)) {
      return;
    }

    this.saving.set(true);
    this.api.deactivateItem(this.selectedOrganizationId(), item.idCatalogItem).subscribe({
      next: () => {
        this.message.set('Catálogo desactivado.');
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
      complete: () => this.saving.set(false),
    });
  }

  protected saveRequirement(): void {
    if (!this.selectedOrganizationId() || this.requirementForm.invalid) {
      this.requirementForm.markAllAsTouched();
      return;
    }

    const form = this.requirementForm.getRawValue();
    const targetIds = this.targetIds(form.targetType, form.idClient, form.idService, form.idPosition);
    const request = {
      idOrganization: this.selectedOrganizationId(),
      targetType: form.targetType,
      ...targetIds,
      requirementType: form.requirementType,
      requiredCode: form.requiredCode.trim(),
      name: form.name.trim(),
      description: this.optional(form.description),
      isBlocking: form.isBlocking,
    };
    const selected = this.selectedRequirement();
    this.saving.set(true);
    const call = selected
      ? this.api.updateEligibilityRequirement(selected.idEligibilityRequirement, request)
      : this.api.createEligibilityRequirement(request);

    call.subscribe({
      next: () => {
        this.message.set(selected ? 'Regla actualizada.' : 'Regla creada.');
        this.resetRequirementForm();
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
      complete: () => this.saving.set(false),
    });
  }

  protected selectRequirement(requirement: EligibilityRequirement): void {
    this.selectedRequirementId.set(requirement.idEligibilityRequirement);
    this.requirementForm.reset({
      targetType: requirement.targetType,
      idClient: requirement.idClient ?? '',
      idService: requirement.idService ?? '',
      idPosition: requirement.idPosition ?? '',
      requirementType: requirement.requirementType,
      requiredCode: requirement.requiredCode,
      name: requirement.name,
      description: requirement.description ?? '',
      isBlocking: requirement.isBlocking,
    });
  }

  protected deactivateRequirement(requirement: EligibilityRequirement): void {
    if (!window.confirm(`¿Desactivar la regla "${requirement.name}"?`)) {
      return;
    }

    this.saving.set(true);
    this.api.deactivateEligibilityRequirement(this.selectedOrganizationId(), requirement.idEligibilityRequirement).subscribe({
      next: () => {
        this.message.set('Regla desactivada.');
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
      complete: () => this.saving.set(false),
    });
  }

  protected checkEligibility(): void {
    if (!this.selectedOrganizationId() || this.eligibilityForm.invalid) {
      this.eligibilityForm.markAllAsTouched();
      return;
    }

    const form = this.eligibilityForm.getRawValue();
    this.loading.set(true);
    this.api
      .checkEligibility(
        this.selectedOrganizationId(),
        form.idEmployee,
        form.referenceDate,
        this.optional(form.idClient) ?? undefined,
        this.optional(form.idService) ?? undefined,
        this.optional(form.idPosition) ?? undefined,
      )
      .subscribe({
        next: (result) => {
          this.eligibilityResult.set(result);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected codeOptions() {
    const type = this.requirementForm.getRawValue().requirementType;

    if (type === 'Skill') {
      return this.activeSkills().map((skill) => skill.code);
    }

    if (type === 'Document') {
      return this.documentCodes;
    }

    if (type === 'Evaluation') {
      return this.evaluationCodes;
    }

    return this.items().filter((item) => item.type.includes('Restriction')).map((item) => item.code);
  }

  protected resetCatalogForm(): void {
    this.selectedCatalogItemId.set('');
    this.catalogForm.reset({ type: 'Skill', code: '', name: '', description: '' });
  }

  protected resetRequirementForm(): void {
    this.selectedRequirementId.set('');
    this.requirementForm.reset({
      targetType: 'Organization',
      idClient: '',
      idService: '',
      idPosition: '',
      requirementType: 'Skill',
      requiredCode: '',
      name: '',
      description: '',
      isBlocking: true,
    });
  }

  protected typeLabel(type: BusinessCatalogItemType): string {
    return this.catalogTypes.find((item) => item.value === type)?.label ?? 'Catálogo';
  }

  protected requirementTypeLabel(type: EligibilityRequirementType): string {
    return this.requirementTypes.find((item) => item.value === type)?.label ?? 'Regla';
  }

  protected targetTypeLabel(type: EligibilityRequirementTargetType): string {
    return this.targetTypes.find((item) => item.value === type)?.label ?? 'Alcance general';
  }

  protected requirementScopeLabel(requirement: {
    readonly clientName: string | null;
    readonly serviceName: string | null;
    readonly positionName: string | null;
    readonly targetType: EligibilityRequirementTargetType;
  }): string {
    return (
      requirement.positionName ||
      requirement.serviceName ||
      requirement.clientName ||
      this.targetTypeLabel(requirement.targetType)
    );
  }

  private syncDefaults(): void {
    const employeeId = this.employees()[0]?.idEmployee ?? '';
    if (employeeId && !this.eligibilityForm.getRawValue().idEmployee) {
      this.eligibilityForm.patchValue({ idEmployee: employeeId });
    }
  }

  private targetIds(
    targetType: EligibilityRequirementTargetType,
    idClient: string,
    idService: string,
    idPosition: string,
  ) {
    return {
      idClient: targetType === 'Client' ? this.optional(idClient) : null,
      idService: targetType === 'Service' ? this.optional(idService) : null,
      idPosition: targetType === 'Position' ? this.optional(idPosition) : null,
    };
  }

  private optional(value: string): string | null {
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private setError(error: HttpErrorResponse): void {
    this.loading.set(false);
    this.saving.set(false);
    const detail =
      typeof error.error === 'object' && error.error !== null
        ? ((error.error as Record<string, unknown>)['detail'] ?? (error.error as Record<string, unknown>)['message'])
        : null;
    this.error.set(typeof detail === 'string' ? detail : 'No fue posible completar la operación.');
  }
}
