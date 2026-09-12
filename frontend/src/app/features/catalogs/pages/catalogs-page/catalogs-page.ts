import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  Signal,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, finalize, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  ClientListItem,
  ManagedService,
  PagedResult,
  ServicePosition,
} from '../../../clients/data-access/client.models';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { GiSelect, GiSelectOption } from '../../../../shared/ui/gi-select/gi-select';
import { serviceOptionLabel } from '../../../services/data-access/service.models';
import { normalizeCatalogName } from '../../../../shared/util/catalog-name';
import { CatalogApiService } from '../../data-access/catalog-api.service';
import {
  BusinessCatalogItemType,
  CatalogDefinition,
  CatalogItem,
  EligibilityCheck,
  EligibilityRequirement,
  EligibilityRequirementTargetType,
  EligibilityRequirementType,
  EmployeeDocumentType,
  EmployeeEvaluationType,
} from '../../data-access/catalog.models';

/**
 * Catálogos, rehecha el 7 de septiembre de 2026.
 *
 * <p>La pantalla anterior recibía al usuario con un cuadro de diálogo modal —había que elegir un
 * catálogo antes de ver nada—, y detrás repartía el mismo contenido entre tres pestañas, una lista
 * lateral de categorías y el propio diálogo: tres navegaciones para llegar al mismo sitio. Antes
 * del contenido dibujaba trece tarjetas de conteo, y varias afirmaban cosas que no eran ciertas.</p>
 *
 * <p>Ahora son dos zonas. Arriba, lo que la organización define, con cada catálogo diciendo
 * <b>quién lo usa y cómo</b>. Abajo, plegadas, las listas fijas del sistema, que no se editan.</p>
 */
