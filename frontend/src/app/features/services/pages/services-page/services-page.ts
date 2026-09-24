import { HttpErrorResponse } from '@angular/common/http';
import { ServerProblem, fieldError, readServerProblem } from '../../../../shared/util/server-problem';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  expand,
  filter,
  finalize,
  forkJoin,
  reduce,
  takeUntil,
} from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  GiColumn,
  GiDataTable,
  GiCell,
  GiDetailPanel,
  GiTabContent,
  GiFilterBar,
  GiFilterGroup,
  GiRowActions,
  GiRowAction,
  GiConfirmDialog,
  GiSelect,
  GiSelectOption,
  GiTab,
  GiTableState,
} from '../../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../../shared/util/operational-date';
import { ServiceApiService } from '../../data-access/service-api.service';
import {
  PositionVacancy,
  ServiceListItem,
  ServiceState,
  ServiceStatusFilter,
  positionVacancy,
  serviceState,
  serviceVacancy,
} from '../../data-access/service.models';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { EmployeeListApiService } from '../../../workforce/data-access/employee-list-api.service';
import { CatalogApiService } from '../../../catalogs/data-access/catalog-api.service';
import {
  ShiftPatternTemplate,
  ShiftPatternTemplateOption,
  cycleDayLabel,
  cycleLabel,
  cyclePhrase,
  shiftDaypartLabel,
} from '../../../catalogs/data-access/shift-pattern-template.models';
import { PAYMENT_FREQUENCY_LABELS, PaymentFrequency } from '../../../clients/data-access/client.models';
import { CandidateEligibility } from '../../../planning/data-access/planning.models';
import {
  AssignmentCandidateSource,
  buildAssignmentCandidates,
} from '../../data-access/assignment-candidates';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  Client,
  ClientContact,
  ClientZone,
  CreateManagedService,
  CreateServiceAssignment,
  CreateServicePosition,
  CreateShiftPattern,
  ManagedService,
  ManagedServiceInput,
  Organization,
  PagedResult,
  ServiceAssignment,
  ServiceAssignmentInput,
  ServiceAssignmentType,
  ServiceContract,
  ServicePosition,
  ServicePositionInput,
  ShiftPattern,
  ShiftPatternInput,
  ShiftSegment,
  ShiftSegmentInput,
} from '../../../clients/data-access/client.models';
import { ServiceDialog } from '../../ui/service-dialog';
import { ServiceContextApi } from '../../data-access/service-context-api';
import { EntityDocuments } from '../../../documents/components/entity-documents/entity-documents';
import { GiCandidatePicker } from '../../../../shared/ui/gi-candidate-picker/gi-candidate-picker';
import { GiCatalogCreation, GiCatalogOption } from '../../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { PositionSkillRequest, PositionSkills } from '../../ui/position-skills';
import { EligibilityRequirement, EligibilityRequirementInput } from '../../../catalogs/data-access/catalog.models';
import { AppIcon } from '../../../../shared/ui/app-icon/app-icon';
import { dateRangeValidator, shiftIntervalValidator } from '../../ui/service-validators';

