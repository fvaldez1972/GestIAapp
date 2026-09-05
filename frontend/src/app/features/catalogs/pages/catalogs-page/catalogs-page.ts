import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ElementRef, ViewChild, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, finalize, Subscription } from 'rxjs';
import { AppIcon } from '../../../../shared/ui/app-icon/app-icon';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, ManagedService, PagedResult, ServicePosition, ClientListItem, } from '../../../clients/data-access/client.models';
import { OperationalRequest } from '../../../requests/data-access/request.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { CatalogApiService } from '../../data-access/catalog-api.service';
import {
  BusinessCatalogItemType,
  CatalogItem,
  CatalogDefinition,
  EligibilityCheck,
  EligibilityRequirement,
  EligibilityRequirementTargetType,
  EligibilityRequirementType,
} from '../../data-access/catalog.models';

@Component({
  selector: 'app-catalogs-page',
  imports: [ReactiveFormsModule, AppIcon],
  templateUrl: './catalogs-page.html',
  styleUrl: './catalogs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogsPage implements OnInit {
  @ViewChild('catalogSelector') private catalogSelector?: ElementRef<HTMLDialogElement>;
  @ViewChild('catalogEditor') private catalogEditor?: ElementRef<HTMLDialogElement>;
  private readonly destroyRef = inject(DestroyRef);
  private dataSubscription?: Subscription;
  protected readonly definitions = signal<readonly CatalogDefinition[]>([]);
  protected readonly definitionSearch = signal('');
  protected readonly definitionMode = signal<'editable' | 'system'>('editable');
  protected readonly systemDefinition = signal<CatalogDefinition | null>(null);
  protected readonly catalogListing = signal(false);
  protected readonly editableDefinitions = computed(() => this.definitions().filter(item => item.editable));
  protected readonly catalogGroups = computed(() => Array.from(new Set(['General', 'Operativo', 'Elegibilidad',
    ...this.items().map(item => item.group ?? this.catalogGroupLabel(item.type))])).sort());
  protected readonly filteredDefinitions = computed(() => {
    const search = this.definitionSearch().trim().toLocaleLowerCase('es');
    return this.definitions().filter(item => item.editable === (this.definitionMode() === 'editable') &&
      (!search || `${item.name} ${item.module} ${item.group}`.toLocaleLowerCase('es').includes(search)));
  });
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CatalogApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly clients = signal<readonly ClientListItem[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);
  protected readonly requests = signal<readonly OperationalRequest[]>([]);
  protected readonly items = signal<readonly CatalogItem[]>([]);
  protected readonly requirements = signal<readonly EligibilityRequirement[]>([]);
  /** La organización de trabajo la fija la barra de contexto, y sólo ella. */
  protected readonly selectedOrganizationId = this.auth.operationalOrganizationId;
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
  protected readonly isPlatformAdmin = computed(() => this.auth.hasPermission('PLATFORM.ADMIN'));
  protected readonly selectedOrganization = this.auth.activeOrganization;
  protected readonly heroCopy = computed(() =>
    this.isPlatformAdmin()
      ? {
        eyebrow: 'Configuración plataforma',
        title: 'Catálogos por organización',
        description: 'Gobierna catálogos, tipos y reglas por organización sin mezclar operación ni archivos cargados.',
      }
      : {
        eyebrow: 'Configuración / Catálogos',
        title: 'Catálogos de la organización',
        description: 'Define valores operativos, requisitos documentales, bloqueos y reglas que usará el cliente en operación.',
      },
  );
  protected readonly selectedCatalogItem = computed(
    () => this.items().find((item) => item.idCatalogItem === this.selectedCatalogItemId()) ?? null,
  );
  protected readonly selectedRequirement = computed(
    () => this.requirements().find((item) => item.idEligibilityRequirement === this.selectedRequirementId()) ?? null,
  );
  protected readonly activeSkills = computed(() => this.items().filter((item) => item.type === 'Skill' && item.active));
  protected readonly activeCatalogCards = computed(() =>
    this.catalogCategories.filter((category) => category.tab === this.activeTab() && this.definitions().some(item => item.type === category.type)),
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
      const group = item.group ?? this.catalogGroupLabel(item.type);
      const searchableText = [item.code, item.name, ...(item.synonyms ?? []), item.description ?? '', this.typeLabel(item.type), group, modules.join(' ')]
        .join(' ')
        .toLowerCase();

      return (
        item.type === this.selectedCatalogType() &&
        (!search || searchableText.includes(search)) &&
        (!filters.group || group === filters.group) &&
        (!filters.state || (filters.state === 'active' ? item.active : !item.active)) &&
        (!filters.module || modules.includes(filters.module))
      );
    }).sort((a, b) => (a.order ?? 1) - (b.order ?? 1) || a.name.localeCompare(b.name, 'es'));
  });
  protected readonly activeCatalogItems = computed(() => this.items().filter((item) => item.active).length);
  protected readonly activeRequirements = computed(() => this.requirements().filter((requirement) => requirement.active).length);
  protected readonly documentGovernanceCards = computed<readonly DocumentGovernanceCard[]>(() => [
    {
      title: 'Tipos documentales',
      value: this.countCatalogItems('DocumentRequirement'),
      detail: 'qué documento se pide',
    },
    {
      title: 'Requisitos activos',
      value: this.activeRequirements(),
      detail: 'a quién aplican',
    },
    {
      title: 'Bloqueos',
      value: this.blockingRequirements(),
      detail: 'impiden asignación',
      warning: this.blockingRequirements() > 0,
    },
    {
      title: 'Evaluaciones',
      value: this.countCatalogItems('EvaluationRequirement'),
      detail: 'validaciones requeridas',
    },
  ]);
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
    const requestTypesUsed = this.definitions().some(item => item.key === 'OperationalRequestType' && item.values.length > 0);
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
        description: requestTypesUsed ? 'Tipos definidos por el sistema.' : 'No se pudo consultar la definicion del sistema.',
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
    { value: 'Country', label: 'País' }, { value: 'State', label: 'Estado' },
    { value: 'City', label: 'Ciudad / municipio' }, { value: 'Nationality', label: 'Nacionalidad' },
  ];

  protected readonly tabs: readonly { value: CatalogTab; label: string; help: string }[] = [
    { value: 'general', label: 'Generales', help: 'Habilidades, puestos y zonas base.' },
    { value: 'operational', label: 'Operativos', help: 'Motivos usados en operación diaria.' },
    { value: 'eligibility', label: 'Reglas', help: 'Requisitos, bloqueos y vigencias documentales.' },
  ];

  protected readonly catalogCategories: readonly CatalogCategory[] = [
    { type: 'Country', tab: 'general', title: 'Países', description: 'Países activos.', icon: '' },
    { type: 'State', tab: 'general', title: 'Estados', description: 'Estados por país.', icon: '' },
    { type: 'City', tab: 'general', title: 'Ciudades y municipios', description: 'Localidades por estado.', icon: '' },
    { type: 'Nationality', tab: 'general', title: 'Nacionalidades', description: 'Nacionalidades disponibles.', icon: '' },
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
    idParentCatalogItem: [''],
    type: ['Skill' as BusinessCatalogItemType, [Validators.required]],
    code: ['', [Validators.required, Validators.maxLength(80)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    group: ['General', [Validators.required, Validators.maxLength(80)]],
    status: ['active' as 'active' | 'inactive', [Validators.required]],
    order: [1, [Validators.required, Validators.min(1), Validators.max(100000), Validators.pattern(/^\d+$/)]],
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
    if (this.route.snapshot.data['catalogTab'] === 'eligibility') this.activeTab.set('eligibility');
    this.loadForActiveOrganization();
  }

  ngAfterViewInit(): void {
    if (this.route.snapshot.data['catalogTab'] !== 'eligibility') this.openCatalogSelector();
  }

  protected openCatalogSelector(): void {
    this.definitionSearch.set('');
    this.catalogSelector?.nativeElement.showModal();
  }

  protected chooseDefinition(definition: CatalogDefinition): void {
    this.catalogListing.set(true);
    this.systemDefinition.set(definition.editable ? null : definition);
    if (definition.type) {
      const category = this.catalogCategories.find(item => item.type === definition.type);
      if (category) this.activeTab.set(category.tab);
      this.selectCatalogCategory(definition.type);
      this.clearCatalogFilters();
    }
    this.catalogSelector?.nativeElement.close();
  }

  protected definitionCount(definition: CatalogDefinition): number {
    return definition.editable ? this.items().filter(item => item.type === definition.type).length : definition.values.length;
  }

  protected parentCatalogOptions(): readonly CatalogItem[] {
    const type = this.catalogForm.controls.type.value;
    const parentType = type === 'State' ? 'Country' : type === 'City' ? 'State' : null;
    return this.items().filter(item => item.active && item.type === parentType &&
      (!item.idParentCatalogItem || this.items().some(parent => parent.idCatalogItem === item.idParentCatalogItem && parent.active)));
  }

  protected parentCatalogLabel(id: string | null | undefined): string {
    return this.items().find(item => item.idCatalogItem === id)?.name ?? 'Valor anterior';
  }

  /**
   * Ya no se carga una lista de organizaciones para elegir: la organización la da la barra de
   * contexto. Si hay una, se cargan sus datos; si no, la pantalla espera a que se elija.
   */
  protected loadForActiveOrganization(): void {
    if (this.selectedOrganizationId()) {
      this.loadData();
    }
  }

  protected selectTab(tab: CatalogTab): void {
    this.catalogListing.set(false);
    this.activeTab.set(tab);
    const firstCategory = this.catalogCategories.find((category) => category.tab === tab);

    if (firstCategory) {
      this.selectedCatalogType.set(firstCategory.type);
      this.catalogForm.patchValue({ type: firstCategory.type });
    }
  }

  protected selectCatalogCategory(type: BusinessCatalogItemType): void {
    if (!this.definitions().some(item => item.editable && item.type === type)) return;
    this.selectedCatalogType.set(type);
    this.selectedCatalogItemId.set('');
    this.catalogForm.patchValue({ type, idParentCatalogItem: '' });
  }

  protected loadData(): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.dataSubscription?.unsubscribe();
    this.dataSubscription = forkJoin({
      definitions: this.api.listDefinitions(),
      items: this.api.listItems(organizationId, '', true),
      requirements: this.api.listEligibilityRequirements(organizationId),
      clients: this.auth.hasPermission('CLIENTS.READ') ? this.clientApi.listClientOptions(organizationId) : of({ items: [] }),
      employees: this.auth.hasPermission('WORKFORCE.READ') ? this.workforceApi.listEmployeeOptions(organizationId) : of({ items: [] }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ definitions, items, requirements, clients, employees }) => {
        if (organizationId !== this.selectedOrganizationId()) return;
        this.definitions.set(definitions);
        const clientItems = (clients as PagedResult<ClientListItem>).items;
        this.items.set(items);
        this.requirements.set(requirements);
        this.clients.set(clientItems);
        this.employees.set(employees.items);
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
    this.error.set('');
    this.selectedCatalogItemId.set(item.idCatalogItem);
    this.selectedCatalogType.set(item.type);
    this.catalogForm.reset({
      type: item.type,
      code: item.code,
      name: item.name,
      group: item.group ?? this.catalogGroupLabel(item.type),
      status: item.active ? 'active' : 'inactive',
      order: this.catalogOrder(item),
      synonyms: (item.synonyms ?? []).join(', '),
      description: item.description ?? '',
      idParentCatalogItem: item.idParentCatalogItem ?? '',
    });
    this.catalogForm.controls.type.disable();
    this.catalogDrawerOpen.set(true);
    this.catalogEditor?.nativeElement.showModal();
  }

  protected openNewCatalogItem(): void {
    this.error.set('');
    if (!this.canWrite() || !this.definitions().some(item => item.editable && item.type === this.selectedCatalogType())) return;
    this.catalogForm.controls.type.enable();
    this.selectedCatalogItemId.set('');
    this.catalogForm.reset({
      type: this.selectedCatalogType(),
      code: '',
      name: '',
      group: this.catalogGroupLabel(this.selectedCatalogType()),
      status: 'active',
      order: Math.min(100000, Math.max(0, ...this.selectedCatalogItems().map(item => item.order ?? 1)) + 1),
      synonyms: '',
      description: '',
    });
    this.catalogDrawerOpen.set(true);
    this.catalogEditor?.nativeElement.showModal();
  }

  protected closeCatalogDrawer(): void {
    if (this.saving()) return;
    this.catalogDrawerOpen.set(false);
    this.catalogEditor?.nativeElement.close();
  }

  protected saveCatalogItem(): void {
    if (this.saving() || !this.selectedOrganizationId() || this.catalogForm.invalid || this.catalogCodeExists() || !this.canWrite()) {
      this.catalogForm.markAllAsTouched();
      return;
    }

    const form = this.catalogForm.getRawValue();
    const synonyms = form.synonyms.split(',').map(value => value.trim()).filter(Boolean);
    if (synonyms.length > 20 || synonyms.some(value => value.length > 80)) {
      this.error.set('Usa hasta 20 sinonimos de 80 caracteres, separados por comas.');
      return;
    }
    const request = {
      idOrganization: this.selectedOrganizationId(),
      type: form.type,
      code: form.code.trim(),
      name: form.name.trim(),
      description: this.optional(form.description),
      idParentCatalogItem: this.optional(form.idParentCatalogItem),
      group: form.group.trim(),
      order: Number(form.order),
      synonyms,
      active: form.status === 'active',
    };
    const selected = this.selectedCatalogItem();
    this.saving.set(true);
    const call = selected
      ? this.api.updateItem(selected.idCatalogItem, request)
      : this.api.createItem(request);

    call.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.message.set(selected ? 'Catálogo actualizado.' : 'Catálogo creado.');
        this.resetCatalogForm();
        this.catalogDrawerOpen.set(false);
        this.catalogEditor?.nativeElement.close();
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
      complete: () => this.saving.set(false),
    });
  }

  protected deactivateCatalogItem(item: CatalogItem): void {
    if (!this.canWrite() || this.saving()) {
      return;
    }

    const modules = this.modulesForCatalogItem(item);
    const usageWarning = modules.length
      ? `\n\nModulos relacionados: ${modules.join(', ')}.`
      : '';

    if (!window.confirm(`¿Desactivar el catálogo "${item.name}"?${usageWarning}`)) {
      return;
    }

    this.saving.set(true);
    this.api.deactivateItem(this.selectedOrganizationId(), item.idCatalogItem)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
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

    return this.items().filter((item) => item.active && item.type.includes('Restriction')).map((item) => item.code);
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
    return item.order ?? 1;
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
    if (!item.updatedAt) return 'Sin fecha disponible';
    const date = new Date(item.updatedAt);
    return Number.isNaN(date.getTime()) ? 'Sin fecha disponible' : date.toLocaleDateString('es-MX');
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

  private loadOperationalContext(clients: readonly ClientListItem[]): void {
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
    // El día operativo lo dice el servidor. Calcularlo aquí con `toISOString()` daba el día UTC:
    // a las 19:00 hora de Ciudad de México del 4 de septiembre devolvía el 5, y la pantalla
    // proponía el día siguiente todas las tardes. Es el mismo defecto que el reloj operativo
    // cerró en el servidor. Cadena vacía mientras no se sabe: vacío se nota, un día equivocado no.
    return this.systemInfo.operationDate();
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

type DocumentGovernanceCard = {
  readonly title: string;
  readonly value: number;
  readonly detail: string;
  readonly warning?: boolean;
};

type EligibilityUiState = 'eligible' | 'notEligible' | 'insufficient';