@Component({
  selector: 'app-catalogs-page',
  imports: [ReactiveFormsModule, NgTemplateOutlet, GiSelect],
  templateUrl: './catalogs-page.html',
  styleUrl: './catalogs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogsPage implements OnInit, AfterViewInit {
  private readonly catalogEditor = viewChild<ElementRef<HTMLDialogElement>>('catalogEditor');
  private readonly requirementEditor = viewChild<ElementRef<HTMLDialogElement>>('requirementEditor');
  private readonly rulesSection = viewChild<ElementRef<HTMLElement>>('rulesSection');

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CatalogApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);
  private readonly formBuilder = inject(FormBuilder);
  private dataSubscription?: Subscription;

  protected readonly definitions = signal<readonly CatalogDefinition[]>([]);
  protected readonly items = signal<readonly CatalogItem[]>([]);
  protected readonly requirements = signal<readonly EligibilityRequirement[]>([]);
  protected readonly clients = signal<readonly ClientListItem[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly employees = signal<readonly Employee[]>([]);

  /** La organización de trabajo la fija la barra de contexto, y sólo ella. */
  protected readonly selectedOrganizationId = this.auth.operationalOrganizationId;
  protected readonly canWrite = computed(() => this.auth.hasPermission('CATALOGS.WRITE'));

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  /** Qué catálogo está desplegado. Uno a la vez: dos listas abiertas se leen peor que una. */
  protected readonly openCatalogType = signal<BusinessCatalogItemType | null>(null);
  protected readonly selectedCatalogItemId = signal('');
  protected readonly selectedRequirementId = signal('');
  protected readonly eligibilityResult = signal<EligibilityCheck | null>(null);

  protected readonly valueSearch = signal('');
  protected readonly valueState = signal<'' | 'active' | 'inactive'>('');
  protected readonly requirementClientFilter = signal('');
  protected readonly requirementServiceFilter = signal('');
  protected readonly requirementPositionFilter = signal('');

  // ── Qué catálogo existe, para qué sirve y quién lo usa ──────────────────────────────────────

  /**
   * Los catálogos que la organización define, con su lector real.
   *
   * <p>«Quién lo usa» no es una etiqueta decorativa: cada línea se comprobó contra el código del
   * servidor. La distinción entre <b>identificador</b> y <b>nombre</b> importa y se dice en la
   * pantalla, porque cambia lo que pasa al renombrar un valor: por identificador el cambio se
   * propaga, por nombre los registros anteriores conservan el texto viejo.</p>
   */
  protected readonly organizationCatalogs: readonly CatalogCard[] = [
    {
      type: 'JobPosition',
      title: 'Puestos',
      example: 'Ej. Guardia de acceso',
      purpose: 'Los puestos operativos que cubre tu organización.',
      usedBy: 'Personal · Servicios · Planeación',
      link: 'identificador',
      linkDetail: 'El empleado y la posición del servicio guardan el identificador del puesto.',
    },
    {
      type: 'Skill',
      title: 'Habilidades',
      example: 'Ej. Manejo de arma corta',
      purpose: 'Competencias que una regla de elegibilidad puede exigir.',
      usedBy: 'Reglas de elegibilidad',
      link: 'identificador',
      linkDetail: 'La regla apunta a la habilidad por identificador.',
      warning:
        'Hoy no existe pantalla para otorgarle una habilidad a una persona. Una regla de habilidad'
        + ' bloqueante deja la publicación de la planeación detenida sin forma de desbloquearla.',
    },
    {
      type: 'IncidentReason',
      title: 'Motivos de incidencia',
      example: 'Ej. Retardo mayor a 30 minutos',
      purpose: 'Cómo se clasifica una excepción de la operación diaria.',
      usedBy: 'Operación',
      link: 'nombre',
      linkDetail: 'La incidencia guarda el texto del motivo, no su identificador:'
        + ' renombrar un motivo no cambia las incidencias ya registradas.',
    },
    {
      type: 'CoverageReason',
      title: 'Motivos de cobertura',
      example: 'Ej. Incapacidad médica',
      purpose: 'Por qué se cubre o se sustituye un turno.',
      usedBy: 'Operación · Planeación',
      link: 'identificador',
      linkDetail: 'La cobertura guarda el identificador del motivo.',
    },
    {
      type: 'ClientDocumentCategory',
      title: 'Categorías de documento del cliente',
      example: 'Ej. Acta constitutiva',
      purpose: 'De qué es cada documento del expediente de un cliente.',
      usedBy: 'Clientes',
      link: 'nombre',
      linkDetail: 'El documento guarda la categoría por nombre; renombrarla no reclasifica lo ya cargado.',
    },
    {
      type: 'Nationality',
      title: 'Nacionalidades',
      example: 'Ej. Mexicana',
      purpose: 'Nacionalidad de un cliente persona física.',
      usedBy: 'Solicitudes',
      link: 'nombre',
      linkDetail: 'La solicitud de alta de cliente guarda el texto.',
    },
  ];

  /**
   * La geografía, aparte y plegada.
   *
   * <p>Son más de doce mil filas por organización que en realidad son las mismas para todas. Se va
   * a una tabla compartida en su propia tanda; hasta entonces sigue aquí, funcionando, pero fuera
   * de la vista principal: ocupaba la mitad de la pantalla y no es algo que nadie configure.</p>
   */
  protected readonly geographyCatalogs: readonly CatalogCard[] = [
    {
      type: 'Country',
      title: 'Países',
      example: 'Ej. México',
      purpose: 'Países disponibles para domicilios.',
      usedBy: 'Clientes',
      link: 'nombre',
      linkDetail: 'El domicilio guarda el texto del país.',
    },
    {
      type: 'State',
      title: 'Estados',
      example: 'Ej. Jalisco',
      purpose: 'Estados por país.',
      usedBy: 'Clientes',
      link: 'nombre',
      linkDetail: 'El domicilio guarda el texto del estado.',
    },
    {
      type: 'City',
      title: 'Ciudades y municipios',
      example: 'Ej. Zapopan',
      purpose: 'Localidades por estado.',
      usedBy: 'Clientes',
      link: 'nombre',
      linkDetail: 'El domicilio guarda el texto de la ciudad.',
    },
  ];

  protected readonly targetTypes: readonly GiSelectOption[] = [
    { value: 'Organization', label: 'Toda la organización' },
    { value: 'Client', label: 'Un cliente' },
    { value: 'Service', label: 'Un servicio' },
    { value: 'Position', label: 'Una posición' },
  ];

  protected readonly requirementTypes: readonly GiSelectOption[] = [
    { value: 'Skill', label: 'Habilidad' },
    { value: 'Document', label: 'Documento' },
    { value: 'Evaluation', label: 'Evaluación' },
    { value: 'Restriction', label: 'Restricción bloqueante' },
  ];

  /**
   * Los tipos de documento que una regla puede exigir.
   *
   * <p>Van con etiqueta en español porque es lo que el usuario elige; el valor es el nombre que el
   * servidor entiende. Antes se ofrecía el nombre crudo del enum en el desplegable.</p>
   */
  protected readonly documentTypes: readonly GiSelectOption[] = [
    { value: 'EmploymentApplication', label: 'Solicitud de empleo' },
    { value: 'BirthCertificate', label: 'Acta de nacimiento' },
    { value: 'MarriageCertificate', label: 'Acta de matrimonio' },
    { value: 'VoterId', label: 'Credencial de elector' },
    { value: 'Curp', label: 'CURP' },
    { value: 'SocialSecurityNumber', label: 'Número de seguridad social' },
    { value: 'Rfc', label: 'RFC' },
    { value: 'TaxStatusCertificate', label: 'Constancia de situación fiscal' },
    { value: 'DriverLicense', label: 'Licencia de conducir' },
    { value: 'ProofOfAddress', label: 'Comprobante de domicilio' },
    { value: 'ProofOfStudies', label: 'Comprobante de estudios' },
    { value: 'MilitaryServiceCard', label: 'Cartilla militar' },
    { value: 'CriminalRecordCertificate', label: 'Carta de no antecedentes' },
    { value: 'Other', label: 'Otro' },
  ];

  protected readonly evaluationTypes: readonly GiSelectOption[] = [
    { value: 'Polygraph', label: 'Examen poligráfico' },
    { value: 'SocioeconomicStudy', label: 'Estudio socioeconómico' },
    { value: 'CriminalRecordReview', label: 'Revisión de antecedentes' },
    { value: 'DrugTest', label: 'Examen antidoping' },
    { value: 'Other', label: 'Otra' },
  ];

  protected readonly stateFilterOptions: readonly GiSelectOption[] = [
    { value: '', label: 'Activos e inactivos' },
    { value: 'active', label: 'Sólo activos' },
    { value: 'inactive', label: 'Sólo inactivos' },
  ];

  protected readonly statusOptions: readonly GiSelectOption[] = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
  ];

  // ── Formularios ─────────────────────────────────────────────────────────────────────────────

  protected readonly catalogForm = this.formBuilder.nonNullable.group({
    idParentCatalogItem: [''],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    status: ['active' as 'active' | 'inactive', [Validators.required]],
    order: [1, [Validators.required, Validators.min(1), Validators.max(100000), Validators.pattern(/^\d+$/)]],
    description: ['', [Validators.maxLength(1000)]],
  });

  protected readonly requirementForm = this.formBuilder.nonNullable.group({
    targetType: ['Organization' as EligibilityRequirementTargetType, [Validators.required]],
    idClient: [''],
    idService: [''],
    idPosition: [''],
    requirementType: ['Skill' as EligibilityRequirementType, [Validators.required]],
    // Uno por tipo de regla. El servidor sólo acepta el que corresponde y rechaza los otros dos,
    // así que aquí se mandan todos y se limpian los que no aplican al armar la petición.
    idRequiredCatalogItem: [''],
    requiredDocumentType: [''],
    requiredEvaluationType: [''],
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

  /**
   * Puentes de control a señal.
   *
   * <p>`gi-select` no es un `ControlValueAccessor`: se ata con `[value]` y `(valueChange)`. Leer
   * `control.value` directo en la plantilla no vuelve a pintar con `OnPush` cuando el valor cambia
   * desde el código —un `reset()` al abrir el cajón, por ejemplo—, así que cada control que alimenta
   * un desplegable se lee por aquí.</p>
   */
  protected readonly catalogStatus = this.controlSignal(this.catalogForm.controls.status);
  protected readonly catalogParent = this.controlSignal(this.catalogForm.controls.idParentCatalogItem);
  protected readonly requirementTarget = this.controlSignal(this.requirementForm.controls.targetType);
  protected readonly requirementKind = this.controlSignal(this.requirementForm.controls.requirementType);
  protected readonly requirementClient = this.controlSignal(this.requirementForm.controls.idClient);
  protected readonly requirementService = this.controlSignal(this.requirementForm.controls.idService);
  protected readonly requirementPosition = this.controlSignal(this.requirementForm.controls.idPosition);
  protected readonly requirementSkill = this.controlSignal(this.requirementForm.controls.idRequiredCatalogItem);
  protected readonly requirementDocument = this.controlSignal(this.requirementForm.controls.requiredDocumentType);
  protected readonly requirementEvaluation = this.controlSignal(this.requirementForm.controls.requiredEvaluationType);
  protected readonly eligibilityEmployee = this.controlSignal(this.eligibilityForm.controls.idEmployee);
  protected readonly eligibilityClient = this.controlSignal(this.eligibilityForm.controls.idClient);
  protected readonly eligibilityService = this.controlSignal(this.eligibilityForm.controls.idService);
  protected readonly eligibilityPosition = this.controlSignal(this.eligibilityForm.controls.idPosition);

  // ── Derivados ───────────────────────────────────────────────────────────────────────────────

  protected readonly selectedCatalogItem = computed(
    () => this.items().find((item) => item.idCatalogItem === this.selectedCatalogItemId()) ?? null,
  );
  protected readonly selectedRequirement = computed(
    () => this.requirements().find((item) => item.idEligibilityRequirement === this.selectedRequirementId()) ?? null,
  );
  protected readonly openCatalog = computed(
    () => [...this.organizationCatalogs, ...this.geographyCatalogs]
      .find((card) => card.type === this.openCatalogType()) ?? null,
  );

  protected readonly activeSkills = computed(() =>
    this.items()
      .filter((item) => item.type === 'Skill' && item.active)
      .map((item) => ({ value: item.idCatalogItem, label: item.name })),
  );

  protected readonly systemDefinitions = computed(() => this.definitions().filter((item) => !item.editable));

  /** Los valores del catálogo abierto, filtrados y ordenados. */
  protected readonly openCatalogItems = computed(() => {
    const type = this.openCatalogType();
    if (!type) return [];

    const search = normalizeCatalogName(this.valueSearch());
    const state = this.valueState();

    return this.items()
      .filter((item) => item.type === type)
      .filter((item) => !search || normalizeCatalogName(`${item.name} ${item.description ?? ''}`).includes(search))
      .filter((item) => !state || (state === 'active' ? item.active : !item.active))
      .sort((a, b) => (a.order ?? 1) - (b.order ?? 1) || a.name.localeCompare(b.name, 'es'));
  });

  protected readonly blockingRequirements = computed(
    () => this.requirements().filter((requirement) => requirement.active && requirement.isBlocking).length,
  );
  protected readonly activeRequirements = computed(
    () => this.requirements().filter((requirement) => requirement.active).length,
  );

  /**
   * Reglas de habilidad bloqueantes activas.
   *
   * <p>Se cuenta aparte porque hoy ninguna se puede cumplir: no hay pantalla que otorgue una
   * habilidad. La pantalla lo dice donde se crean las reglas, no en un documento.</p>
   */
  protected readonly unfulfillableSkillRules = computed(
    () => this.requirements().filter(
      (requirement) => requirement.active && requirement.isBlocking && requirement.requirementType === 'Skill',
    ).length,
  );

  protected readonly filteredRequirements = computed(() => {
    const clientFilter = this.requirementClientFilter();
    const serviceFilter = this.requirementServiceFilter();
    const positionFilter = this.requirementPositionFilter();

    return this.requirements().filter((requirement) =>
      (!clientFilter || requirement.idClient === clientFilter) &&
      (!serviceFilter || requirement.idService === serviceFilter) &&
      (!positionFilter || requirement.idPosition === positionFilter));
  });

  protected readonly clientOptions = computed<readonly GiSelectOption[]>(() =>
    this.clients().map((client) => ({ value: client.idClient, label: client.tradeName || client.legalName })),
  );
  protected readonly serviceOptions = computed<readonly GiSelectOption[]>(() =>
    this.services().map((service) => ({ value: service.idService, label: serviceOptionLabel(service) })),
  );
  protected readonly positionOptions = computed<readonly GiSelectOption[]>(() =>
    this.positions().map((position) => ({ value: position.idPosition, label: position.name })),
  );

  /**
   * Las mismas listas, con una opción de vaciado al frente.
   *
   * <p>`gi-select` dibuja el marcador de posición como texto, no como opción elegible: sin esto,
   * quien filtra por un cliente no puede volver a «todos» sin recargar la pantalla. Vale para los
   * campos opcionales; donde la elección es obligatoria no se ofrece vaciarla.</p>
   */
  protected readonly clientFilterOptions = computed(() => this.conVacio(this.clientOptions(), 'Todos los clientes'));
  protected readonly serviceFilterOptions = computed(() => this.conVacio(this.serviceOptions(), 'Todos los servicios'));
  protected readonly positionFilterOptions = computed(() => this.conVacio(this.positionOptions(), 'Todas las posiciones'));
  protected readonly clientContextOptions = computed(() => this.conVacio(this.clientOptions(), 'Sin cliente específico'));
  protected readonly serviceContextOptions = computed(() => this.conVacio(this.serviceOptions(), 'Sin servicio específico'));
  protected readonly positionContextOptions = computed(() => this.conVacio(this.positionOptions(), 'Sin posición específica'));
  protected readonly employeeOptions = computed<readonly GiSelectOption[]>(() =>
    this.employees().map((employee) => ({ value: employee.idEmployee, label: employee.fullName })),
  );

  /** Los padres posibles para un estado o una ciudad, y sólo activos. */
  protected readonly parentOptions = computed<readonly GiSelectOption[]>(() => {
    const type = this.openCatalogType();
    const parentType: BusinessCatalogItemType | null = type === 'State' ? 'Country' : type === 'City' ? 'State' : null;
    if (!parentType) return [];

    return this.items()
      .filter((item) => item.active && item.type === parentType)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((item) => ({ value: item.idCatalogItem, label: item.name }));
  });

  /**
   * Si el nombre ya está en este catálogo, activo o no.
   *
   * <p>Compara con la misma regla que el servidor: recorta, colapsa espacios, ignora acentos y
   * mayúsculas. Antes comparaba sólo en minúsculas, así que «Vigilancia» y «vigilância» pasaban
   * aquí y las rechazaba el servidor con un 409 sin explicación.</p>
   */
  protected readonly catalogNameExists = computed(() => {
    const name = normalizeCatalogName(this.catalogNameValue());
    const type = this.openCatalogType();
    if (!name || !type) return false;

    const parent = this.catalogParent() || null;
    return this.items().some((item) =>
      item.idCatalogItem !== this.selectedCatalogItemId() &&
      item.type === type &&
      (item.idParentCatalogItem ?? null) === parent &&
      normalizeCatalogName(item.name) === name);
  });

  private readonly catalogNameValue = this.controlSignal(this.catalogForm.controls.name);

  ngOnInit(): void {
    this.loadForActiveOrganization();
  }

  ngAfterViewInit(): void {
    // La ruta «Reglas documentales» apunta a esta misma pantalla. Ya no hay pestaña que activar,
    // así que lleva al bloque de reglas, que es lo que ese menú promete.
    if (this.route.snapshot.data['catalogTab'] === 'eligibility') {
      this.rulesSection()?.nativeElement.scrollIntoView({ block: 'start' });
    }
  }

  // ── Carga ───────────────────────────────────────────────────────────────────────────────────

  /**
   * Ya no se carga una lista de organizaciones para elegir: la organización la da la barra de
   * contexto. Si hay una, se cargan sus datos; si no, la pantalla espera a que se elija.
   */
  protected loadForActiveOrganization(): void {
    if (this.selectedOrganizationId()) {
      this.loadData();
    }
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

  // ── Zona 1: los catálogos de la organización ────────────────────────────────────────────────

  protected toggleCatalog(type: BusinessCatalogItemType): void {
    this.openCatalogType.update((current) => (current === type ? null : type));
    this.selectedCatalogItemId.set('');
    this.valueSearch.set('');
    this.valueState.set('');
  }

  protected countCatalogItems(type: BusinessCatalogItemType): number {
    return this.items().filter((item) => item.type === type && item.active).length;
  }

  protected geographyCount(): number {
    return this.geographyCatalogs.reduce((total, card) => total + this.countCatalogItems(card.type), 0);
  }

  /**
   * Cuántos registros usan este valor, contado por identificador.
   *
   * <p>Sólo se dice donde se puede comprobar. La pantalla anterior mostraba «Usado en: Operación»
   * comparando el nombre del valor con el texto de otros módulos, lo que acertaba por casualidad y
   * fallaba en silencio. Un puesto y una habilidad sí se atan por identificador y aquí se cuentan;
   * en el resto la relación se afirma a nivel de catálogo, no de valor.</p>
   */
  protected itemUsage(item: CatalogItem): string {
    if (item.type === 'JobPosition') {
      const total = this.employees().filter((employee) => employee.idJobPositionCatalogItem === item.idCatalogItem).length;
      return total ? `${total} persona${total === 1 ? '' : 's'} activa${total === 1 ? '' : 's'}` : 'Nadie lo tiene';
    }

    if (item.type === 'Skill') {
      const total = this.requirements().filter(
        (requirement) => requirement.active
          && requirement.requirementType === 'Skill'
          && requirement.idRequiredCatalogItem === item.idCatalogItem,
      ).length;
      return total ? `${total} regla${total === 1 ? '' : 's'} la exige${total === 1 ? '' : 'n'}` : 'Ninguna regla la exige';
    }

    return '';
  }

  protected lastEditedLabel(item: CatalogItem): string {
    if (!item.updatedAt) return 'Sin fecha';
    const date = new Date(item.updatedAt);
    return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es-MX');
  }

  protected parentName(item: CatalogItem): string {
    if (!item.idParentCatalogItem) return '';
    return this.items().find((parent) => parent.idCatalogItem === item.idParentCatalogItem)?.name ?? 'Padre no encontrado';
  }

  protected needsParent(): boolean {
    const type = this.openCatalogType();
    return type === 'State' || type === 'City';
  }

  // ── Zona 1: editor de un valor ──────────────────────────────────────────────────────────────

  protected openNewCatalogItem(): void {
    const type = this.openCatalogType();
    if (!this.canWrite() || !type) return;

    this.error.set('');
    this.selectedCatalogItemId.set('');
    this.catalogForm.reset({
      name: '',
      status: 'active',
      order: Math.min(100000, Math.max(0, ...this.openCatalogItems().map((item) => item.order ?? 1)) + 1),
      description: '',
      idParentCatalogItem: '',
    });
    this.catalogEditor()?.nativeElement.showModal();
  }

  protected editCatalogItem(item: CatalogItem): void {
    this.error.set('');
    this.selectedCatalogItemId.set(item.idCatalogItem);
    this.catalogForm.reset({
      name: item.name,
      status: item.active ? 'active' : 'inactive',
      order: item.order ?? 1,
      description: item.description ?? '',
      idParentCatalogItem: item.idParentCatalogItem ?? '',
    });
    this.catalogEditor()?.nativeElement.showModal();
  }

  protected closeCatalogEditor(): void {
    if (this.saving()) return;
    this.catalogEditor()?.nativeElement.close();
  }

  protected saveCatalogItem(): void {
    const type = this.openCatalogType();
    if (this.saving() || !type || !this.selectedOrganizationId() || this.catalogForm.invalid
      || this.catalogNameExists() || !this.canWrite()) {
      this.catalogForm.markAllAsTouched();
      return;
    }

    const form = this.catalogForm.getRawValue();
    const request = {
      idOrganization: this.selectedOrganizationId(),
      type,
      name: form.name.trim(),
      description: this.optional(form.description),
      idParentCatalogItem: this.optional(form.idParentCatalogItem),
      order: Number(form.order),
      active: form.status === 'active',
    };
    const selected = this.selectedCatalogItem();
    this.saving.set(true);
    const call = selected
      ? this.api.updateItem(selected.idCatalogItem, request)
      : this.api.createItem(request);

    call.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.message.set(selected ? 'Valor actualizado.' : 'Valor creado.');
        this.selectedCatalogItemId.set('');
        this.catalogEditor()?.nativeElement.close();
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateCatalogItem(item: CatalogItem): void {
    if (!this.canWrite() || this.saving()) return;

    const usage = this.itemUsage(item);
    const aviso = usage && !usage.startsWith('Nadie') && !usage.startsWith('Ninguna')
      ? `\n\nAhora mismo: ${usage}.`
      : '';

    if (!window.confirm(
      `¿Desactivar "${item.name}"?${aviso}\n\nEl valor no se borra: deja de poder elegirse y su
nombre sigue ocupado.`)) {
      return;
    }

    this.saving.set(true);
    this.api.deactivateItem(this.selectedOrganizationId(), item.idCatalogItem)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.message.set('Valor desactivado.');
          this.loadData();
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  // ── Reglas de elegibilidad ──────────────────────────────────────────────────────────────────

  protected openNewRequirement(): void {
    if (!this.canWrite()) return;
    this.resetRequirementForm();
    this.requirementEditor()?.nativeElement.showModal();
  }

  protected editRequirement(requirement: EligibilityRequirement): void {
    this.selectedRequirementId.set(requirement.idEligibilityRequirement);
    this.requirementForm.reset({
      targetType: requirement.targetType,
      idClient: requirement.idClient ?? '',
      idService: requirement.idService ?? '',
      idPosition: requirement.idPosition ?? '',
      requirementType: requirement.requirementType,
      idRequiredCatalogItem: requirement.idRequiredCatalogItem ?? '',
      requiredDocumentType: requirement.requiredDocumentType ?? '',
      requiredEvaluationType: requirement.requiredEvaluationType ?? '',
      name: requirement.name,
      description: requirement.description ?? '',
      isBlocking: requirement.isBlocking,
    });
    this.requirementEditor()?.nativeElement.showModal();
  }

  protected closeRequirementEditor(): void {
    if (this.saving()) return;
    this.requirementEditor()?.nativeElement.close();
  }

  protected saveRequirement(): void {
    if (this.saving() || !this.selectedOrganizationId() || this.requirementForm.invalid || !this.canWrite()) {
      this.requirementForm.markAllAsTouched();
      return;
    }

    const form = this.requirementForm.getRawValue();
    const request = {
      idOrganization: this.selectedOrganizationId(),
      targetType: form.targetType,
      ...this.targetIds(form.targetType, form.idClient, form.idService, form.idPosition),
      requirementType: form.requirementType,
      // Cada tipo manda lo suyo y nulo en los otros dos: si al cambiar de tipo quedara puesto el
      // valor del anterior, la regla pediría algo que nadie puede cumplir y bloquearía a todos.
      idRequiredCatalogItem: form.requirementType === 'Skill' ? this.optional(form.idRequiredCatalogItem) : null,
      requiredDocumentType: form.requirementType === 'Document'
        ? (this.optional(form.requiredDocumentType) as EmployeeDocumentType | null)
        : null,
      requiredEvaluationType: form.requirementType === 'Evaluation'
        ? (this.optional(form.requiredEvaluationType) as EmployeeEvaluationType | null)
        : null,
      name: form.name.trim(),
      description: this.optional(form.description),
      isBlocking: form.isBlocking,
    };
    const selected = this.selectedRequirement();
    this.saving.set(true);
    const call = selected
      ? this.api.updateEligibilityRequirement(selected.idEligibilityRequirement, request)
      : this.api.createEligibilityRequirement(request);

    call.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.message.set(selected ? 'Regla actualizada.' : 'Regla creada.');
        this.resetRequirementForm();
        this.requirementEditor()?.nativeElement.close();
        this.loadData();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateRequirement(requirement: EligibilityRequirement): void {
    if (!this.canWrite() || this.saving()) return;
    if (!window.confirm(`¿Desactivar la regla "${requirement.name}"?`)) return;

    this.saving.set(true);
    this.api.deactivateEligibilityRequirement(this.selectedOrganizationId(), requirement.idEligibilityRequirement)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.message.set('Regla desactivada.');
          this.loadData();
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  /**
   * Qué exige la regla, dicho en una línea para la lista.
   *
   * <p>Sustituye a la columna que enseñaba el código crudo. Cada tipo nombra lo suyo: la habilidad
   * por su nombre, el documento y la evaluación por su etiqueta, y la restricción dice que no exige
   * nada porque prohíbe.</p>
   */
  protected requirementDemandLabel(requirement: EligibilityRequirement): string {
    switch (requirement.requirementType) {
      case 'Skill':
        return requirement.requiredCatalogItemName ?? 'Habilidad no encontrada';
      case 'Document':
        return this.documentTypes.find((item) => item.value === requirement.requiredDocumentType)?.label
          ?? 'Documento sin especificar';
      case 'Evaluation':
        return this.evaluationTypes.find((item) => item.value === requirement.requiredEvaluationType)?.label
          ?? 'Evaluación sin especificar';
      default:
        return 'Prohíbe: no exige nada concreto';
    }
  }

  protected requirementScopeLabel(requirement: EligibilityRequirement): string {
    return requirement.positionName
      || requirement.serviceName
      || requirement.clientName
      || this.label(this.targetTypes, requirement.targetType);
  }

  protected requirementTypeLabel(type: EligibilityRequirementType): string {
    return this.label(this.requirementTypes, type);
  }

  protected activeLabel(active: boolean): string {
    return active ? 'Activo' : 'Inactivo';
  }

  // ── Validador de elegibilidad ───────────────────────────────────────────────────────────────

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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.eligibilityResult.set(result);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  /**
   * Sin reglas activas no hay conclusión posible, y decirlo importa.
   *
   * <p>«Elegible» cuando no hay ninguna regla no significa que la persona cumpla: significa que no
   * se comprobó nada. La ausencia de reglas no se presenta como cumplimiento.</p>
   */
  protected eligibilityState(result: EligibilityCheck | null): EligibilityUiState {
    if (!result || this.activeRequirements() === 0 || result.reasons.length === 0) {
      return 'insufficient';
    }

    return result.isEligible ? 'eligible' : 'notEligible';
  }

  protected eligibilityLabel(result: EligibilityCheck | null): string {
    const state = this.eligibilityState(result);
    if (state === 'eligible') return 'Elegible';
    return state === 'notEligible' ? 'No elegible' : 'Sin reglas suficientes';
  }

  // ── Selectores encadenados ──────────────────────────────────────────────────────────────────

  protected selectRequirementClient(idClient: string): void {
    this.requirementForm.patchValue({ idClient, idService: '', idPosition: '' });
    this.loadServicesForClient(idClient);
  }

  protected selectRequirementService(idService: string): void {
    const idClient = this.requirementForm.getRawValue().idClient;
    this.requirementForm.patchValue({ idService, idPosition: '' });
    this.loadPositionsForService(idClient, idService);
  }

  protected selectEligibilityClient(idClient: string): void {
    this.eligibilityForm.patchValue({ idClient, idService: '', idPosition: '' });
    this.loadServicesForClient(idClient);
  }

  protected selectEligibilityService(idService: string): void {
    const idClient = this.eligibilityForm.getRawValue().idClient;
    this.eligibilityForm.patchValue({ idService, idPosition: '' });
    this.loadPositionsForService(idClient, idService);
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

  // ── Interno ─────────────────────────────────────────────────────────────────────────────────

  private controlSignal<T>(control: AbstractControl<T>): Signal<T> {
    return toSignal(control.valueChanges, { initialValue: control.value as T }) as Signal<T>;
  }

  private conVacio(options: readonly GiSelectOption[], label: string): readonly GiSelectOption[] {
    return [{ value: '', label }, ...options];
  }

  private label(options: readonly GiSelectOption[], value: string): string {
    return options.find((option) => option.value === value)?.label ?? value;
  }

  private resetRequirementForm(): void {
    this.selectedRequirementId.set('');
    this.requirementForm.reset({
      targetType: 'Organization',
      idClient: '',
      idService: '',
      idPosition: '',
      requirementType: 'Skill',
      idRequiredCatalogItem: '',
      requiredDocumentType: '',
      requiredEvaluationType: '',
      name: '',
      description: '',
      isBlocking: true,
    });
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
    if (!idClient) return;

    this.clientApi.listServices(this.selectedOrganizationId(), idClient)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (services) => this.services.set(services),
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  private loadOperationalContext(clients: readonly ClientListItem[]): void {
    this.services.set([]);
    this.positions.set([]);
    if (!clients.length) return;

    forkJoin(clients.map((client) => this.clientApi.listServices(this.selectedOrganizationId(), client.idClient)))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (serviceGroups) => {
          const services = serviceGroups.flat();
          this.services.set(services);
          if (!services.length) return;

          forkJoin(services.map((service) =>
            this.clientApi.listPositions(this.selectedOrganizationId(), service.idClient, service.idService)))
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
              next: (positionGroups) => this.positions.set(positionGroups.flat()),
              error: () => this.positions.set([]),
            });
        },
        error: () => this.services.set([]),
      });
  }

  private loadPositionsForService(idClient: string, idService: string): void {
    this.positions.set([]);
    if (!idClient || !idService) return;

    this.clientApi.listPositions(this.selectedOrganizationId(), idClient, idService)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
      idClient: targetType !== 'Organization' ? this.optional(idClient) : null,
      idService: targetType === 'Service' || targetType === 'Position' ? this.optional(idService) : null,
      idPosition: targetType === 'Position' ? this.optional(idPosition) : null,
    };
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

/**
 * Un catálogo editable, con quién lo lee.
 *
 * <p>`link` dice si el lector guarda el identificador del valor o su texto. No es un detalle
 * técnico escondido: por identificador, renombrar un valor lo renombra en todas partes; por
 * nombre, los registros anteriores conservan el texto viejo y nada avisa.</p>
 */
type CatalogCard = {
  readonly type: BusinessCatalogItemType;
  readonly title: string;
  /**
   * El ejemplo del campo de nombre.
   *
   * <p>Vive con la ficha, junto al título y al propósito, porque el editor es uno solo para los
   * ocho catálogos: con el ejemplo escrito en la plantilla, «Ej. Guardia de acceso» aparecía
   * también en Habilidades, en los motivos y en las nacionalidades.</p>
   */
  readonly example: string;
  readonly purpose: string;
  readonly usedBy: string;
  readonly link: 'identificador' | 'nombre';
  readonly linkDetail: string;
  readonly warning?: string;
};

type EligibilityUiState = 'eligible' | 'notEligible' | 'insufficient';