@Component({
  selector: 'app-services-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ServiceDialog,
    AppIcon,
    GiFilterBar,
    GiDataTable,
    GiCell,
    GiDetailPanel,
    GiTabContent,
    GiRowActions,
    GiConfirmDialog,
    GiSelect,
    GiCandidatePicker,
    PositionSkills,
    EntityDocuments,
  ],
  templateUrl: './services-page.html',
  styleUrl: './services-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage implements OnInit, OnDestroy {
  private readonly api = inject(ClientApiService);
  private readonly contextApi = inject(ServiceContextApi);
  private readonly serviceApi = inject(ServiceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private pendingServiceLink = '';
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly employeeListApi = inject(EmployeeListApiService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);
  private readonly formBuilder = inject(FormBuilder);
  // A parent selection invalidates all requests below it.
  private readonly scopeChanges = new Subject<number>();
  private readonly destroyed = new Subject<void>();
  private readonly listChanges = new Subject<void>();
  /** La organización de trabajo la fija la barra de contexto, y sólo ella. */
  protected readonly selectedOrganizationId = this.auth.operationalOrganizationId;
  protected readonly selectedClient = signal<Client | null>(null);
  protected readonly selectedService = signal<ManagedService | null>(null);
  protected readonly selectedPosition = signal<ServicePosition | null>(null);
  protected readonly zones = signal<readonly ClientZone[]>([]);
  protected readonly hasActiveZone = computed(() => this.zones().some((zone) => zone.active));
  protected readonly hasActivePosition = computed(() =>
    this.positions().some((position) => position.active),
  );
  protected readonly contracts = signal<readonly ServiceContract[]>([]);
  protected readonly contacts = signal<readonly ClientContact[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly assignments = signal<readonly ServiceAssignment[]>([]);
  protected readonly positionVacancy = signal<readonly PositionVacancy[]>([]);

  /**
   * Si la lista de patrones ya llegó del servidor.
   *
   * <p><b>Una lista vacía no significa «no hay».</b> Puede significar «todavía no se han pedido» o
   * «se pidieron y la petición se canceló»: estas lecturas se cancelan cuando cambia el ámbito
   * —al abrir otro servicio, otra posición— y no se reintentan. Sin esta señal, la pantalla decía
   * «Sin patrones registrados para esta posición» sobre una posición que sí tenía patrones, y sólo
   * al crear otro aparecían todos. Se reportó así: «una vez que agregas un nuevo patrón, aparecen
   * los que están ocultos».</p>
   *
   * <p>Es la tercera vez que esta confusión cuesta un defecto en esta pantalla, después de las
   * zonas del cliente y del aviso de «todavía se están cargando».</p>
   */
  /** El servicio que se va a desactivar, mientras el diálogo pregunta. */
  protected readonly serviceToDeactivate = signal<ManagedService | null>(null);
  /**
   * Quién pisó el cambio y cuándo, cuando el servidor responde 409. Lo construye el backend con
   * la bitácora; aquí sólo se muestra y se ofrece recargar.
   */
  protected readonly conflict = signal('');
  /**
   * Por qué se corrige. **Va vacío y no se sugiere nada**: un motivo prellenado deja de ser un
   * motivo. El servidor decide si hace falta, y lo dice en el error.
   */
  protected readonly correctionReason = signal('');

  /**
   * El servidor pidió motivo por un caso que aquí no se previó. Red de seguridad, no la vía normal.
   */
  private readonly motivoExigidoPorElServidor = signal(false);
  protected readonly activeEmployees = signal<readonly Employee[]>([]);

  /**
   * Las personas que se pueden ofrecer, con lo que el servidor sabe de ellas.
   *
   * <p>Salen del listado de Personal y no del alta de empleados, porque ahí viene el conteo de
   * asignaciones vigentes: es lo que permite decir «Ocupado» sin inventarlo.</p>
   */
  protected readonly candidateRows = signal<readonly AssignmentCandidateSource[]>([]);

  /**
   * Si la lista de candidatos llego a contestar.
   *
   * <p>Sin esto, «no hay personal activo que ofrecer» se decia igual cuando la consulta fallaba,
   * y son dos cosas distintas con salidas distintas: una se resuelve dando de alta gente y la otra
   * volviendo a intentar. Afirmar la primera cuando pasa la segunda es el defecto que este proyecto
   * lleva semanas cerrando.</p>
   */
  protected readonly candidatesLoaded = signal(false);

  protected readonly candidatesEmptyTitle = computed(() =>
    this.candidatesLoaded()
      ? 'No hay personal activo que ofrecer'
      : 'No se pudo traer la lista de personal',
  );

  protected readonly candidatesEmptyBody = computed(() =>
    this.candidatesLoaded()
      ? 'Da de alta personal en Personal, o reactiva a alguien: aqui solo se ofrecen las personas activas de esta organizacion.'
      : 'Cierra y vuelve a abrir el alta para intentarlo otra vez. No quiere decir que no haya personal.',
  );

  /**
   * El veredicto del servidor por persona. Vacío mientras no contesta, y vacío si falla.
   *
   * <p>En los dos casos los candidatos salen «Sin comprobar», que es la verdad. «Elegible» es una
   * afirmación y sólo la puede hacer el servidor.</p>
   */
  protected readonly candidateEligibility = signal<ReadonlyMap<string, CandidateEligibility>>(new Map());

  /** El catálogo de experiencias de la organización, para armar el perfil de una posición. */
  protected readonly catalogSkills = signal<readonly { idCatalogItem: string; name: string }[]>([]);

  /**
   * Los patrones del catálogo que la posición puede seguir.
   *
   * <p>El servidor sólo ofrece los completos —los que tienen todos los días del ciclo declarados—
   * porque elegir uno con huecos generaría turnos que nadie pidió, y en la pantalla parecería que
   * el patrón ya está listo.</p>
   */
  protected readonly shiftPatternTemplates = signal<readonly ShiftPatternTemplateOption[]>([]);

  /**
   * Las plantillas con sus días declarados, para pintar el calendario de la posición.
   *
   * <p>Van aparte del desplegable y no en lugar de él: el desplegable sale de
   * <c>/options</c>, que sólo ofrece las plantillas completas —una con días sin declarar
   * generaría turnos con huecos—, y el calendario necesita los días, que esa lista no trae.</p>
   */
  protected readonly shiftPatternTemplateDetails = signal<readonly ShiftPatternTemplate[]>([]);

  /** La plantilla que sigue la posición abierta, resuelta. Nula si todavía no tiene ninguna. */
  protected readonly selectedPositionTemplate = computed<ShiftPatternTemplate | null>(() => {
    const id = this.selectedPosition()?.idShiftPatternTemplate;
    if (!id) return null;
    return this.shiftPatternTemplateDetails().find(
      (plantilla) => plantilla.idShiftPatternTemplate === id,
    ) ?? null;
  });

  /** Las reglas de experiencia ya guardadas para la posición abierta. */
  protected readonly positionSkillRequirements = signal<readonly EligibilityRequirement[]>([]);

  /**
   * Las experiencias elegidas para una posición que todavía no existe.
   *
   * <p>Una regla necesita el identificador de la posición, y al dar de alta no hay ninguno: se
   * guardan aquí y se crean en cuanto el servidor devuelve la posición. Así el alta no obliga a
   * guardar primero y volver a entrar para declarar el perfil.</p>
   */
  protected readonly pendingPositionSkills = signal<readonly PositionSkillRequest[]>([]);

  /** La lista que se ofrece, con disponibilidad y veredicto en cada fila. */
  protected readonly assignmentCandidates = computed(() =>
    buildAssignmentCandidates({
      employees: this.candidateRows(),
      assignments: this.assignments(),
      idPosition: this.assignmentForm.controls.idPosition.value,
      eligibility: this.candidateEligibility(),
      currentClients: this.candidateCurrentClients(),
    }),
  );

  /**
   * Con qué clientes está ocupado cada candidato hoy, indexado por persona.
   *
   * <p>Se pide una vez por organización cuando se abre el alta de asignación: preguntarlo por
   * candidato serían tantas consultas como filas tenga la lista.</p>
   */
  protected readonly candidateCurrentClients = signal<ReadonlyMap<string, readonly string[]>>(
    new Map(),
  );
  /**
   * El listado de la organización. **Antes esto era la lista de clientes**, y no se veía un solo
   * servicio hasta elegir uno: la cascada organización → cliente → servicio.
   */
  protected readonly serviceList = signal<PagedResult<ServiceListItem>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  protected readonly pending = signal(0);
  protected readonly loading = computed(() => this.pending() > 0);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  /**
   * Lo que el servidor dijo del último guardado, **con el detalle por campo**.
   *
   * <p>Existe porque `setError` leía `detail`, que en una validación trae siempre la misma frase:
   * «La solicitud contiene datos inválidos.». El servidor sí manda qué campo falló —va en
   * `errors`— y esta pantalla lo estaba tirando. Quien lo veía tenía que adivinar cuál de los
   * quince campos del formulario era.</p>
   */
  protected readonly problem = signal<ServerProblem | null>(null);

  /** El mensaje del servidor para un campo, o vacío si ese campo no falló. */
  protected errorDe(campo: string): string {
    const problema = this.problem();
    return problema ? fieldError(problema, campo) : '';
  }
  protected readonly message = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<ServiceStatusFilter>('Active');
  protected readonly activeTab = signal('data');
  protected readonly platformAdmin = computed(
    () => this.auth.session()?.permissions.includes('PLATFORM.ADMIN') ?? false,
  );
  protected readonly canRead = computed(
    () =>
      this.auth.hasPermission('CLIENTS.READ') &&
      !!this.selectedOrganizationId(),
  );
  protected readonly canReadPlanning = computed(
    () => this.canRead() && this.auth.hasPermission('PLANNING.READ'),
  );
  protected readonly canReadEmployees = computed(
    () => this.canReadPlanning() && this.auth.hasPermission('WORKFORCE.READ'),
  );
  protected readonly canReadDocuments = computed(
    () => this.canRead() && this.auth.hasPermission('DOCUMENTS.READ'),
  );
  /**
   * Permiso para escribir clientes <b>y</b> que el cliente elegido esté activo.
   *
   * <p>Mezcla dos preguntas y para las acciones de una fila está bien: editar un servicio de un
   * cliente dado de baja no tiene sentido. Para <b>crear</b>, no: ver `puedeCrearServicios`.</p>
   */
  protected readonly canWriteClients = computed(
    () =>
      this.canRead() &&
      this.auth.hasPermission('CLIENTS.WRITE') &&
      !!this.auth.activeOrganization() &&
      !!this.selectedClient()?.active,
  );

  /**
   * Sólo el permiso, sin el contexto.
   *
   * <p>El botón de «Nuevo servicio» se apagaba porque `canWriteClients` exige un cliente elegido y
   * activo, y sin cliente eso es siempre falso. Preguntar por el permiso al dibujar el botón, y
   * por el contexto al pulsarlo, es lo que permite explicar qué falta en lugar de apagarlo.</p>
   */
  /**
   * Lo que falta para poder crear, que no es un error de carga.
   *
   * <p>Va aparte de `error()` porque ese alimenta el `errorMessage` de la tabla: escrito ahi, el
   * aviso hacia desaparecer la lista y ofrecia un "Reintentar" que no reintentaba nada.</p>
   */
  protected readonly aviso = signal('');

  /** El nombre con el que el resto de la pantalla llama al cliente. */
  protected nombreDe(cliente: { readonly tradeName?: string | null; readonly legalName: string }): string {
    return cliente.tradeName || cliente.legalName;
  }

  protected readonly puedeCrearServicios = computed(
    () => this.canRead() && this.auth.hasPermission('CLIENTS.WRITE') && !!this.auth.activeOrganization(),
  );
  protected readonly canWritePlanning = computed(
    () =>
      this.canReadPlanning() &&
      this.auth.hasPermission('PLANNING.WRITE') &&
      !!this.auth.activeOrganization() &&
      !!this.selectedClient()?.active &&
      !!this.selectedService()?.active,
  );
  /** El día al que se calcula la cobertura. Lo dice el servidor, no el navegador. */
  protected readonly operationDate = computed(() => this.systemInfo.operationDate());

  protected readonly tableState = computed<GiTableState>(() => {
    if (this.error()) return 'error';
    if (this.loading() && !this.serviceList().items.length) return 'loading';
    if (this.serviceList().items.length) return 'ready';
    return this.search().trim() || this.statusFilter() !== 'Active' ? 'empty-filtered' : 'empty';
  });

  /** Los cuatro anchos de referencia del sistema, más el de la columna de acciones. */
  private readonly todasLasColumnas: readonly GiColumn[] = [
    { key: 'name', label: 'Servicio', width: '220px', kind: 'name' },
    { key: 'clientZone', label: 'Cliente · Zona', width: '190px' },
    { key: 'term', label: 'Vigencia', width: '150px', kind: 'meta' },
    { key: 'coverage', label: 'Posiciones', width: '130px', align: 'end' },
    { key: 'state', label: 'Estado', width: '130px' },
    { key: 'actions', label: '', width: '52px', align: 'end' },
  ];

  /**
   * Con la ficha abierta la tabla se comprime, así que muestra menos columnas: servicio, cobertura
   * y estado. **Es lo que dibuja el bosquejo**, y la alternativa —seguir con las seis— deja la
   * mitad cortadas dentro de su propio scroll, que es peor que no mostrarlas.
   */
  protected readonly columns = computed<readonly GiColumn[]>(() =>
    this.selectedService()
      ? this.todasLasColumnas.filter((column) =>
          ['name', 'coverage', 'state', 'actions'].includes(column.key),
        )
      : this.todasLasColumnas,
  );

  protected readonly statusGroups = computed<readonly GiFilterGroup[]>(() => [
    {
      id: 'status',
      label: 'Estado',
      allLabel: 'Todos',
      value: this.statusFilter() === 'All' ? '' : this.statusFilter(),
      options: [
        { value: 'Active', label: 'Activos' },
        { value: 'Inactive', label: 'Inactivos' },
      ],
    },
  ]);
  protected readonly selectedClientName = computed(() => this.selectedClient()?.legalName ?? '');
  protected readonly selectedServiceName = computed(() => this.selectedService()?.name ?? '');
  protected readonly selectedPositionName = computed(() => this.selectedPosition()?.name ?? '');
  protected readonly serviceWizardStep = signal(1);
  protected readonly serviceEditorOpen = signal(false);
  protected readonly editingService = signal<ManagedService | null>(null);
  protected readonly positionEditorOpen = signal(false);
  protected readonly editingPosition = signal<ServicePosition | null>(null);
  protected readonly assignmentEditorOpen = signal(false);
  protected readonly editingAssignment = signal<ServiceAssignment | null>(null);

  ngOnInit(): void {
    // El parámetro `organizationId` ya no se lee: cambiaba la organización activa del usuario
    // desde un enlace, por encima de lo que dijera la barra de contexto. `clientId` y `serviceId`
    // sí siguen, porque dicen qué abrir dentro de la organización, no cuál es.
    this.route.queryParamMap.pipe(takeUntil(this.destroyed)).subscribe((params) => {
      if (this.canRead() && params.get('clientId')) this.loadLinkedClient();
    });

    this.loadForActiveOrganization();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
    this.scopeChanges.complete();
    this.listChanges.complete();
  }

  /**
   * Carga la pantalla para la organización que dice la barra de contexto. Antes esto también
   * vaciaba una docena de señales, porque la organización podía cambiar con la pantalla abierta;
   * ya no hace falta: el shell la vuelve a montar cuando la organización cambia.
   */
  private loadForActiveOrganization(): void {
    if (this.selectedOrganizationId()) {
      // El servicio enlazado lo trae la suscripción a los parámetros de la URL, que ya corre con
      // la organización puesta. Pedirlo también aquí lo pediría dos veces.
      this.loadServices();
    }
  }

  /**
   * El listado, en **una sola llamada**. Antes eran tres pasos —listar clientes, elegir uno,
   * listar sus servicios— y no se veía un servicio hasta el tercero.
   */
  /**
   * El cliente con el que llegó el enlace desde Clientes.
   *
   * <p>Existe porque la lista tiene que <b>mostrarse filtrada</b> y decirlo: guardarlo sólo por
   * dentro dejaba al usuario mirando la lista completa sin saber que venía de un cliente.</p>
   */
  protected readonly linkedClientId = signal('');

  protected loadServices(page = 1): void {
    if (!this.canRead()) return;
    this.listChanges.next();
    this.error.set('');
    this.problem.set(null);
    this.read(
      this.serviceApi
        .searchServices({
          organizationId: this.selectedOrganizationId(),
          // La transición desde Clientes llega con el cliente elegido, y la lista tiene que
          // mostrarlo filtrado. Antes el identificador se guardaba y la lista seguía completa:
          // el usuario aterrizaba aquí sin señal de que venía de un cliente concreto.
          clientId: this.linkedClientId() || undefined,
          search: this.search(),
          status: this.statusFilter(),
          // Sin día operativo no se manda ninguno: el servidor pone el suyo, que es el bueno.
          coverageDate: this.operationDate() || undefined,
          page,
          pageSize: 20,
        })
        .pipe(takeUntil(this.listChanges)),
      0,
      (result) => this.serviceList.set(result),
    );
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.loadServices(1);
  }

  /** Quita el filtro que trajo el enlace y deja la lista completa. */
  protected clearLinkedClient(): void {
    this.linkedClientId.set('');
    this.selectedClient.set(null);
    this.loadServices(1);
  }

  protected onStatusFilter(value: string): void {
    this.statusFilter.set((value || 'All') as ServiceStatusFilter);
    this.loadServices(1);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('Active');
    this.loadServices(1);
  }

  private loadLinkedClient(): void {
    const params = this.route.snapshot.queryParamMap;
    const clientId = params.get('clientId');
    if (!clientId || !this.canRead()) return;
    this.scopeChanges.next(1);
    this.closeEditors();
    this.selectedClient.set(null);
    this.selectedService.set(null);
    this.services.set([]);
    this.zones.set([]);
    this.contracts.set([]);
    // Los contactos tambien, que se quedaban fuera. Las tres listas se piden juntas y son del
    // mismo cliente: dejar una sin vaciar deja los contactos del cliente anterior en pantalla
    // mientras llegan los del nuevo.
    this.contacts.set([]);
    this.clearServiceDetail();
    this.pendingServiceLink = params.get('serviceId') ?? '';
    this.linkedClientId.set(clientId);
    const org = this.selectedOrganizationId();
    this.read(this.contextApi.getClient(org, clientId), 1, (client) => {
      if (client.idOrganization !== org) {
        this.error.set('El cliente no pertenece a la organización seleccionada.');
        return;
      }
      this.selectedClient.set(client);
      // Las zonas, los contratos y los contactos del cliente enlazado, salvo que venga tambien un
      // servicio: al abrirlo se piden estas mismas listas, y pedirlas aqui las duplicaria.
      //
      //
      // Faltaban, y ese era el defecto. Este camino —el de «Crear servicio de este cliente», que
      // llega con `?clientId=`— dejaba `zones` en la lista vacia con la que se entra, y la unica
      // rutina que la llenaba era `loadClientContext`, a la que solo se llama al abrir un servicio
      // que ya existe. Con un cliente sin servicios eso no pasa nunca, asi que «Nuevo servicio»
      // respondia que el cliente no tenia ninguna zona activa mientras Clientes le mostraba dos.
      //
      // La lista vacia no significaba «no tiene»: significaba «nadie las pidio».
      if (!this.pendingServiceLink) {
        this.loadClientLists(client.idClient);
      }
      // La lista se vuelve a pedir ya filtrada por el cliente del enlace.
      this.loadServices(1);
      this.openLinkedService(client.idClient);
    });
  }

  /**
   * Abre la ficha de un servicio del listado. La zona, el contrato y el cliente se piden aquí
   * porque el listado no los trae completos: trae los nombres para pintarlos, no las listas para
   * editarlos.
   */
  protected openService(item: ServiceListItem): void {
    if (this.saving() || !this.canRead()) return;
    this.scopeChanges.next(1);
    this.pendingServiceLink = '';
    this.closeEditors();
    this.selectedService.set(item);
    this.activeTab.set('data');
    this.clearServiceDetail();
    this.message.set('');
    this.loadClientContext(item.idClient);
    this.loadServiceDetail(item);
  }

  protected closePanel(): void {
    if (this.saving()) return;
    this.closeEditors();
    this.selectedService.set(null);
    this.selectedClient.set(null);
    this.clearServiceDetail();
  }

  private loadClientContext(idClient: string): void {
    const org = this.selectedOrganizationId();
    this.read(
      forkJoin({
        client: this.contextApi.getClient(org, idClient),
        zones: this.api.listZones(org, idClient),
        contracts: this.api.listContracts(org, idClient),
        contacts: this.api.listContacts(org, idClient),
      }),
      1,
      (data) => {
        this.selectedClient.set(data.client);
        this.applyClientLists(data);
      },
    );
  }

  /**
   * Las listas del cliente, sin volver a pedir el cliente.
   *
   * <p>Existe para el camino que llega desde Clientes: ahi el cliente ya se pidio para comprobar
   * que pertenece a la organizacion, y repetir esa consulta seria una peticion de mas.</p>
   */
  private loadClientLists(idClient: string): void {
    const org = this.selectedOrganizationId();
    this.read(
      forkJoin({
        zones: this.api.listZones(org, idClient),
        contracts: this.api.listContracts(org, idClient),
        contacts: this.api.listContacts(org, idClient),
      }),
      1,
      (data) => this.applyClientLists(data),
    );
  }

  private applyClientLists(data: {
    readonly zones: readonly ClientZone[];
    readonly contracts: readonly ServiceContract[];
    readonly contacts: readonly ClientContact[];
  }): void {
    this.zones.set(data.zones);
    this.contracts.set(data.contracts);
    this.contacts.set(data.contacts);
  }

  /**
   * Abre el servicio que venía en la URL.
   *
   * <p>Es una segunda consulta y tiene su motivo: la lista visible trae la primera página de los
   * activos, y el servicio enlazado puede estar en la tercera o estar dado de baja. Ésta va
   * acotada al cliente y con los tres estados, sólo para encontrarlo.</p>
   */
  private openLinkedService(idClient: string): void {
    const enlazado = this.pendingServiceLink;
    this.pendingServiceLink = '';

    if (!enlazado) {
      return;
    }

    this.read(
      this.serviceApi.searchServices({
        organizationId: this.selectedOrganizationId(),
        clientId: idClient,
        status: 'All',
        coverageDate: this.operationDate() || undefined,
        // Cien es el maximo que acepta el servidor. Con doscientos contestaba 400 y la pantalla
        // ensenaba «La solicitud contiene datos invalidos» sin decir de que.
        pageSize: 100,
      }),
      1,
      (result) => {
        const servicio = result.items.find((item) => item.idService === enlazado);

        if (servicio) {
          this.openService(servicio);
        } else {
          this.error.set('El servicio solicitado no está disponible en esta organización.');
          // No se abrio ningun servicio, asi que nadie cargo las listas del cliente. Sin esto, la
          // pantalla quedaria otra vez creyendo que el cliente no tiene zonas.
          this.loadClientLists(idClient);
        }
      },
    );
  }

  private loadServiceDetail(service: ManagedService): void {
    if (this.canReadPlanning()) {
      this.loadPositions(service);
      this.loadAssignments(service);
      this.loadPositionVacancy(service);
      this.loadActiveEmployees();
    }
  }

  /**
   * La cobertura por posición, al día operativo. Va aparte de la lista de posiciones porque
   * depende de una fecha y la posición no: el mismo puesto tiene hueco un día y no al siguiente.
   */
  private loadPositionVacancy(service: ManagedService): void {
    this.read(
      this.serviceApi.listPositionVacancy(
        this.selectedOrganizationId(),
        service.idClient,
        service.idService,
        this.operationDate() || undefined,
      ),
      2,
      (vacancy) => this.positionVacancy.set(vacancy),
    );
  }

  private clearServiceDetail(): void {
    this.positionVacancy.set([]);
    this.activeEmployees.set([]);
    this.positions.set([]);
    this.assignments.set([]);
    this.selectedPosition.set(null);
  }

  /** El estado que se pinta en la fila. Ver la nota de `serviceState`: vencido no es inactivo. */
  protected estado(item: { active: boolean; endDate: string | null }): ServiceState {
    return serviceState(item, this.operationDate());
  }

  protected estadoTexto(item: { active: boolean; endDate: string | null }): string {
    return { inactive: 'Inactivo', expired: 'Vigencia terminada', active: 'Activo' }[this.estado(item)];
  }

  /** Lo que falta. **Negativo si sobra gente**, y así se muestra. */
  protected vacantes(item: ServiceListItem): number {
    return serviceVacancy(item);
  }

  protected vacantesDePosicion(position: PositionVacancy): number {
    return positionVacancy(position);
  }

  protected readonly porId = (item: ServiceListItem) => item.idService;

  protected readonly formatearFecha = formatOperationalDate;

  /**
   * El contacto operativo de la zona del servicio. Es dato del cliente, y aquí se muestra en
   * lectura para no salir a Clientes en mitad de la operación.
   */
  protected readonly contactoOperativo = computed(() => {
    const zona = this.selectedService()?.idClientZone;
    return (
      this.contacts().find(
        (contacto) => contacto.idClientZone === zona && contacto.purpose === 'Operational',
      ) ?? null
    );
  });

  protected vigencia(item: { startDate: string; endDate: string | null }): string {
    const inicio = formatOperationalDate(item.startDate);
    return item.endDate ? `${inicio} — ${formatOperationalDate(item.endDate)}` : `${inicio} — sin término`;
  }

  /** Las vacantes de todo el servicio, para el contador de la pestaña. */
  protected readonly vacantesAbiertas = computed(() =>
    this.positionVacancy().reduce((total, position) => total + Math.max(0, positionVacancy(position)), 0),
  );

  protected readonly panelTabs = computed<readonly GiTab[]>(() => [
    { id: 'data', label: 'Datos' },
    { id: 'positions', label: 'Posiciones', count: this.positions().length },
    { id: 'assignments', label: 'Asignaciones', count: this.vacantesAbiertas() },
    // La cedula de servicio vive aqui, con los demas documentos del servicio. El modelo ya los
    // admitia —BusinessDocumentOwnerType.Service existe desde antes— y lo que faltaba era la
    // pestana: el servicio era el unico dueno de documentos sin donde verlos.
    { id: 'documents', label: 'Documentos', count: this.serviceDocumentCount() },
  ]);

  /** Cuántos documentos tiene el servicio abierto, para el contador de la pestaña. */
  protected readonly serviceDocumentCount = signal(0);

  protected readonly rowActions = computed<readonly GiRowAction[]>(() => [
    { id: 'edit', label: 'Editar servicio', disabled: !this.canWriteClients(), disabledReason: 'No tienes permiso para editar servicios' },
    { id: 'positions', label: 'Ver posiciones' },
    { id: 'documents', label: 'Documentos' },
    {
      id: 'deactivate',
      label: 'Desactivar servicio',
      destructive: true,
      disabled: !this.canWriteClients(),
      disabledReason: 'No tienes permiso para desactivar servicios',
    },
  ]);

  protected onRowAction(item: ServiceListItem, action: GiRowAction): void {
    this.openService(item);

    if (action.id === 'edit') this.openEditService(item);
    if (action.id === 'positions') this.activeTab.set('positions');
    if (action.id === 'documents') {
      void this.router.navigate(['/documentos'], {
        queryParams: { ownerType: 'Service', ownerId: item.idService },
      });
    }
    if (action.id === 'deactivate') this.confirmDeactivateService(item);
  }

  /**
   * Deja al día lo que se ve del servicio: su ficha y su fila en el listado.
   *
   * <p>Se usa después de escribir posiciones o asignaciones. `refresh()` hace lo mismo pero es la
   * acción manual del usuario, con sus guardas; ésta es la que se llama sola tras guardar.</p>
   */
  private refrescarFichaYListado(service: ManagedService): void {
    this.loadServiceDetail(service);
    this.loadServices(this.serviceList().page);
  }

  protected refresh(): void {
    if (this.saving()) return;
    this.error.set('');
    this.problem.set(null);
    const service = this.selectedService();
    if (service) this.loadServiceDetail(service);
    this.loadServices(this.serviceList().page);
  }

  protected loadPositions(service = this.selectedService()): void {
    if (!service || !this.canReadPlanning()) return;

    // El calendario de la posición vive en esta misma pestaña y se dibuja con estos días, así que
    // viajan con las posiciones y no con el editor.
    this.loadShiftPatternTemplateDetails();

    this.read(
      this.api.listPositions(this.selectedOrganizationId(), service.idClient, service.idService),
      2,
      (rows) => {
        this.positions.set(rows);
        const position =
          rows.find((p) => p.idPosition === this.selectedPosition()?.idPosition) ?? rows[0];
        if (position) this.selectPosition(position);
        else {
          this.selectedPosition.set(null);
        }
      },
    );
  }

  protected selectPosition(position: ServicePosition): void {
    if (this.saving()) return;
    this.scopeChanges.next(3);
    this.selectedPosition.set(position);
  }

  protected loadAssignments(service = this.selectedService()): void {
    if (!service || !this.canReadPlanning()) return;
    this.read(
      this.api.listAssignments(this.selectedOrganizationId(), service.idClient, service.idService),
      2,
      (rows) => this.assignments.set(rows),
    );
  }

  private loadActiveEmployees(): void {
    if (!this.canReadEmployees()) return;
    const org = this.selectedOrganizationId();
    this.read(
      this.workforceApi.listEmployees(org, '', 'Active', 1, 100).pipe(
        expand((page) =>
          page.page < page.totalPages
            ? this.workforceApi.listEmployees(org, '', 'Active', page.page + 1, 100)
            : EMPTY,
        ),
        reduce((all, page) => [...all, ...page.items], [] as Employee[]),
      ),
      2,
      (rows) => this.activeEmployees.set(rows),
    );
  }

  private withScope<T>(level: number) {
    return (source: Observable<T>) =>
      source.pipe(
        takeUntil(this.scopeChanges.pipe(filter((changed) => changed <= level))),
        takeUntil(this.destroyed),
      );
  }


  /**
   * Carga a quién se puede ofrecer, y le pregunta al servidor por cada uno.
   *
   * <p>Se pide al abrir el alta y no al entrar a la pantalla: son dos consultas que sólo sirven
   * cuando alguien va a asignar, y la segunda depende de la posición elegida.</p>
   */

  /**
   * El subtítulo dice cuántos servicios hay y cuántos tienen hueco.
   *
   * <p>Antes decía «La organización se hereda de la barra de contexto», que es cierto y no le sirve
   * a nadie: describe cómo funciona la pantalla por dentro, no lo que hay en ella. Clientes y
   * Personal llevan un conteo con la consecuencia; esto hace lo mismo, y la vacante es lo que de
   * verdad se busca al abrir Servicios.</p>
   */
  protected readonly serviceCountNote = computed(() => {
    if (this.platformAdmin() && !this.selectedOrganizationId()) {
      return '';
    }

    const total = this.serviceList().totalCount;

    if (!total) {
      return 'Un servicio se contrata para un cliente con al menos una zona activa.';
    }

    const conHueco = this.serviceList().items.filter((row) => this.vacantes(row) > 0).length;
    const base = `${total} ${total === 1 ? 'servicio' : 'servicios'}.`;

    if (conHueco === 0) {
      return `${base} Ninguno de los que se ven tiene posiciones sin cubrir.`;
    }

    return conHueco === 1
      ? `${base} Uno de los que se ven tiene posiciones sin cubrir.`
      : `${base} ${conHueco} de los que se ven tienen posiciones sin cubrir.`;
  });

  private loadAssignmentCandidates(): void {
    const org = this.selectedOrganizationId();

    if (!this.canReadEmployees() || !org) return;

    this.candidatesLoaded.set(false);
    this.candidateRows.set([]);
    this.candidateEligibility.set(new Map());
    this.candidateCurrentClients.set(new Map());

    // Con qué clientes está ocupado cada quien. Va aparte del listado y sin bloquearlo: si falla,
    // la fila cae al conteo de siempre en vez de dejar la lista sin candidatos.
    this.read(this.employeeListApi.listCurrentAssignments(org), 2, (filas) =>
      this.candidateCurrentClients.set(
        new Map(filas.map((fila) => [fila.idEmployee, fila.clientNames])),
      ),
    );

    this.read(
      // Cien es el maximo del servidor. Con doscientos esta consulta contestaba 400, la lista de
      // candidatos quedaba vacia, y el recuadro afirmaba que no habia personal activo cuando si lo
      // habia: la pantalla daba por hecho un dato que nunca recibio.
      this.employeeListApi.searchEmployees({ organizationId: org, status: 'Active', pageSize: 100 }),
      2,
      (result) => {
        this.candidatesLoaded.set(true);
        this.candidateRows.set(
          result.page.items.map((item) => ({
            idEmployee: item.idEmployee,
            codeEmployee: item.codeEmployee,
            fullName: item.fullName,
            jobPositionName: item.jobPositionName,
            jobTitle: item.jobTitle,
            assignmentCount: item.assignmentCount,
          })),
        );
        this.loadCandidateEligibility();
      },
    );
  }

  /**
   * Le pregunta al servidor quién cumple, para la posición elegida.
   *
   * <p>Si falla no se enseña un error: los candidatos se quedan «Sin comprobar». Un fallo de esta
   * consulta no impide asignar —el servidor vuelve a decidir al guardar—, y bloquear la pantalla
   * por no poder adelantar el veredicto sería peor que no adelantarlo.</p>
   */
  /**
   * Quien sigue asignado a esta posicion y ya no cumple, despues de editarla.
   *
   * <p><b>Por que va despues de guardar y no antes.</b> Lo que se edita en ese formulario y puede
   * dejar a alguien fuera son <b>las experiencias que pide la posicion</b>, que son reglas de
   * elegibilidad y se guardan como parte de la misma accion. El resto del perfil —escolaridad,
   * sexo, rango de edad, equipo— el servidor lo devuelve siempre como informativo: dice «no impide
   * asignar», asi que cambiarlo no puede descalificar a nadie. Preguntar antes de guardar habria
   * obligado a evaluar un conjunto de reglas que todavia no existe.</p>
   *
   * <p>El aviso no deshace nada: enumera a quien quedo fuera y lleva a Asignaciones, que es donde
   * se resuelve. Quitarle la asignacion a alguien por un cambio de perfil es una decision de quien
   * opera, no un efecto colateral de guardar.</p>
   */
  private revisarAsignadosTrasEditar(idPosition: string): void {
    const org = this.selectedOrganizationId();
    const service = this.selectedService();

    const asignados = this.assignments()
      .filter((assignment) => assignment.active && assignment.idPosition === idPosition)
      .map((assignment) => assignment.idEmployee);

    if (!org || !service || asignados.length === 0) return;

    this.catalogApi
      .checkEligibilityBatch({
        organizationId: org,
        employeeIds: [...new Set(asignados)],
        clientId: service.idClient,
        serviceId: service.idService,
        positionId: idPosition,
        referenceDate: this.today(),
      })
      .pipe(takeUntil(this.destroyed))
      .subscribe({
        next: (checks) => {
          const fuera = checks
            .filter((check) => !check.isEligible)
            .map((check) => ({
              nombre: check.employeeName,
              motivos: check.reasons
                .filter((reason) => reason.isRequired && !reason.passed)
                .map((reason) => reason.message),
            }));

          this.asignadosFuera.set(fuera);
        },
        // En silencio: el aviso es una cortesia, y no poder darlo no puede tapar el «posicion
        // actualizada» que el usuario si necesita leer.
        error: () => this.asignadosFuera.set([]),
      });
  }

  /** Quien quedo fuera del perfil tras la ultima edicion. Vacio mientras no haya nada que avisar. */
  protected readonly asignadosFuera = signal<
    readonly { readonly nombre: string; readonly motivos: readonly string[] }[]
  >([]);

  private loadCandidateEligibility(): void {
    const org = this.selectedOrganizationId();
    const service = this.selectedService();
    const idPosition = this.assignmentForm.controls.idPosition.value;
    const ids = this.candidateRows().map((row) => row.idEmployee);

    if (!org || !service || ids.length === 0) return;

    this.catalogApi
      .checkEligibilityBatch({
        organizationId: org,
        employeeIds: ids,
        clientId: service.idClient,
        serviceId: service.idService,
        positionId: idPosition || null,
        referenceDate: this.assignmentForm.controls.startDate.value || this.today(),
      })
      .pipe(takeUntil(this.destroyed))
      .subscribe({
        next: (checks) =>
          this.candidateEligibility.set(
            new Map(
              checks.map((check) => [
                check.idEmployee,
                {
                  isEligible: check.isEligible,
                  blockingReasons: check.reasons
                    .filter((reason) => reason.isRequired && !reason.passed)
                    .map((reason) => reason.message),
                },
              ]),
            ),
          ),
        error: () => this.candidateEligibility.set(new Map()),
      });
  }

  /** Al cambiar la posición cambia el veredicto: se vuelve a preguntar. */
  protected onCandidatePositionChange(idPosition: string): void {
    this.assignmentForm.controls.idPosition.setValue(idPosition);
    this.candidateEligibility.set(new Map());
    this.loadCandidateEligibility();
  }

  protected chooseCandidate(candidate: { readonly id: string }): void {
    this.assignmentForm.controls.idEmployee.setValue(candidate.id);
  }

  /**
   * La salida del estado vacío. No preselecciona nada en Personal, porque esa pantalla no lee
   * ningún parámetro: mandarle uno que ignora sería el defecto que ya se corrigió en el enlace de
   * Clientes a Servicios.
   */
  protected goToWorkforce(): void {
    void this.router.navigate(['/personal']);
  }

  private read<T>(source: Observable<T>, level: number, next: (value: T) => void): void {
    this.pending.update((n) => n + 1);
    source
      .pipe(
        this.withScope(level),
        finalize(() => this.pending.update((n) => n - 1)),
      )
      .subscribe({
        next,
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected closeEditors(): void {
    if (this.saving()) return;
    this.serviceEditorOpen.set(false);
    this.positionEditorOpen.set(false);
    this.assignmentEditorOpen.set(false);
    this.error.set('');
    this.problem.set(null);
  }

  private allowWrite(planning = false): boolean {
    return !this.saving() && (planning ? this.canWritePlanning() : this.canWriteClients());
  }

  protected readonly weekDays: readonly { value: string; label: string }[] = [
    { value: 'Monday', label: 'Lunes' },
    { value: 'Tuesday', label: 'Martes' },
    { value: 'Wednesday', label: 'Miércoles' },
    { value: 'Thursday', label: 'Jueves' },
    { value: 'Friday', label: 'Viernes' },
    { value: 'Saturday', label: 'Sábado' },
    { value: 'Sunday', label: 'Domingo' },
  ];

  /** Los cuatro periodos, para el selector del precio. Quincenal y catorcenal son distintos. */
  protected readonly paymentFrequencies = (
    Object.keys(PAYMENT_FREQUENCY_LABELS) as PaymentFrequency[]
  ).map((value) => ({ value, label: PAYMENT_FREQUENCY_LABELS[value] }));

  protected readonly assignmentTypes: readonly { value: ServiceAssignmentType; label: string }[] = [
    // Los rótulos llevan el vocabulario de la operación, no el del enum. «Titular» y
    // «cubre-descansos» son como se nombran en la llamada y en el proceso de campo; el valor
    // guardado no cambia, así que los datos vivos siguen valiendo.
    { value: 'Primary', label: 'Titular' },
    { value: 'Support', label: 'Apoyo' },
    { value: 'Relief', label: 'Cubre-descansos' },
    { value: 'TemporaryReplacement', label: 'Suplencia temporal' },
  ];

  protected readonly serviceForm = this.formBuilder.nonNullable.group(
    {
      idClientZone: ['', [Validators.required]],
      idServiceContract: [''],
      name: ['', [Validators.required, Validators.maxLength(160)]],
      description: ['', [Validators.required, Validators.maxLength(1000)]],
      startDate: ['', [Validators.required]],
      endDate: [''],
    },
    { validators: dateRangeValidator('startDate', 'endDate') },
  );

  /** Lo que hay escrito en el formulario de configuración, como señal. */
  /**
   * Por qué se va a exigir motivo, dicho <b>antes</b> de intentar guardar. Vacío si no hace falta.
   *
   * <p><b>Antes había que fallar para enterarse.</b> El campo del motivo sólo aparecía cuando el
   * servidor rechazaba con un mensaje que contuviera «motivo», y ese rechazo llega como validación:
   * el detalle es «La solicitud contiene datos inválidos» y la explicación viaja dentro de
   * `errors`, no en `detail`. La comprobación de la cadena nunca se cumplía, el campo no aparecía
   * nunca, y cambiar el precio mensual resultaba imposible. Se reportó tal cual: «no te deja
   * modificarlo, tienes que poner el mismo valor que pusiste al crearlo».</p>
   *
   * <p>La regla se puede saber aquí, y es la misma que aplica el servidor: el precio, la moneda y el
   * impuesto son lo que se le factura al cliente, y una vigencia terminada se corrige, no se edita.
   * La del servidor sigue mandando; ésta sólo llega a tiempo.</p>
   */
  // El motivo lo sigue exigiendo el servidor cuando toca; la regla local que lo anticipaba era de
  // la configuracion y se fue con ella.
  protected readonly correctionReasonRequired = computed(() => this.motivoExigidoPorElServidor());

  protected readonly positionForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    requiredWorkerCount: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    // El precio vive aqui desde que se retiro la configuracion del servicio: en seguridad privada
    // se cotiza por puesto, no por servicio.
    price: [0, [Validators.required, Validators.min(0)]],
    priceFrequency: ['Monthly' as PaymentFrequency, [Validators.required]],
    isTaxIncluded: [false],
    // El patron de turno sale del catalogo. Vacio significa que la posicion conserva el patron que
    // se le capturo por dentro, no que no tenga turnos.
    idShiftPatternTemplate: [''],
    // La vigencia del puesto, que no es la del servicio: un servicio de todo el año puede tener un
    // refuerzo de octubre a diciembre. Vacías heredan la del servicio, que es lo que las posiciones
    // capturadas antes del 19 de septiembre de 2026 tenían implícitamente.
    startDate: [''],
    endDate: [''],
    // El perfil que el cliente pide para el puesto. Es del puesto y no de la persona: describe lo
    // contratado, y por eso el catálogo de sexo admite «Indistinto».
    idSexCatalogItem: [''],
    idAgeRangeCatalogItem: [''],
    idEducationLevelCatalogItem: [''],
    requiredSkillProfile: ['', [Validators.maxLength(1000)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  /**
   * El equipo que el cliente pide, que casi nunca es uno.
   *
   * <p>Fuera del formulario reactivo porque es una lista y no un campo: el formulario guarda
   * valores sueltos, y meter aquí un arreglo obligaría a sincronizarlo a mano en cada `reset`.</p>
   */
  protected readonly selectedEquipment = signal<readonly string[]>([]);

  protected readonly equipmentCatalog = signal<readonly GiCatalogOption[]>([]);
  protected readonly sexCatalog = signal<readonly GiCatalogOption[]>([]);
  protected readonly ageRangeCatalog = signal<readonly GiCatalogOption[]>([]);
  protected readonly educationCatalog = signal<readonly GiCatalogOption[]>([]);

  /**
   * Lo que el desplegable ofrece: lo del catálogo que **todavía no** está elegido.
   *
   * <p>Dejar dentro lo ya elegido obligaría a distinguir a ojo entre lo que se puede agregar y lo
   * que ya está, y elegirlo por descuido lo quitaría —porque el alta comparte método con la
   * baja—, que es exactamente el clic que nadie entiende.</p>
   */
  protected readonly equipmentOptions = computed<readonly GiSelectOption[]>(() =>
    this.equipmentCatalog()
      .filter((equipo) => !this.selectedEquipment().includes(equipo.idCatalogItem))
      .map((equipo) => ({ value: equipo.idCatalogItem, label: equipo.name })),
  );

  /** Lo elegido, resuelto a nombres para las fichas. En el orden en que se fue eligiendo. */
  protected readonly selectedEquipmentItems = computed<readonly GiCatalogOption[]>(() =>
    this.selectedEquipment()
      .map((id) => this.equipmentCatalog().find((equipo) => equipo.idCatalogItem === id))
      .filter((equipo): equipo is GiCatalogOption => !!equipo),
  );

  /** Agrega desde el desplegable. Vacío no hace nada: es el marcador de posición, no una opción. */
  protected addEquipment(idCatalogItem: string): void {
    if (!idCatalogItem || this.selectedEquipment().includes(idCatalogItem)) return;
    this.selectedEquipment.update((actuales) => [...actuales, idCatalogItem]);
  }

  /** Alterna una pieza de equipo. Elegir dos veces la misma la quita, que es lo que espera quien la pulsa. */
  protected toggleEquipment(idCatalogItem: string): void {
    this.selectedEquipment.update((actuales) =>
      actuales.includes(idCatalogItem)
        ? actuales.filter((id) => id !== idCatalogItem)
        : [...actuales, idCatalogItem],
    );
  }

  /**
   * Los cuatro catálogos del perfil de la posición.
   *
   * <p>Se piden juntos y una vez por organización: son los mismos para todos sus servicios, y
   * pedirlos al abrir cada posición repetiría cuatro respuestas idénticas.</p>
   */
  private loadPositionProfileCatalogs(): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) return;

    const activos = (items: readonly { idCatalogItem: string; name: string; active: boolean }[]) =>
      items.filter((item) => item.active).map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name }));

    this.catalogApi.listItems(organizationId, 'Sex').subscribe({
      next: (items) => this.sexCatalog.set(activos(items)),
      error: () => this.sexCatalog.set([]),
    });
    this.catalogApi.listItems(organizationId, 'AgeRange').subscribe({
      next: (items) => this.ageRangeCatalog.set(activos(items)),
      error: () => this.ageRangeCatalog.set([]),
    });
    this.catalogApi.listItems(organizationId, 'EducationLevel').subscribe({
      next: (items) => this.educationCatalog.set(activos(items)),
      error: () => this.educationCatalog.set([]),
    });
    this.catalogApi.listItems(organizationId, 'RequiredEquipment').subscribe({
      next: (items) => this.equipmentCatalog.set(activos(items)),
      error: () => this.equipmentCatalog.set([]),
    });
  }


  protected readonly assignmentForm = this.formBuilder.nonNullable.group(
    {
      idEmployee: ['', [Validators.required]],
      idPosition: ['', [Validators.required]],
      assignmentType: ['Primary' as ServiceAssignmentType, [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: [''],
      isPrimary: [true],
      notes: ['', [Validators.maxLength(1000)]],
    },
    { validators: dateRangeValidator('startDate', 'endDate') },
  );

  /**
   * Abre el alta de servicio, o dice qué falta para poder abrirla.
   *
   * <p>Antes salía en silencio por esta misma condición, con el botón además deshabilitado: desde
   * fuera parecía que el botón no respondía. Un servicio necesita un cliente con zona activa, y
   * eso es cierto; lo que no puede es no decirse.</p>
   */
  protected openCreateService(): void {
    if (this.saving() || !this.puedeCrearServicios()) return;
    this.closeEditors();
    this.aviso.set('');

    const cliente = this.selectedClient();

    if (!cliente) {
      this.aviso.set(
        'Un servicio se contrata para un cliente. Abre el cliente en Clientes y entra a sus '
        + 'servicios desde ahí.',
      );
      return;
    }

    // "Todavia no se han cargado" no es "no tiene". Decir que un cliente no tiene zonas cuando la
    // peticion sigue en vuelo es afirmar algo que la pantalla no sabe, y el cliente de la captura
    // tenia tres.
    if (this.loading()) {
      this.aviso.set('Todavía se están cargando las zonas de este cliente. Espera un momento.');
      return;
    }

    if (!this.zones().some((zone) => zone.active)) {
      this.aviso.set(
        `${this.nombreDe(cliente)} no tiene ninguna zona activa, y un servicio se presta en una `
        + 'zona. Registra la zona antes de contratar el servicio.',
      );
      return;
    }

    this.editingService.set(null);
    this.serviceWizardStep.set(1);
    this.serviceForm.reset({
      idClientZone: this.zones().find((s) => s.active)?.idClientZone ?? '',
      idServiceContract: '',
      name: '',
      description: '',
      startDate: this.today(),
      endDate: '',
    });
    this.serviceEditorOpen.set(true);
  }

  /**
   * Las horas al mes que salen del horario pactado.
   *
   * <p>Se redondea a un decimal, que es lo que la columna guarda. Cincuenta y dos semanas entre
   * doce meses da 4.333, no 4: usar cuatro perderia mas de medio dia de trabajo al mes.</p>
   */
  protected openEditService(service: ManagedService): void {
    if (!this.allowWrite(false)) return;
    this.closeEditors();
    this.error.set('');
    this.problem.set(null);
    this.editingService.set(service);
    this.serviceWizardStep.set(1);
    this.serviceForm.reset({
      idClientZone: service.idClientZone,
      idServiceContract: service.idServiceContract ?? '',
      name: service.name,
      description: service.description,
      startDate: this.dateOnly(service.startDate),
      endDate: this.dateOnly(service.endDate),
    });
    this.serviceEditorOpen.set(true);
  }

  protected nextServiceWizardStep(): void {
    const step = this.serviceWizardStep();
    const controls =
      step === 1
        ? [
            this.serviceForm.controls.idClientZone,
            this.serviceForm.controls.name,
          ]
        : [this.serviceForm.controls.description];

    controls.forEach((control) => control.markAsTouched());
    if (controls.some((control) => control.invalid)) {
      return;
    }

    this.serviceWizardStep.set(Math.min(3, step + 1));
  }

  protected previousServiceWizardStep(): void {
    this.serviceWizardStep.update((step) => Math.max(1, step - 1));
  }

  protected saveService(): void {
    if (!this.allowWrite(false)) return;
    this.error.set('');
    this.problem.set(null);
    const client = this.selectedClient();
    if (!client || this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios, los límites y la vigencia.');
      return;
    }

    const form = this.serviceForm.getRawValue();
    const input: ManagedServiceInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idClientZone: form.idClientZone,
      idServiceContract: this.optional(form.idServiceContract),
      name: form.name,
      description: form.description,
      // Sin descripcion para factura: el campo se retiro por no usarse.
      invoiceDescription: null,
      startDate: form.startDate,
      endDate: this.optionalDate(form.endDate),
    };
    const editing = this.editingService();
    const request = editing
      ? this.api.updateService(client.idClient, editing.idService, input)
      // Sin codigo: lo genera el servidor. Mandar cadena vacia no seria lo mismo —la validaria
      // como capturada y la rechazaria—, asi que se omite el campo entero.
      : this.api.createService(client.idClient, { ...input } satisfies CreateManagedService);

    this.saving.set(true);
    request
      .pipe(
        this.withScope(1),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (service) => {
          this.saving.set(false);
          this.serviceEditorOpen.set(false);
          this.message.set(
            editing ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.',
          );
          this.selectedService.set(service);
          this.loadServices(this.serviceList().page);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  /**
   * Pregunta antes de desactivar. **No con un `window.confirm`**, que sólo sabe decir «¿estás
   * seguro?»: el diálogo del sistema nombra el servicio y explica qué deja de funcionar, que es lo
   * que se lee antes de contestar.
   */
  protected confirmDeactivateService(service: ManagedService): void {
    if (!this.allowWrite(false)) return;
    this.serviceToDeactivate.set(service);
  }

  protected cancelDeactivateService(): void {
    this.serviceToDeactivate.set(null);
  }

  protected deactivateService(service: ManagedService): void {
    if (!this.allowWrite(false)) return;
    this.error.set('');
    this.problem.set(null);
    this.serviceToDeactivate.set(null);
    const client = this.selectedClient();
    if (!client) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivateService(this.selectedOrganizationId(), client.idClient, service.idService)
      .pipe(
        this.withScope(1),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Servicio desactivado correctamente.');
          if (this.selectedService()?.idService === service.idService) {
            this.selectedService.set(null);
            this.positions.set([]);
            this.selectedPosition.set(null);
          }
          this.loadServices(this.serviceList().page);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateAssignment(): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    this.problem.set(null);
    if (!this.selectedClient() || !this.selectedService() || !this.positions().length) {
      return;
    }

    if (!this.canReadEmployees() || !this.hasActivePosition()) return;
    this.assignmentForm.controls.idEmployee.enable();
    this.editingAssignment.set(null);
    this.assignmentForm.reset({
      // Vacio, a proposito. Venia con el primer empleado activo ya puesto, asi que guardar sin
      // tocar nada asignaba a una persona que nadie eligio —y el alta no ensena ningun selector de
      // empleado, solo la lista de candidatos, asi que no habia forma de verlo—. Es el mismo
      // criterio del campo de motivo: un dato que compromete a alguien no se prellena.
      idEmployee: '',
      idPosition:
        (this.selectedPosition()?.active ? this.selectedPosition()?.idPosition : '') ||
        this.positions().find((position) => position.active)?.idPosition ||
        '',
      assignmentType: 'Primary',
      startDate: this.today(),
      endDate: '',
      isPrimary: true,
      notes: '',
    });
    this.loadAssignmentCandidates();
    this.assignmentEditorOpen.set(true);
  }

  protected openEditAssignment(assignment: ServiceAssignment): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    this.problem.set(null);
    this.editingAssignment.set(assignment);
    this.assignmentForm.reset({
      idEmployee: assignment.idEmployee,
      idPosition: assignment.idPosition ?? '',
      assignmentType: assignment.assignmentType,
      startDate: this.dateOnly(assignment.startDate),
      endDate: this.dateOnly(assignment.endDate),
      isPrimary: assignment.isPrimary,
      notes: assignment.notes ?? '',
    });
    this.assignmentForm.controls.idEmployee.disable();
    this.assignmentEditorOpen.set(true);
  }

  protected saveAssignment(): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    this.problem.set(null);
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.assignmentForm.invalid) {
      this.assignmentForm.markAllAsTouched();
      // Si lo unico que falta es la persona, se dice cual es el campo y donde se elige. El alta no
      // tiene selector de empleado —se elige en la lista de candidatos— asi que «revisa los campos
      // obligatorios» dejaba a quien asigna buscando un campo que no existe.
      this.error.set(
        this.assignmentForm.controls.idEmployee.value
          ? 'Revisa los campos obligatorios, los límites y la vigencia.'
          : 'Elige a la persona en la lista de candidatos de abajo.',
      );
      return;
    }

    const form = this.assignmentForm.getRawValue();
    const input: ServiceAssignmentInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idService: service.idService,
      idPosition: form.idPosition,
      assignmentType: form.assignmentType,
      startDate: form.startDate,
      endDate: this.optionalDate(form.endDate),
      isPrimary: form.isPrimary,
      notes: this.optional(form.notes),
    };
    const editing = this.editingAssignment();
    const request = editing
      ? this.api.updateAssignment(client.idClient, service.idService, editing.idServiceAssignment, {
          ...input,
          // El token que se leyó al abrir la asignación. Se devuelve tal cual: si alguien la
          // corrigió mientras tanto, el servidor responde 409 y dice quién fue.
          rowVersion: editing.rowVersion,
        })
      : this.api.createAssignment(client.idClient, service.idService, {
          ...input,
          idEmployee: form.idEmployee,
        } satisfies CreateServiceAssignment);

    this.saving.set(true);
    request
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.assignmentEditorOpen.set(false);
          this.message.set(
            editing ? 'Asignación actualizada correctamente.' : 'Asignación creada correctamente.',
          );
          // Ficha y listado, los dos.
          //
          // El panel se refrescaba solo, y de la lista salen los contadores de la fila —Posiciones,
          // Req./Asig.— y tambien la cuenta de vacantes de la pestaña, que se calcula sobre datos
          // del detalle. Refrescar la mitad dejaba dos numeros distintos sobre el mismo servicio,
          // uno al lado del otro. Son cuatro defectos reportados y una sola causa.
          this.refrescarFichaYListado(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivateAssignment(assignment: ServiceAssignment): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    this.problem.set(null);
    const client = this.selectedClient();
    const service = this.selectedService();
    if (
      !client ||
      !service ||
      !window.confirm(`¿Deseas desactivar la asignación de ${assignment.employeeName}?`)
    ) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivateAssignment(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        assignment.idServiceAssignment,
        assignment.rowVersion,
      )
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Asignación desactivada correctamente.');
          // Ficha y listado, los dos.
          //
          // El panel se refrescaba solo, y de la lista salen los contadores de la fila —Posiciones,
          // Req./Asig.— y tambien la cuenta de vacantes de la pestaña, que se calcula sobre datos
          // del detalle. Refrescar la mitad dejaba dos numeros distintos sobre el mismo servicio,
          // uno al lado del otro. Son cuatro defectos reportados y una sola causa.
          this.refrescarFichaYListado(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreatePosition(): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    this.problem.set(null);
    if (!this.selectedClient() || !this.selectedService()) {
      return;
    }

    this.editingPosition.set(null);
    this.positionForm.reset({
      name: '',
      requiredWorkerCount: 1,
      price: 0,
      priceFrequency: 'Monthly',
      isTaxIncluded: false,
      idShiftPatternTemplate: '',
      idSexCatalogItem: '',
      idAgeRangeCatalogItem: '',
      idEducationLevelCatalogItem: '',
      startDate: '',
      endDate: '',
      requiredSkillProfile: '',
      notes: '',
    });
    this.selectedEquipment.set([]);
    this.selectedShiftPatternTemplateId.set('');
    this.loadPositionSkills(null);
    this.loadShiftPatternTemplates();
    this.loadPositionProfileCatalogs();
    this.positionEditorOpen.set(true);
  }

  protected openEditPosition(position: ServicePosition): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    this.problem.set(null);
    this.editingPosition.set(position);
    this.positionForm.reset({
      name: position.name,
      requiredWorkerCount: position.requiredWorkerCount,
      price: position.price,
      priceFrequency: position.priceFrequency,
      isTaxIncluded: position.isTaxIncluded,
      idShiftPatternTemplate: position.idShiftPatternTemplate ?? '',
      idSexCatalogItem: position.idSexCatalogItem ?? '',
      idAgeRangeCatalogItem: position.idAgeRangeCatalogItem ?? '',
      idEducationLevelCatalogItem: position.idEducationLevelCatalogItem ?? '',
      startDate: position.startDate ?? '',
      endDate: position.endDate ?? '',
      requiredSkillProfile: position.requiredSkillProfile ?? '',
      notes: position.notes ?? '',
    });
    // Con respaldo vacio: una respuesta de un servidor que todavia no trae el campo no puede
    // tumbar la pantalla, y «sin equipo declarado» es exactamente lo que esa respuesta significa.
    this.selectedEquipment.set((position.requiredEquipment ?? []).map((item) => item.idCatalogItem));
    this.selectedShiftPatternTemplateId.set(position.idShiftPatternTemplate ?? '');
    this.loadPositionSkills(position.idPosition);
    this.loadShiftPatternTemplates();
    this.loadPositionProfileCatalogs();
    this.positionEditorOpen.set(true);
  }


  // ── El perfil de la posición, por experiencias del catálogo ────────────────────────────────

  /**
   * Carga el catálogo de experiencias y lo que ya se exige para la posición abierta.
   *
   * <p>Las reglas de experiencia con alcance de posición son el perfil requerido: el servidor ya las
   * evalúa al asignar y al publicar. Aquí sólo se enseñan y se editan.</p>
   */
  private loadPositionSkills(idPosition: string | null): void {
    const org = this.selectedOrganizationId();
    this.positionSkillRequirements.set([]);
    this.pendingPositionSkills.set([]);

    if (!org) return;

    this.read(this.catalogApi.listItems(org, 'Skill'), 2, (items) =>
      this.catalogSkills.set(
        items
          .filter((item) => item.active)
          .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
      ),
    );

    if (!idPosition) return;

    this.read(this.catalogApi.listEligibilityRequirements(org), 2, (requirements) =>
      this.positionSkillRequirements.set(
        requirements.filter(
          (requirement) =>
            requirement.active &&
            requirement.requirementType === 'Skill' &&
            requirement.targetType === 'Position' &&
            requirement.idPosition === idPosition,
        ),
      ),
    );
  }

  /**
   * Los patrones del catálogo, para el desplegable.
   *
   * <p>Se piden al abrir el modal y no al entrar a la pantalla: la mayoría de las visitas a
   * Servicios no abre una posición, y pedirlos siempre sería una consulta por visita que nadie
   * mira.</p>
   */
  private loadShiftPatternTemplates(): void {
    const org = this.selectedOrganizationId();
    if (!org) return;

    this.read(this.catalogApi.listShiftPatternTemplateOptions(org), 2, (opciones) =>
      this.shiftPatternTemplates.set(opciones),
    );
    this.loadShiftPatternTemplateDetails();
  }

  /**
   * Los días de cada plantilla, que son los que pinta el calendario de la posición.
   *
   * <p><b>Se piden con las posiciones, no al abrir el editor.</b> Estaban dentro de
   * <c>loadShiftPatternTemplates</c>, que sólo corre al abrir «Nueva posición» o «Editar»: entrar a
   * la pestaña dejaba la lista vacía, así que <c>selectedPositionTemplate()</c> devolvía nulo y el
   * calendario afirmaba «esta posición no tiene patrón del catálogo» sobre una que sí lo tenía.
   * Había que entrar al editor y salir —o recargar— para que apareciera.</p>
   *
   * <p>El desplegable sigue siendo perezoso, y ahí el razonamiento original se mantiene: sale de
   * <c>/options</c>, sólo lo mira quien abre el editor, y la mayoría de las visitas no lo abre.
   * Estos días son otra cosa: se ven nada más entrar.</p>
   *
   * <p>Con las inactivas incluidas: una posición puede seguir apuntando a una plantilla retirada, y
   * el calendario tiene que poder decir qué horario está siguiendo hoy.</p>
   */
  private loadShiftPatternTemplateDetails(): void {
    const org = this.selectedOrganizationId();
    if (!org) return;

    this.read(this.catalogApi.listShiftPatternTemplates(org, true), 2, (plantillas) =>
      this.shiftPatternTemplateDetails.set(plantillas),
    );
  }

  /** La etiqueta de un patrón en el desplegable: el nombre, y el ciclo y las horas al lado. */
  protected patronEtiqueta(patron: ShiftPatternTemplateOption): string {
    const exceso = patron.compliance === 'Exceeds' ? ` · excede por ${patron.excessHours} h` : '';
    return `${patron.name} · ${shiftDaypartLabel(patron.daypart)} · ${cycleLabel(patron.cycleDays)} · promedio ${patron.weeklyHours} h/semana${exceso}`;
  }

  /**
   * La longitud del ciclo, con las mismas palabras que el catálogo.
   *
   * <p>Salen de <c>cycleLabel</c> y <c>cyclePhrase</c>, compartidas con la pantalla de patrones.
   * Escritas aparte se separaron: allá decía «Semanal» y aquí «ciclo de 7 días».</p>
   */
  /**
   * Cómo se rotula cada día del calendario del patrón.
   *
   * <p><b>Con ciclo de siete días son los días de la semana; con cualquier otro, «Día N».</b> No es
   * una concesión: un ciclo de seis días no encaja con la semana —el día 1 cae lunes una semana y
   * domingo la siguiente—, así que llamarlo «lunes» afirmaría algo que el patrón no dice. Es la
   * misma función que usa la pantalla de Catálogos, para que los dos sitios digan lo mismo.</p>
   */
  protected diaDelCiclo(dayNumber: number, cycleDays: number): string {
    return cycleDayLabel(dayNumber, cycleDays);
  }

  /** Si el ciclo no cuadra con la semana, hay que decirlo donde se ven los días. */
  protected cicloNoEsSemanal(cycleDays: number): boolean {
    return cycleDays !== 7;
  }

  protected cicloTexto(cycleDays: number): string {
    return cycleLabel(cycleDays);
  }

  protected cicloEnFrase(cycleDays: number): string {
    return cyclePhrase(cycleDays);
  }

  /**
   * El patrón elegido, para explicar debajo del control qué implica.
   *
   * <p>Sale de una señal y no del control porque un `FormControl` no es reactivo para las señales:
   * leerlo desde un `computed` dejaba el texto congelado en el primer patrón elegido.</p>
   */
  protected readonly selectedShiftPatternTemplate = computed(() =>
    this.shiftPatternTemplates().find(
      (patron) => patron.idShiftPatternTemplate === this.selectedShiftPatternTemplateId(),
    ),
  );

  protected readonly selectedShiftPatternTemplateId = signal('');

  /** El patrón se elige aquí para que el texto de abajo siga al control. */
  protected elegirPatronDeTurno(idShiftPatternTemplate: string): void {
    this.selectedShiftPatternTemplateId.set(idShiftPatternTemplate);
    this.positionForm.controls.idShiftPatternTemplate.setValue(idShiftPatternTemplate);
  }

  /**
   * Suma una experiencia al perfil.
   *
   * <p>Si la posición ya existe, la regla se crea de inmediato: es un hecho sobre la posición, no
   * un borrador del formulario, y esperar al guardado dejaría al usuario sin saber si quedó. Si la
   * posición todavía no existe, se anota y se crea al guardarla.</p>
   */
  protected addPositionSkill(request: PositionSkillRequest): void {
    const org = this.selectedOrganizationId();
    const position = this.editingPosition();

    if (!org || !this.allowWrite(true)) return;

    if (!position) {
      this.pendingPositionSkills.update((valores) =>
        valores.some((item) => item.idSkillCatalogItem === request.idSkillCatalogItem)
          ? valores
          : [...valores, request],
      );
      return;
    }

    this.saving.set(true);
    this.catalogApi
      .createEligibilityRequirement(this.reglaDeExperiencia(org, position.idPosition, request))
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (creada) => {
          this.positionSkillRequirements.update((valores) => [...valores, creada]);
          this.message.set(`«${request.name}» se pide para esta posición.`);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  /** Desactiva la regla, nunca la borra: el perfil de ayer explica las asignaciones de ayer. */
  protected removePositionSkill(idEligibilityRequirement: string): void {
    const org = this.selectedOrganizationId();

    if (!org || !this.allowWrite(true)) return;

    this.saving.set(true);
    this.catalogApi
      .deactivateEligibilityRequirement(org, idEligibilityRequirement)
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.positionSkillRequirements.update((valores) =>
            valores.filter((item) => item.idEligibilityRequirement !== idEligibilityRequirement),
          );
          this.message.set('La experiencia ya no se pide para esta posición.');
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected removePendingPositionSkill(idSkillCatalogItem: string): void {
    this.pendingPositionSkills.update((valores) =>
      valores.filter((item) => item.idSkillCatalogItem !== idSkillCatalogItem),
    );
  }

  // `createSkillForProfile` se retiro el 24 de septiembre de 2026 con el enlace que lo llamaba.
  // Crear una experiencia del catalogo se hace en Catalogos; aqui la posicion solo elige de lo que
  // ya existe. El endpoint sigue estando, asi que devolverlo es volver a engancharlo.

  /**
   * Crea las reglas que quedaron esperando a que la posición existiera.
   *
   * <p>Si alguna falla no se deshace la posición: ya está creada y es correcta. Se dice cuáles no
   * quedaron, para que se puedan volver a poner desde la ficha.</p>
   */
  private savePendingPositionSkills(idPosition: string): void {
    const org = this.selectedOrganizationId();
    const pendientes = this.pendingPositionSkills();

    if (!org || pendientes.length === 0) return;

    this.pendingPositionSkills.set([]);

    for (const pendiente of pendientes) {
      this.catalogApi
        .createEligibilityRequirement(this.reglaDeExperiencia(org, idPosition, pendiente))
        .pipe(this.withScope(2))
        .subscribe({
          error: () =>
            this.error.set(
              `La posición se creó, pero «${pendiente.name}» no quedó como experiencia exigida. `
              + 'Vuelve a agregarla desde la ficha de la posición.',
            ),
        });
    }
  }

  private reglaDeExperiencia(
    idOrganization: string,
    idPosition: string,
    request: PositionSkillRequest,
  ): EligibilityRequirementInput {
    return {
      idOrganization,
      targetType: 'Position',
      idClient: null,
      idService: null,
      idPosition,
      requirementType: 'Skill',
      idRequiredCatalogItem: request.idSkillCatalogItem,
      requiredDocumentType: null,
      requiredEvaluationType: null,
      name: request.name,
      description: null,
    };
  }

  protected savePosition(): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    this.problem.set(null);
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.positionForm.invalid) {
      this.positionForm.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios, los límites y la vigencia.');
      return;
    }

    const form = this.positionForm.getRawValue();
    const input: ServicePositionInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idService: service.idService,
      name: form.name,
      requiredWorkerCount: Number(form.requiredWorkerCount),
      price: Number(form.price),
      priceFrequency: form.priceFrequency,
      currencyCode: 'MXN',
      isTaxIncluded: form.isTaxIncluded,
      idShiftPatternTemplate: form.idShiftPatternTemplate || null,
      idSexCatalogItem: form.idSexCatalogItem || null,
      idAgeRangeCatalogItem: form.idAgeRangeCatalogItem || null,
      idEducationLevelCatalogItem: form.idEducationLevelCatalogItem || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      // Siempre viaja, incluso vacío: este formulario sí edita el equipo, así que una lista vacía
      // aquí quiere decir «ya no pide ninguno» y no «no vengo a tocarlo».
      idRequiredEquipmentCatalogItems: this.selectedEquipment(),
      requiredSkillProfile: this.optional(form.requiredSkillProfile),
      notes: this.optional(form.notes),
    };
    const editing = this.editingPosition();
    const request = editing
      ? this.api.updatePosition(client.idClient, service.idService, editing.idPosition, input)
      : this.api.createPosition(client.idClient, service.idService, {
          ...input,
          // Sin codigo: lo genera el servidor como P-01, consecutivo por servicio.
        } satisfies CreateServicePosition);

    this.saving.set(true);
    request
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (position) => {
          this.saving.set(false);
          this.positionEditorOpen.set(false);
          this.message.set(
            editing ? 'Posición actualizada correctamente.' : 'Posición creada correctamente.',
          );
          this.selectedPosition.set(position);
          this.savePendingPositionSkills(position.idPosition);

          // Al editar, comprobar a quien ya esta asignado contra el perfil que acaba de quedar.
          if (editing) {
            this.revisarAsignadosTrasEditar(position.idPosition);
          }
          // Ficha y listado, los dos.
          //
          // El panel se refrescaba solo, y de la lista salen los contadores de la fila —Posiciones,
          // Req./Asig.— y tambien la cuenta de vacantes de la pestaña, que se calcula sobre datos
          // del detalle. Refrescar la mitad dejaba dos numeros distintos sobre el mismo servicio,
          // uno al lado del otro. Son cuatro defectos reportados y una sola causa.
          this.refrescarFichaYListado(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivatePosition(position: ServicePosition): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    this.problem.set(null);
    const client = this.selectedClient();
    const service = this.selectedService();
    if (
      !client ||
      !service ||
      !window.confirm(`¿Deseas desactivar la posición ${position.name}?`)
    ) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivatePosition(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
      )
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Posición desactivada correctamente.');
          if (this.selectedPosition()?.idPosition === position.idPosition) {
            this.selectedPosition.set(null);
          }
          // Ficha y listado, los dos.
          //
          // El panel se refrescaba solo, y de la lista salen los contadores de la fila —Posiciones,
          // Req./Asig.— y tambien la cuenta de vacantes de la pestaña, que se calcula sobre datos
          // del detalle. Refrescar la mitad dejaba dos numeros distintos sobre el mismo servicio,
          // uno al lado del otro. Son cuatro defectos reportados y una sola causa.
          this.refrescarFichaYListado(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected money(value: number, currencyCode: string): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode }).format(
      value,
    );
  }

  protected durationLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
  }

  protected assignmentTypeLabel(value: ServiceAssignmentType): string {
    return this.assignmentTypes.find((item) => item.value === value)?.label ?? 'Asignación';
  }

  private optional(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private optionalDate(value: string): string | null {
    return this.optional(value);
  }

  private dateOnly(value: string | null): string {
    return value?.slice(0, 10) ?? '';
  }

  private today(): string {
    // El día operativo lo dice el servidor. Calcularlo aquí con `toISOString()` daba el día UTC:
    // a las 19:00 hora de Ciudad de México del 4 de septiembre devolvía el 5, y la pantalla
    // proponía el día siguiente todas las tardes. Es el mismo defecto que el reloj operativo
    // cerró en el servidor. Cadena vacía mientras no se sabe: vacío se nota, un día equivocado no.
    return this.systemInfo.operationDate();
  }

  private toApiTime(value: string): string {
    return value.length === 5 ? `${value}:00` : value;
  }

  /**
   * El error del servidor, con dos casos que no son «algo salió mal».
   *
   * <p><b>409 de concurrencia.</b> El servidor construye el mensaje con la bitácora y dice quién
   * corrigió el registro y cuándo. Se muestra aparte, con la salida que corresponde —volver a
   * cargar—, porque no se arregla reintentando: hay que ver qué cambió la otra persona.</p>
   *
   * <p><b>Motivo obligatorio.</b> Cuando la regla del servidor lo exige, se abre el campo. Va
   * vacío: un motivo prellenado deja de ser un motivo.</p>
   */
  private setError(error: HttpErrorResponse): void {
    const title =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)['title']
        : null;

    // `readServerProblem` pone lo específico por delante de lo genérico: si el servidor dijo qué
    // campo falló, eso es lo que se lee arriba en vez de «La solicitud contiene datos inválidos».
    const problema = readServerProblem(error, 'No fue posible completar la operación.');
    this.problem.set(problema);
    const mensaje = problema.message;

    // **No todo 409 es concurrencia.** Un código repetido también lo es, y se arregla cambiando el
    // código. El de concurrencia no se arregla reintentando, y el servidor lo distingue por el
    // título justo para que aquí se pueda ofrecer la salida correcta.
    if (error.status === 409 && title === 'Conflicto de concurrencia') {
      // **Se cierra el editor.** Lo que hay dentro es la versión vieja, y dejarlo abierto invita a
      // volver a guardar lo mismo. Además el diálogo taparía el aviso, que es lo único que aquí
      // sirve: ver qué cambió la otra persona.
      this.assignmentEditorOpen.set(false);
      this.conflict.set(mensaje);
      return;
    }

    // Red de seguridad: si el servidor pide motivo por un caso que aquí no se previó, el campo
    // aparece igual. Se mira también el detalle de los campos, porque en una validación el
    // «motivo» viaja ahí y no en el mensaje de cabecera.
    if (/motivo/i.test(mensaje) || /motivo/i.test(JSON.stringify(error.error ?? ''))) {
      this.motivoExigidoPorElServidor.set(true);
    }

    this.error.set(mensaje);
  }

  /** Vuelve a leer la configuración para quedarse con el token bueno y el valor de la otra persona. */
  protected reloadAfterConflict(): void {
    this.conflict.set('');
    this.correctionReason.set('');
    this.motivoExigidoPorElServidor.set(false);
  }
}
