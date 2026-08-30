import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, Organization, PagedResult, ServicePosition } from '../../../clients/data-access/client.models';
import { RequestApiService } from '../../../requests/data-access/request-api.service';
import { OperationalRequest } from '../../../requests/data-access/request.models';
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
  private readonly requestApi = inject(RequestApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly requests = signal<readonly OperationalRequest[]>([]);
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
  protected readonly catalogFilterRevision = signal(0);
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
  protected readonly selectedCatalogItems = computed(() => {
    this.catalogFilterRevision();
    const filters = this.catalogFilterForm.getRawValue();
    const search = filters.search.trim().toLowerCase();

    return this.items().filter((item) => {
      const modules = this.modulesForCatalogItem(item);
      const group = this.catalogGroupLabel(item.type);
      const searchableText = [item.code, item.name, item.description ?? '', this.typeLabel(item.type), group, modules.join(' ')]
        .join(' ')
        .toLowerCase();

      return (
        item.type === this.selectedCatalogType() &&
        (!search || searchableText.includes(search)) &&
        (!filters.group || group === filters.group) &&
        (!filters.state || (filters.state === 'active' ? item.active : !item.active)) &&
        (!filters.module || modules.includes(filters.module))
      );
    });
  });
  protected readonly activeCatalogItems = computed(() => this.items().filter((item) => item.active).length);
  protected readonly activeRequirements = computed(() => this.requirements().filter((requirement) => requirement.active).length);
  protected readonly valuesPendingReview = computed(() =>
    this.items().filter((item) => !item.active).length + this.minimumChecklist().filter((item) => item.status !== 'complete').length,
  );
  protected readonly linkedModules = computed(() => {
    const modules = new Set<string>();
    for (const item of this.items()) {
      this.modulesForCatalogItem(item).forEach((module) => modules.add(module));
    }

    return modules.size;
  });
  protected readonly configuredRules = computed(() => this.requirements().filter((requirement) => requirement.active).length);
  protected readonly minimumChecklist = computed<readonly MinimumChecklistItem[]>(() => {
    const positions = this.countCatalogItems('JobPosition');
    const skills = this.countCatalogItems('Skill');
    const reasons = this.countCatalogItems('IncidentReason') + this.countCatalogItems('CoverageReason') + this.countCatalogItems('CancellationReason');
    const requestTypesUsed = this.requests().length > 0;
    const rules = this.activeRequirements();

    return [
      {
        key: 'positions',
        section: 'Puestos',
        status: positions > 0 ? 'complete' : 'missing',
        description: positions > 0 ? `${positions} puesto(s) configurado(s).` : 'Define puestos antes de planear o asignar personal.',
        action: 'Completar puestos',
      },
      {
        key: 'skills',
        section: 'Habilidades',
        status: skills > 0 ? 'complete' : 'incomplete',
        description: skills > 0 ? `${skills} habilidad(es) activas.` : 'Debes definir habilidades requeridas para evaluar elegibilidad.',
        action: 'Completar habilidades',
      },
      {
        key: 'reasons',
        section: 'Motivos',
        status: reasons > 0 ? 'complete' : 'incomplete',
        description: reasons > 0 ? `${reasons} motivo(s) operativos disponibles.` : 'Faltan motivos para incidencias, coberturas o cancelaciones.',
        action: 'Completar motivos',
      },
      {
        key: 'requestTypes',
        section: 'Tipos de solicitud',
        status: requestTypesUsed ? 'complete' : 'incomplete',
        description: requestTypesUsed ? 'Solicitudes operativas ya usan tipos de negocio.' : 'Registra o conserva tipos de solicitud operativos.',
        action: 'Completar tipos',
      },
      {
        key: 'rules',
        section: 'Reglas de elegibilidad',
        status: rules > 0 ? 'complete' : 'missing',
        description: rules > 0 ? `${rules} regla(s) activa(s).` : 'Sin reglas, la elegibilidad no puede concluirse como positiva.',
        action: 'Configurar reglas',
      },
    ];
  });
  protected readonly completedChecklistCount = computed(
    () => this.minimumChecklist().filter((item) => item.status === 'complete').length,
  );
  protected readonly minimumConfigIncomplete = computed(() => this.completedChecklistCount() < this.minimumChecklist().length);
  protected readonly blockingRequirements = computed(
    () => this.requirements().filter((requirement) => requirement.active && requirement.isBlocking).length,
  );
  protected readonly catalogModules = computed(() =>
    Array.from(new Set(this.items().flatMap((item) => this.modulesForCatalogItem(item)))).sort(),
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
    group: ['General', [Validators.required]],
    status: ['active' as 'active' | 'inactive', [Validators.required]],
    order: [1, [Validators.required, Validators.min(1)]],
    synonyms: [''],
    description: ['', [Validators.maxLength(1000)]],
  });

  protected readonly catalogFilterForm = this.formBuilder.nonNullable.group({
    search: [''],
    group: [''],
    state: [''],
    module: [''],
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
    this.requests.set([]);
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
      requests: this.requestApi.listRequests(organizationId, '', '', '', 1, 100),
    }).subscribe({
      next: ({ items, requirements, clients, employees, requests }) => {
        const clientItems = (clients as PagedResult<Client>).items;
        this.items.set(items);
        this.requirements.set(requirements);
        this.clients.set(clientItems);
        this.employees.set(employees.items);
        this.requests.set(requests.items);
        this.loadOperationalContext(clientItems);
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
      group: this.catalogGroupLabel(item.type),
      status: item.active ? 'active' : 'inactive',
      order: this.catalogOrder(item),
      synonyms: '',
      description: item.description ?? '',
    });
    this.catalogDrawerOpen.set(true);
  }

  protected openNewCatalogItem(): void {
    this.selectedCatalogItemId.set('');
    this.catalogForm.reset({
      type: this.selectedCatalogType(),
      code: '',
      name: '',
      group: this.catalogGroupLabel(this.selectedCatalogType()),
      status: 'active',
      order: this.selectedCatalogItems().length + 1,
      synonyms: '',
      description: '',
    });
    this.catalogDrawerOpen.set(true);
  }

  protected closeCatalogDrawer(): void {
    this.catalogDrawerOpen.set(false);
  }

  protected saveCatalogItem(): void {
    if (!this.selectedOrganizationId() || this.catalogForm.invalid || this.catalogCodeExists() || this.catalogNameExists() || !this.canWrite()) {
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

    const modules = this.modulesForCatalogItem(item);
    const usageWarning = modules.length
      ? `\n\nEste valor se usa en: ${modules.join(', ')}. Revisa dependencias antes de continuar.`
      : '';

    if (!window.confirm(`¿Desactivar el catálogo "${item.name}"?${usageWarning}`)) {
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
    this.catalogForm.reset({
      type: this.selectedCatalogType(),
      code: '',
      name: '',
      group: this.catalogGroupLabel(this.selectedCatalogType()),
      status: 'active',
      order: this.selectedCatalogItems().length + 1,
      synonyms: '',
      description: '',
    });
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

  protected catalogGroupLabel(type: BusinessCatalogItemType): string {
    const category = this.catalogCategories.find((item) => item.type === type);

    if (category?.tab === 'operational') {
      return 'Operativo';
    }

    if (category?.tab === 'eligibility') {
      return 'Elegibilidad';
    }

    return 'General';
  }

  protected catalogOrder(item: CatalogItem): number {
    const sameTypeItems = this.items().filter((candidate) => candidate.type === item.type);
    return Math.max(1, sameTypeItems.findIndex((candidate) => candidate.idCatalogItem === item.idCatalogItem) + 1);
  }

  protected modulesForCatalogItem(item: CatalogItem): readonly string[] {
    const modules = new Set<string>();
    const normalizedCode = item.code.trim().toLowerCase();
    const normalizedName = item.name.trim().toLowerCase();

    if (item.type === 'JobPosition') {
      if (this.employees().some((employee) => this.matchesCatalogValue(employee.jobTitle, normalizedCode, normalizedName))) {
        modules.add('Personal');
      }

      if (this.positions().some((position) => this.matchesCatalogValue(position.name, normalizedCode, normalizedName) || this.matchesCatalogValue(position.codePosition, normalizedCode, normalizedName))) {
        modules.add('Planeación');
        modules.add('Operación');
      }
    }

    if (item.type === 'Skill') {
      if (this.requirements().some((requirement) => requirement.requirementType === 'Skill' && this.matchesCatalogValue(requirement.requiredCode, normalizedCode, normalizedName))) {
        modules.add('Personal');
        modules.add('Planeación');
      }
    }

    if (item.type === 'DocumentRequirement') {
      if (this.requirements().some((requirement) => requirement.requirementType === 'Document' && this.matchesCatalogValue(requirement.requiredCode, normalizedCode, normalizedName))) {
        modules.add('Documentos');
        modules.add('Personal');
      }
    }

    if (item.type === 'EvaluationRequirement') {
      if (this.requirements().some((requirement) => requirement.requirementType === 'Evaluation' && this.matchesCatalogValue(requirement.requiredCode, normalizedCode, normalizedName))) {
        modules.add('Personal');
      }
    }

    if (item.type === 'ClientRestriction') {
      if (this.clients().length || this.requirements().some((requirement) => requirement.requirementType === 'Restriction')) {
        modules.add('Clientes');
      }
    }

    if (item.type === 'ServiceRestriction') {
      if (this.services().length || this.requirements().some((requirement) => requirement.requirementType === 'Restriction')) {
        modules.add('Solicitudes');
        modules.add('Operación');
      }
    }

    if (item.type === 'IncidentReason') {
      modules.add('Operación');
    }

    if (item.type === 'CoverageReason') {
      modules.add('Operación');
      modules.add('Planeación');
    }

    if (item.type === 'CancellationReason') {
      modules.add('Solicitudes');
      modules.add('Clientes');
    }

    if (item.type === 'Zone' && (this.clients().length || this.services().length)) {
      modules.add('Clientes');
      modules.add('Operación');
    }

    return Array.from(modules).sort();
  }

  protected usedInLabel(item: CatalogItem): string {
    const modules = this.modulesForCatalogItem(item);
    return modules.length ? modules.join(', ') : 'Sin uso registrado';
  }

  protected lastEditedLabel(item: CatalogItem): string {
    return item.active ? 'Actualizado recientemente' : 'Pendiente de revisión';
  }

  protected catalogFieldInvalid(field: 'code' | 'name' | 'group' | 'status'): boolean {
    const control = this.catalogForm.controls[field];
    return Boolean(control.invalid && (control.touched || control.dirty));
  }

  protected catalogCodeExists(): boolean {
    const form = this.catalogForm.getRawValue();
    const code = form.code.trim().toLowerCase();

    if (!code) {
      return false;
    }

    return this.items().some(
      (item) =>
        item.idCatalogItem !== this.selectedCatalogItemId() &&
        item.type === form.type &&
        item.code.trim().toLowerCase() === code,
    );
  }

  protected catalogNameExists(): boolean {
    const form = this.catalogForm.getRawValue();
    const name = form.name.trim().toLowerCase();

    if (!name) {
      return false;
    }

    return this.items().some(
      (item) =>
        item.idCatalogItem !== this.selectedCatalogItemId() &&
        item.type === form.type &&
        item.name.trim().toLowerCase() === name,
    );
  }

  protected clearCatalogFilters(): void {
    this.catalogFilterForm.reset({ search: '', group: '', state: '', module: '' });
    this.refreshCatalogFilters();
  }

  protected refreshCatalogFilters(): void {
    this.catalogFilterRevision.update((value) => value + 1);
  }

  protected checklistTone(status: MinimumChecklistStatus): 'success' | 'warning' | 'muted' {
    if (status === 'complete') {
      return 'success';
    }

    return status === 'incomplete' ? 'warning' : 'muted';
  }

  protected checklistStatusLabel(status: MinimumChecklistStatus): string {
    if (status === 'complete') {
      return 'Completo';
    }

    return status === 'incomplete' ? 'Incompleto' : 'Sin configurar';
  }

  protected eligibilityState(result: EligibilityCheck | null): EligibilityUiState {
    if (!result || this.activeRequirements() === 0 || result.reasons.length === 0) {
      return 'insufficient';
    }

    return result.isEligible ? 'eligible' : 'notEligible';
  }

  protected eligibilityLabel(result: EligibilityCheck | null): string {
    const state = this.eligibilityState(result);

    if (state === 'eligible') {
      return 'Elegible';
    }

    if (state === 'notEligible') {
      return 'No elegible';
    }

    return 'Sin reglas suficientes';
  }

  protected missingEligibilityConfigurations(): readonly string[] {
    const missing = this.minimumChecklist()
      .filter((item) => item.status !== 'complete')
      .map((item) => item.description);

    return missing.length
      ? missing
      : ['No hay reglas mínimas para concluir elegibilidad.'];
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

  private loadOperationalContext(clients: readonly Client[]): void {
    this.services.set([]);
    this.positions.set([]);

    if (!clients.length) {
      return;
    }

    forkJoin(clients.map((client) => this.clientApi.listServices(this.selectedOrganizationId(), client.idClient))).subscribe({
      next: (serviceGroups) => {
        const services = serviceGroups.flat();
        this.services.set(services);

        if (!services.length) {
          return;
        }

        forkJoin(
          services.map((service) => this.clientApi.listPositions(this.selectedOrganizationId(), service.idClient, service.idService)),
        ).subscribe({
          next: (positionGroups) => this.positions.set(positionGroups.flat()),
          error: () => this.positions.set([]),
        });
      },
      error: () => this.services.set([]),
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
      idClient: targetType === 'Client' || targetType === 'Service' || targetType === 'Position' ? this.optional(idClient) : null,
      idService: targetType === 'Service' || targetType === 'Position' ? this.optional(idService) : null,
      idPosition: targetType === 'Position' ? this.optional(idPosition) : null,
    };
  }

  private matchesCatalogValue(value: string | null, normalizedCode: string, normalizedName: string): boolean {
    const normalizedValue = value?.trim().toLowerCase();
    return Boolean(normalizedValue && (normalizedValue === normalizedCode || normalizedValue === normalizedName || normalizedValue.includes(normalizedName)));
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

type MinimumChecklistStatus = 'complete' | 'incomplete' | 'missing';

type MinimumChecklistItem = {
  readonly key: string;
  readonly section: string;
  readonly status: MinimumChecklistStatus;
  readonly description: string;
  readonly action: string;
};

type EligibilityUiState = 'eligible' | 'notEligible' | 'insufficient';
