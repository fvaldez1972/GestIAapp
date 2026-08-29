import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
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
  private readonly auth = inject(AuthService);
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
  protected readonly activeTab = signal<CatalogTab>('general');
  protected readonly selectedCatalogType = signal<BusinessCatalogItemType>('Skill');
  protected readonly catalogDrawerOpen = signal(false);
  protected readonly requirementDrawerOpen = signal(false);
  protected readonly requirementClientFilter = signal('');
  protected readonly requirementServiceFilter = signal('');
  protected readonly requirementPositionFilter = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly eligibilityResult = signal<EligibilityCheck | null>(null);

  protected readonly canWrite = computed(() => this.auth.hasPermission('CATALOGS.WRITE'));
  protected readonly selectedCatalogItem = computed(
    () => this.items().find((item) => item.idCatalogItem === this.selectedCatalogItemId()) ?? null,
  );
  protected readonly selectedRequirement = computed(
    () => this.requirements().find((item) => item.idEligibilityRequirement === this.selectedRequirementId()) ?? null,
  );
  protected readonly activeSkills = computed(() => this.items().filter((item) => item.type === 'Skill' && item.active));
  protected readonly activeCatalogCards = computed(() =>
    this.catalogCategories.filter((category) => category.tab === this.activeTab()),
  );
  protected readonly selectedCategory = computed(
    () => this.catalogCategories.find((category) => category.type === this.selectedCatalogType()) ?? this.catalogCategories[0],
  );
  protected readonly selectedCatalogItems = computed(() =>
    this.items().filter((item) => item.type === this.selectedCatalogType()),
  );
  protected readonly activeCatalogItems = computed(() => this.items().filter((item) => item.active).length);
  protected readonly activeRequirements = computed(() => this.requirements().filter((requirement) => requirement.active).length);
  protected readonly blockingRequirements = computed(
    () => this.requirements().filter((requirement) => requirement.active && requirement.isBlocking).length,
  );
  protected readonly filteredRequirements = computed(() =>
    this.requirements().filter((requirement) => {
      const clientFilter = this.requirementClientFilter();
      const serviceFilter = this.requirementServiceFilter();
      const positionFilter = this.requirementPositionFilter();

      return (
        (!clientFilter || requirement.idClient === clientFilter) &&
        (!serviceFilter || requirement.idService === serviceFilter) &&
        (!positionFilter || requirement.idPosition === positionFilter)
      );
    }),
  );

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

  protected readonly tabs: readonly { value: CatalogTab; label: string; help: string }[] = [
    { value: 'general', label: 'Generales', help: 'Habilidades, puestos y zonas base.' },
    { value: 'operational', label: 'Operativos', help: 'Motivos usados en operación diaria.' },
    { value: 'eligibility', label: 'Elegibilidad', help: 'Reglas para decidir si alguien puede asignarse.' },
  ];

  protected readonly catalogCategories: readonly CatalogCategory[] = [
    {
      type: 'Skill',
      tab: 'general',
      title: 'Habilidades',
      description: 'Competencias que puede tener el personal.',
      icon: '✦',
    },
    {
      type: 'JobPosition',
      tab: 'general',
      title: 'Puestos / posiciones',
      description: 'Roles operativos disponibles para servicios.',
      icon: '▦',
    },
    {
      type: 'Zone',
      tab: 'general',
      title: 'Zonas',
      description: 'Áreas geográficas o zonas de operación.',
      icon: '⌖',
    },
    {
      type: 'IncidentReason',
      tab: 'operational',
      title: 'Tipos de incidencia',
      description: 'Motivos para clasificar excepciones operativas.',
      icon: '△',
    },
    {
      type: 'CoverageReason',
      tab: 'operational',
      title: 'Motivos de cobertura',
      description: 'Razones para cubrir o sustituir turnos.',
      icon: '◉',
    },
    {
      type: 'CancellationReason',
      tab: 'operational',
      title: 'Motivos de cancelación',
      description: 'Causas controladas para bajas o cancelaciones.',
      icon: '×',
    },
    {
      type: 'DocumentRequirement',
      tab: 'eligibility',
      title: 'Tipos de documento',
      description: 'Documentos requeridos para validar expediente.',
      icon: '□',
    },
    {
      type: 'EvaluationRequirement',
      tab: 'eligibility',
      title: 'Evaluaciones',
      description: 'Evaluaciones, exámenes o revisiones necesarias.',
      icon: '✓',
    },
    {
      type: 'ClientRestriction',
      tab: 'eligibility',
      title: 'Restricciones por cliente',
      description: 'Reglas particulares para clientes específicos.',
      icon: '!',
    },
    {
      type: 'ServiceRestriction',
      tab: 'eligibility',
      title: 'Restricciones por servicio',
      description: 'Condiciones aplicables a servicios concretos.',
      icon: '⛨',
    },
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
    this.requirementClientFilter.set('');
    this.requirementServiceFilter.set('');
    this.requirementPositionFilter.set('');
    this.loadData();
  }

  protected selectTab(tab: CatalogTab): void {
    this.activeTab.set(tab);
    const firstCategory = this.catalogCategories.find((category) => category.tab === tab);

    if (firstCategory) {
      this.selectedCatalogType.set(firstCategory.type);
      this.catalogForm.patchValue({ type: firstCategory.type });
    }
  }

  protected selectCatalogCategory(type: BusinessCatalogItemType): void {
    this.selectedCatalogType.set(type);
    this.selectedCatalogItemId.set('');
    this.catalogForm.patchValue({ type });
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

  protected selectRequirementClient(idClient: string): void {
    this.requirementForm.patchValue({ idClient, idService: '', idPosition: '' });
    this.loadServicesForClient(idClient);
  }

  protected selectRequirementService(idService: string): void {
    const clientId = this.requirementForm.getRawValue().idClient;
    this.requirementForm.patchValue({ idService, idPosition: '' });
    this.loadPositionsForService(clientId, idService);
  }

  protected selectEligibilityClient(idClient: string): void {
    this.eligibilityForm.patchValue({ idClient, idService: '', idPosition: '' });
    this.loadServicesForClient(idClient);
  }

  protected selectEligibilityService(idService: string): void {
    const clientId = this.eligibilityForm.getRawValue().idClient;
    this.eligibilityForm.patchValue({ idService, idPosition: '' });
    this.loadPositionsForService(clientId, idService);
  }

  protected selectRequirementFilterClient(idClient: string): void {
    this.requirementClientFilter.set(idClient);
    this.requirementServiceFilter.set('');
    this.requirementPositionFilter.set('');
    this.loadServicesForClient(idClient);
  }

  protected selectRequirementFilterService(idService: string): void {
    this.requirementServiceFilter.set(idService);
    this.requirementPositionFilter.set('');
    this.loadPositionsForService(this.requirementClientFilter(), idService);
  }

  protected selectRequirementFilterPosition(idPosition: string): void {
    this.requirementPositionFilter.set(idPosition);
  }

  protected selectCatalogItem(item: CatalogItem): void {
    this.selectedCatalogItemId.set(item.idCatalogItem);
    this.selectedCatalogType.set(item.type);
    this.catalogForm.reset({
      type: item.type,
      code: item.code,
      name: item.name,
      description: item.description ?? '',
    });
    this.catalogDrawerOpen.set(true);
  }

  protected openNewCatalogItem(): void {
    this.selectedCatalogItemId.set('');
    this.catalogForm.reset({ type: this.selectedCatalogType(), code: '', name: '', description: '' });
    this.catalogDrawerOpen.set(true);
  }

  protected closeCatalogDrawer(): void {
    this.catalogDrawerOpen.set(false);
  }

  protected saveCatalogItem(): void {
    if (!this.selectedOrganizationId() || this.catalogForm.invalid || !this.canWrite()) {
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
        this.catalogDrawerOpen.set(false);
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
      complete: () => this.saving.set(false),
    });
  }

  protected deactivateCatalogItem(item: CatalogItem): void {
    if (!this.canWrite()) {
      return;
    }

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
    if (!this.selectedOrganizationId() || this.requirementForm.invalid || !this.canWrite()) {
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
        this.requirementDrawerOpen.set(false);
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
    this.requirementDrawerOpen.set(true);
  }

  protected openNewRequirement(): void {
    this.resetRequirementForm();
    this.requirementDrawerOpen.set(true);
  }

  protected closeRequirementDrawer(): void {
    this.requirementDrawerOpen.set(false);
  }

  protected deactivateRequirement(requirement: EligibilityRequirement): void {
    if (!this.canWrite()) {
      return;
    }

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
    this.catalogForm.reset({ type: this.selectedCatalogType(), code: '', name: '', description: '' });
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

  protected countCatalogItems(type: BusinessCatalogItemType): number {
    return this.items().filter((item) => item.type === type && item.active).length;
  }

  protected tabCount(tab: CatalogTab): number {
    if (tab === 'eligibility') {
      return this.requirements().length;
    }

    return this.catalogCategories
      .filter((category) => category.tab === tab)
      .reduce((total, category) => total + this.countCatalogItems(category.type), 0);
  }

  protected activeLabel(active: boolean): string {
    return active ? 'Activo' : 'Inactivo';
  }

  protected blockingLabel(requirement: EligibilityRequirement): string {
    return requirement.isBlocking ? 'Bloqueante' : 'Informativa';
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

  private loadServicesForClient(idClient: string): void {
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

  private loadPositionsForService(idClient: string, idService: string): void {
    this.positions.set([]);

    if (!idClient || !idService) {
      return;
    }

    this.clientApi.listPositions(this.selectedOrganizationId(), idClient, idService).subscribe({
      next: (positions) => this.positions.set(positions),
      error: (error: HttpErrorResponse) => this.setError(error),
    });
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

type CatalogTab = 'general' | 'operational' | 'eligibility';

type CatalogCategory = {
  readonly type: BusinessCatalogItemType;
  readonly tab: CatalogTab;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
};
