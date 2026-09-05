import { HttpErrorResponse } from '@angular/common/http';
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
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  Client,
  ClientSite,
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
  ServiceConfiguration,
  ServiceConfigurationInput,
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
import { AppIcon } from '../../../../shared/ui/app-icon/app-icon';
import { dateRangeValidator, shiftIntervalValidator } from '../../ui/service-validators';

@Component({
  selector: 'app-services-page',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, ServiceDialog, EntityDocuments, AppIcon],
  templateUrl: './services-page.html',
  styleUrl: './services-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage implements OnInit, OnDestroy {
  private readonly api = inject(ClientApiService);
  private readonly contextApi = inject(ServiceContextApi);
  private readonly route = inject(ActivatedRoute);
  private pendingServiceLink = '';
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);
  private readonly formBuilder = inject(FormBuilder);
  // A parent selection invalidates all requests below it.
  private readonly scopeChanges = new Subject<number>();
  private readonly destroyed = new Subject<void>();
  private readonly clientSearchChanges = new Subject<void>();
  /** La organización de trabajo la fija la barra de contexto, y sólo ella. */
  protected readonly selectedOrganizationId = this.auth.operationalOrganizationId;
  protected readonly selectedClient = signal<Client | null>(null);
  protected readonly selectedService = signal<ManagedService | null>(null);
  protected readonly selectedPosition = signal<ServicePosition | null>(null);
  protected readonly selectedShiftPattern = signal<ShiftPattern | null>(null);
  protected readonly sites = signal<readonly ClientSite[]>([]);
  protected readonly hasActiveSite = computed(() => this.sites().some((site) => site.active));
  protected readonly hasActivePosition = computed(() =>
    this.positions().some((position) => position.active),
  );
  protected readonly contracts = signal<readonly ServiceContract[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly configurations = signal<readonly ServiceConfiguration[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly shiftPatterns = signal<readonly ShiftPattern[]>([]);
  protected readonly shiftSegments = signal<readonly ShiftSegment[]>([]);
  protected readonly assignments = signal<readonly ServiceAssignment[]>([]);
  protected readonly activeEmployees = signal<readonly Employee[]>([]);
  protected readonly result = signal<PagedResult<Client>>({
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
  protected readonly message = signal('');
  protected readonly clientSearch = signal('');
  protected readonly search = signal('');
  protected readonly status = signal('all');
  protected readonly activeTab = signal('configuration');
  protected readonly tabs = [
    { value: 'configuration', label: 'Configuraciones' },
    { value: 'positions', label: 'Posiciones y turnos' },
    { value: 'assignments', label: 'Asignaciones' },
    { value: 'documents', label: 'Documentos' },
  ];
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
  protected readonly canWriteClients = computed(
    () =>
      this.canRead() &&
      this.auth.hasPermission('CLIENTS.WRITE') &&
      !!this.auth.activeOrganization() &&
      !!this.selectedClient()?.active,
  );
  protected readonly canWritePlanning = computed(
    () =>
      this.canReadPlanning() &&
      this.auth.hasPermission('PLANNING.WRITE') &&
      !!this.auth.activeOrganization() &&
      !!this.selectedClient()?.active &&
      !!this.selectedService()?.active,
  );
  protected readonly visibleServices = computed(() => {
    const search = this.search().trim().toLocaleLowerCase();
    return this.services().filter(
      (s) =>
        (this.status() === 'all' || (this.status() === 'active') === s.active) &&
        [s.codeService, s.name, s.clientSiteName ?? '', s.serviceContractCode ?? ''].some((v) =>
          v.toLocaleLowerCase().includes(search),
        ),
    );
  });
  protected readonly clientOptions = computed(() => {
    const selected = this.selectedClient();
    return selected && !this.result().items.some((c) => c.idClient === selected.idClient)
      ? [selected, ...this.result().items]
      : this.result().items;
  });
  protected readonly selectedClientName = computed(() => this.selectedClient()?.legalName ?? '');
  protected readonly selectedServiceName = computed(() => this.selectedService()?.name ?? '');
  protected readonly selectedPositionName = computed(() => this.selectedPosition()?.name ?? '');
  protected readonly selectedShiftPatternName = computed(
    () => this.selectedShiftPattern()?.name ?? '',
  );
  protected readonly serviceWizardStep = signal(1);
  protected readonly serviceEditorOpen = signal(false);
  protected readonly editingService = signal<ManagedService | null>(null);
  protected readonly configurationEditorOpen = signal(false);
  protected readonly editingConfiguration = signal<ServiceConfiguration | null>(null);
  protected readonly positionEditorOpen = signal(false);
  protected readonly editingPosition = signal<ServicePosition | null>(null);
  protected readonly shiftPatternEditorOpen = signal(false);
  protected readonly editingShiftPattern = signal<ShiftPattern | null>(null);
  protected readonly shiftSegmentEditorOpen = signal(false);
  protected readonly editingShiftSegment = signal<ShiftSegment | null>(null);
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
    this.clientSearchChanges.complete();
  }

  /**
   * Carga la pantalla para la organización que dice la barra de contexto. Antes esto también
   * vaciaba una docena de señales, porque la organización podía cambiar con la pantalla abierta;
   * ya no hace falta: el shell la vuelve a montar cuando la organización cambia.
   */
  private loadForActiveOrganization(): void {
    if (this.selectedOrganizationId()) {
      // El cliente enlazado lo trae la suscripción a los parámetros de la URL, que ya corre con
      // la organización puesta. Pedirlo también aquí lo pediría dos veces.
      this.loadClients();
    }
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
    this.sites.set([]);
    this.contracts.set([]);
    this.clearServiceDetail();
    this.pendingServiceLink = params.get('serviceId') ?? '';
    const org = this.selectedOrganizationId();
    this.read(this.contextApi.getClient(org, clientId), 1, (client) => {
      if (client.idOrganization !== org) {
        this.error.set('El cliente no pertenece a la organización seleccionada.');
        return;
      }
      this.selectedClient.set(client);
      this.loadClientDetail(client);
    });
  }

  protected loadClients(page = 1): void {
    if (!this.canRead()) return;
    this.clientSearchChanges.next();
    this.read(
      this.api
        .listClients(this.selectedOrganizationId(), this.clientSearch(), page, 20)
        .pipe(takeUntil(this.clientSearchChanges)),
      0,
      (result) => this.result.set(result),
    );
  }

  protected selectClient(id: string): void {
    if (this.saving() || !this.canRead()) return;
    const client = this.clientOptions().find((c) => c.idClient === id) ?? null;
    this.scopeChanges.next(1);
    this.pendingServiceLink = '';
    this.closeEditors();
    this.selectedClient.set(client);
    this.selectedService.set(null);
    this.services.set([]);
    this.sites.set([]);
    this.contracts.set([]);
    this.clearServiceDetail();
    this.search.set('');
    this.status.set('all');
    this.error.set('');
    this.message.set('');
    if (client) this.loadClientDetail(client);
  }

  protected loadClientDetail(client = this.selectedClient()): void {
    if (!client || !this.canRead()) return;
    this.scopeChanges.next(1);
    const org = this.selectedOrganizationId();
    this.read(
      forkJoin({
        services: this.api.listServices(org, client.idClient),
        sites: this.api.listSites(org, client.idClient),
        contracts: this.api.listContracts(org, client.idClient),
      }),
      1,
      (data) => {
        this.services.set(data.services);
        this.sites.set(data.sites);
        this.contracts.set(data.contracts);
        const linkedService = this.pendingServiceLink;
        this.pendingServiceLink = '';
        const current = data.services.find(
          (s) => s.idService === (linkedService || this.selectedService()?.idService),
        );
        if (current) this.selectService(current);
        else {
          this.selectedService.set(null);
          this.clearServiceDetail();
        }
        if (linkedService && !current)
          this.error.set('El servicio solicitado no está disponible para este cliente.');
      },
    );
  }

  protected selectService(service: ManagedService): void {
    if (this.saving() || !this.canRead()) return;
    this.scopeChanges.next(2);
    this.closeEditors();
    this.selectedService.set(service);
    this.clearServiceDetail();
    this.loadConfigurations(service);
    if (this.canReadPlanning()) {
      this.loadPositions(service);
      this.loadAssignments(service);
      this.loadActiveEmployees();
    }
  }

  private clearServiceDetail(): void {
    this.activeEmployees.set([]);
    this.configurations.set([]);
    this.positions.set([]);
    this.assignments.set([]);
    this.selectedPosition.set(null);
    this.selectedShiftPattern.set(null);
    this.shiftPatterns.set([]);
    this.shiftSegments.set([]);
  }

  protected refresh(): void {
    if (this.saving()) return;
    this.error.set('');
    if (this.selectedClient()) this.loadClientDetail();
    else this.loadClients();
  }

  protected loadConfigurations(service = this.selectedService()): void {
    const client = this.selectedClient();
    if (!client || !service || !this.canRead()) return;
    this.read(
      this.api.listServiceConfigurations(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
      ),
      2,
      (rows) =>
        this.configurations.set(
          [...rows].sort((a, b) => b.effectiveFromDate.localeCompare(a.effectiveFromDate)),
        ),
    );
  }

  protected loadPositions(service = this.selectedService()): void {
    const client = this.selectedClient();
    if (!client || !service || !this.canReadPlanning()) return;
    this.read(
      this.api.listPositions(this.selectedOrganizationId(), client.idClient, service.idService),
      2,
      (rows) => {
        this.positions.set(rows);
        const position =
          rows.find((p) => p.idPosition === this.selectedPosition()?.idPosition) ?? rows[0];
        if (position) this.selectPosition(position);
        else {
          this.selectedPosition.set(null);
          this.selectedShiftPattern.set(null);
          this.shiftPatterns.set([]);
          this.shiftSegments.set([]);
        }
      },
    );
  }

  protected selectPosition(position: ServicePosition): void {
    if (this.saving()) return;
    this.scopeChanges.next(3);
    this.selectedPosition.set(position);
    this.selectedShiftPattern.set(null);
    this.shiftPatterns.set([]);
    this.shiftSegments.set([]);
    this.loadShiftPatterns(position);
  }

  protected loadShiftPatterns(position = this.selectedPosition()): void {
    const client = this.selectedClient(),
      service = this.selectedService();
    if (!client || !service || !position || !this.canReadPlanning()) return;
    this.read(
      this.api.listShiftPatterns(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
      ),
      3,
      (rows) => {
        this.shiftPatterns.set(rows);
        const pattern =
          rows.find((p) => p.idShiftPattern === this.selectedShiftPattern()?.idShiftPattern) ??
          rows[0];
        if (pattern) this.selectShiftPattern(pattern);
        else {
          this.selectedShiftPattern.set(null);
          this.shiftSegments.set([]);
        }
      },
    );
  }

  protected selectShiftPattern(pattern: ShiftPattern): void {
    if (this.saving()) return;
    this.scopeChanges.next(4);
    this.selectedShiftPattern.set(pattern);
    this.shiftSegments.set([]);
    this.loadShiftSegments(pattern);
  }

  protected loadShiftSegments(pattern = this.selectedShiftPattern()): void {
    const client = this.selectedClient(),
      service = this.selectedService(),
      position = this.selectedPosition();
    if (!client || !service || !position || !pattern || !this.canReadPlanning()) return;
    this.read(
      this.api.listShiftSegments(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
        pattern.idShiftPattern,
      ),
      4,
      (rows) => this.shiftSegments.set(rows),
    );
  }

  protected loadAssignments(service = this.selectedService()): void {
    const client = this.selectedClient();
    if (!client || !service || !this.canReadPlanning()) return;
    this.read(
      this.api.listAssignments(this.selectedOrganizationId(), client.idClient, service.idService),
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
    this.configurationEditorOpen.set(false);
    this.positionEditorOpen.set(false);
    this.shiftPatternEditorOpen.set(false);
    this.shiftSegmentEditorOpen.set(false);
    this.assignmentEditorOpen.set(false);
    this.error.set('');
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

  protected readonly assignmentTypes: readonly { value: ServiceAssignmentType; label: string }[] = [
    { value: 'Primary', label: 'Principal' },
    { value: 'Support', label: 'Apoyo' },
    { value: 'Relief', label: 'Relevo' },
    { value: 'TemporaryReplacement', label: 'Sustitución temporal' },
  ];

  protected readonly serviceForm = this.formBuilder.nonNullable.group(
    {
      codeService: ['', [Validators.required, Validators.maxLength(30)]],
      idClientSite: ['', [Validators.required]],
      idServiceContract: [''],
      name: ['', [Validators.required, Validators.maxLength(160)]],
      description: ['', [Validators.required, Validators.maxLength(1000)]],
      invoiceDescription: ['', [Validators.maxLength(300)]],
      startDate: ['', [Validators.required]],
      endDate: [''],
    },
    { validators: dateRangeValidator('startDate', 'endDate') },
  );

  protected readonly configurationForm = this.formBuilder.nonNullable.group(
    {
      effectiveFromDate: ['', [Validators.required]],
      effectiveToDate: [''],
      requiredWorkerCount: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
      hoursPerDay: [8, [Validators.required, Validators.min(0.5), Validators.max(24)]],
      daysPerWeek: [6, [Validators.required, Validators.min(1), Validators.max(7)]],
      averageMonthlyHours: [208, [Validators.required, Validators.min(1), Validators.max(744)]],
      preparationLeadDays: [7, [Validators.required, Validators.min(0), Validators.max(365)]],
      workScheduleDescription: ['', [Validators.required, Validators.maxLength(500)]],
      specificInstructions: ['', [Validators.maxLength(2000)]],
      monthlyPrice: [0, [Validators.required, Validators.min(0)]],
      currencyCode: ['MXN', [Validators.required, Validators.maxLength(3)]],
      isTaxIncluded: [false],
    },
    { validators: dateRangeValidator('effectiveFromDate', 'effectiveToDate') },
  );

  protected readonly positionForm = this.formBuilder.nonNullable.group({
    codePosition: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    requiredWorkerCount: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    requiredSkillProfile: ['', [Validators.maxLength(1000)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly shiftPatternForm = this.formBuilder.nonNullable.group(
    {
      codeShiftPattern: ['', [Validators.required, Validators.maxLength(40)]],
      name: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.maxLength(1000)]],
      effectiveFromDate: ['', [Validators.required]],
      effectiveToDate: [''],
    },
    { validators: dateRangeValidator('effectiveFromDate', 'effectiveToDate') },
  );

  protected readonly shiftSegmentForm = this.formBuilder.nonNullable.group(
    {
      dayOfWeek: ['Monday', [Validators.required]],
      startTime: ['08:00', [Validators.required]],
      endTime: ['16:00', [Validators.required]],
      isOvernight: [false],
      requiredWorkerCount: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
      notes: ['', [Validators.maxLength(1000)]],
    },
    { validators: shiftIntervalValidator },
  );

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

  protected openCreateService(): void {
    if (!this.allowWrite(false)) return;
    this.closeEditors();
    this.error.set('');
    if (!this.selectedClient() || !this.sites().some((s) => s.active)) {
      return;
    }

    this.editingService.set(null);
    this.serviceWizardStep.set(1);
    this.serviceForm.reset({
      codeService: '',
      idClientSite: this.sites().find((s) => s.active)?.idClientSite ?? '',
      idServiceContract: '',
      name: '',
      description: '',
      invoiceDescription: '',
      startDate: this.today(),
      endDate: '',
    });
    this.serviceEditorOpen.set(true);
  }

  protected openEditService(service: ManagedService): void {
    if (!this.allowWrite(false)) return;
    this.closeEditors();
    this.error.set('');
    this.editingService.set(service);
    this.serviceWizardStep.set(1);
    this.serviceForm.reset({
      codeService: service.codeService,
      idClientSite: service.idClientSite,
      idServiceContract: service.idServiceContract ?? '',
      name: service.name,
      description: service.description,
      invoiceDescription: service.invoiceDescription ?? '',
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
            this.serviceForm.controls.codeService,
            this.serviceForm.controls.idClientSite,
            this.serviceForm.controls.name,
          ]
        : [this.serviceForm.controls.description, this.serviceForm.controls.invoiceDescription];

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
      idClientSite: form.idClientSite,
      idServiceContract: this.optional(form.idServiceContract),
      name: form.name,
      description: form.description,
      invoiceDescription: this.optional(form.invoiceDescription),
      startDate: form.startDate,
      endDate: this.optionalDate(form.endDate),
    };
    const editing = this.editingService();
    const request = editing
      ? this.api.updateService(client.idClient, editing.idService, input)
      : this.api.createService(client.idClient, {
          ...input,
          codeService: form.codeService,
        } satisfies CreateManagedService);

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
          this.loadClientDetail(client);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivateService(service: ManagedService): void {
    if (!this.allowWrite(false)) return;
    this.error.set('');
    const client = this.selectedClient();
    if (!client || !window.confirm(`¿Deseas desactivar el servicio ${service.name}?`)) {
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
            this.configurations.set([]);
            this.positions.set([]);
            this.shiftPatterns.set([]);
            this.shiftSegments.set([]);
            this.selectedPosition.set(null);
            this.selectedShiftPattern.set(null);
          }
          this.loadClientDetail(client);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateAssignment(): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    if (!this.selectedClient() || !this.selectedService() || !this.positions().length) {
      return;
    }

    if (!this.canReadEmployees() || !this.hasActivePosition()) return;
    this.assignmentForm.controls.idEmployee.enable();
    this.editingAssignment.set(null);
    this.assignmentForm.reset({
      idEmployee: this.activeEmployees()[0]?.idEmployee ?? '',
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
    this.assignmentEditorOpen.set(true);
  }

  protected openEditAssignment(assignment: ServiceAssignment): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
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
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.assignmentForm.invalid) {
      this.assignmentForm.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios, los límites y la vigencia.');
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
      ? this.api.updateAssignment(
          client.idClient,
          service.idService,
          editing.idServiceAssignment,
          input,
        )
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
          this.loadAssignments(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivateAssignment(assignment: ServiceAssignment): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
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
      )
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Asignación desactivada correctamente.');
          this.loadAssignments(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateConfiguration(): void {
    if (!this.allowWrite(false)) return;
    if (!this.selectedService()?.active) return;
    this.closeEditors();
    this.error.set('');
    if (!this.selectedClient() || !this.selectedService()) {
      return;
    }

    this.editingConfiguration.set(null);
    this.configurationForm.reset({
      effectiveFromDate: this.today(),
      effectiveToDate: '',
      requiredWorkerCount: 1,
      hoursPerDay: 8,
      daysPerWeek: 6,
      averageMonthlyHours: 208,
      preparationLeadDays: 7,
      workScheduleDescription: '',
      specificInstructions: '',
      monthlyPrice: 0,
      currencyCode: 'MXN',
      isTaxIncluded: false,
    });
    this.configurationEditorOpen.set(true);
  }

  protected openEditConfiguration(configuration: ServiceConfiguration): void {
    if (!this.allowWrite(false)) return;
    if (!this.selectedService()?.active) return;
    this.closeEditors();
    this.error.set('');
    this.editingConfiguration.set(configuration);
    this.configurationForm.reset({
      effectiveFromDate: this.dateOnly(configuration.effectiveFromDate),
      effectiveToDate: this.dateOnly(configuration.effectiveToDate),
      requiredWorkerCount: configuration.requiredWorkerCount,
      hoursPerDay: configuration.hoursPerDay,
      daysPerWeek: configuration.daysPerWeek,
      averageMonthlyHours: configuration.averageMonthlyHours,
      preparationLeadDays: configuration.preparationLeadDays,
      workScheduleDescription: configuration.workScheduleDescription,
      specificInstructions: configuration.specificInstructions ?? '',
      monthlyPrice: configuration.monthlyPrice,
      currencyCode: configuration.currencyCode,
      isTaxIncluded: configuration.isTaxIncluded,
    });
    this.configurationEditorOpen.set(true);
  }

  protected saveConfiguration(): void {
    if (!this.allowWrite(false)) return;
    if (!this.selectedService()?.active) return;
    this.error.set('');
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.configurationForm.invalid) {
      this.configurationForm.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios, los límites y la vigencia.');
      return;
    }

    const form = this.configurationForm.getRawValue();
    const input: ServiceConfigurationInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idService: service.idService,
      effectiveFromDate: form.effectiveFromDate,
      effectiveToDate: this.optionalDate(form.effectiveToDate),
      requiredWorkerCount: Number(form.requiredWorkerCount),
      hoursPerDay: Number(form.hoursPerDay),
      daysPerWeek: Number(form.daysPerWeek),
      averageMonthlyHours: Number(form.averageMonthlyHours),
      preparationLeadDays: Number(form.preparationLeadDays),
      workScheduleDescription: form.workScheduleDescription,
      specificInstructions: this.optional(form.specificInstructions),
      monthlyPrice: Number(form.monthlyPrice),
      currencyCode: this.optional(form.currencyCode),
      isTaxIncluded: form.isTaxIncluded,
    };
    const editing = this.editingConfiguration();
    const request = editing
      ? this.api.updateServiceConfiguration(
          client.idClient,
          service.idService,
          editing.idServiceConfiguration,
          input,
        )
      : this.api.createServiceConfiguration(client.idClient, service.idService, input);

    this.saving.set(true);
    request
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.configurationEditorOpen.set(false);
          this.message.set(
            editing
              ? 'Configuración actualizada correctamente.'
              : 'Configuración creada correctamente.',
          );
          this.loadConfigurations(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivateConfiguration(configuration: ServiceConfiguration): void {
    if (!this.allowWrite(false)) return;
    if (!this.selectedService()?.active) return;
    this.error.set('');
    const client = this.selectedClient();
    const service = this.selectedService();
    if (
      !client ||
      !service ||
      !window.confirm('¿Deseas desactivar esta configuración de servicio?')
    ) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivateServiceConfiguration(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        configuration.idServiceConfiguration,
      )
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Configuración desactivada correctamente.');
          this.loadConfigurations(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreatePosition(): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    if (!this.selectedClient() || !this.selectedService()) {
      return;
    }

    this.editingPosition.set(null);
    this.positionForm.reset({
      codePosition: '',
      name: '',
      requiredWorkerCount: 1,
      requiredSkillProfile: '',
      notes: '',
    });
    this.positionEditorOpen.set(true);
  }

  protected openEditPosition(position: ServicePosition): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    this.editingPosition.set(position);
    this.positionForm.reset({
      codePosition: position.codePosition,
      name: position.name,
      requiredWorkerCount: position.requiredWorkerCount,
      requiredSkillProfile: position.requiredSkillProfile ?? '',
      notes: position.notes ?? '',
    });
    this.positionEditorOpen.set(true);
  }

  protected savePosition(): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
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
      requiredSkillProfile: this.optional(form.requiredSkillProfile),
      notes: this.optional(form.notes),
    };
    const editing = this.editingPosition();
    const request = editing
      ? this.api.updatePosition(client.idClient, service.idService, editing.idPosition, input)
      : this.api.createPosition(client.idClient, service.idService, {
          ...input,
          codePosition: form.codePosition,
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
          this.loadPositions(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivatePosition(position: ServicePosition): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
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
            this.selectedShiftPattern.set(null);
            this.shiftPatterns.set([]);
            this.shiftSegments.set([]);
          }
          this.loadPositions(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateShiftPattern(): void {
    if (!this.allowWrite(true)) return;
    if (!this.selectedPosition()?.active) return;
    this.closeEditors();
    this.error.set('');
    if (!this.selectedClient() || !this.selectedService() || !this.selectedPosition()) {
      return;
    }

    this.editingShiftPattern.set(null);
    this.shiftPatternForm.reset({
      codeShiftPattern: '',
      name: '',
      description: '',
      effectiveFromDate: this.today(),
      effectiveToDate: '',
    });
    this.shiftPatternEditorOpen.set(true);
  }

  protected openEditShiftPattern(pattern: ShiftPattern): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    this.editingShiftPattern.set(pattern);
    this.shiftPatternForm.reset({
      codeShiftPattern: pattern.codeShiftPattern,
      name: pattern.name,
      description: pattern.description ?? '',
      effectiveFromDate: this.dateOnly(pattern.effectiveFromDate),
      effectiveToDate: this.dateOnly(pattern.effectiveToDate),
    });
    this.shiftPatternEditorOpen.set(true);
  }

  protected saveShiftPattern(): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    if (!client || !service || !position || this.shiftPatternForm.invalid) {
      this.shiftPatternForm.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios, los límites y la vigencia.');
      return;
    }

    const form = this.shiftPatternForm.getRawValue();
    const input: ShiftPatternInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idService: service.idService,
      idPosition: position.idPosition,
      name: form.name,
      description: this.optional(form.description),
      effectiveFromDate: form.effectiveFromDate,
      effectiveToDate: this.optionalDate(form.effectiveToDate),
    };
    const editing = this.editingShiftPattern();
    const request = editing
      ? this.api.updateShiftPattern(
          client.idClient,
          service.idService,
          position.idPosition,
          editing.idShiftPattern,
          input,
        )
      : this.api.createShiftPattern(client.idClient, service.idService, position.idPosition, {
          ...input,
          codeShiftPattern: form.codeShiftPattern,
        } satisfies CreateShiftPattern);

    this.saving.set(true);
    request
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (pattern) => {
          this.saving.set(false);
          this.shiftPatternEditorOpen.set(false);
          this.message.set(
            editing ? 'Patrón actualizado correctamente.' : 'Patrón creado correctamente.',
          );
          this.selectedShiftPattern.set(pattern);
          this.loadShiftPatterns(position);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivateShiftPattern(pattern: ShiftPattern): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    if (
      !client ||
      !service ||
      !position ||
      !window.confirm(`¿Deseas desactivar el patrón ${pattern.name}?`)
    ) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivateShiftPattern(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
        pattern.idShiftPattern,
      )
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Patrón desactivado correctamente.');
          if (this.selectedShiftPattern()?.idShiftPattern === pattern.idShiftPattern) {
            this.selectedShiftPattern.set(null);
            this.shiftSegments.set([]);
          }
          this.loadShiftPatterns(position);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateShiftSegment(): void {
    if (!this.allowWrite(true)) return;
    if (!this.selectedPosition()?.active || !this.selectedShiftPattern()?.active) return;
    this.closeEditors();
    this.error.set('');
    if (
      !this.selectedClient() ||
      !this.selectedService() ||
      !this.selectedPosition() ||
      !this.selectedShiftPattern()
    ) {
      return;
    }

    this.editingShiftSegment.set(null);
    this.shiftSegmentForm.reset({
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '16:00',
      isOvernight: false,
      requiredWorkerCount: this.selectedPosition()?.requiredWorkerCount ?? 1,
      notes: '',
    });
    this.shiftSegmentEditorOpen.set(true);
  }

  protected openEditShiftSegment(segment: ShiftSegment): void {
    if (!this.allowWrite(true)) return;
    this.closeEditors();
    this.error.set('');
    this.editingShiftSegment.set(segment);
    this.shiftSegmentForm.reset({
      dayOfWeek: segment.dayOfWeek,
      startTime: segment.startTime.slice(0, 5),
      endTime: segment.endTime.slice(0, 5),
      isOvernight: segment.isOvernight,
      requiredWorkerCount: segment.requiredWorkerCount,
      notes: segment.notes ?? '',
    });
    this.shiftSegmentEditorOpen.set(true);
  }

  protected saveShiftSegment(): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    const pattern = this.selectedShiftPattern();
    if (!client || !service || !position || !pattern || this.shiftSegmentForm.invalid) {
      this.shiftSegmentForm.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios, los límites y la vigencia.');
      return;
    }

    const form = this.shiftSegmentForm.getRawValue();
    const input: ShiftSegmentInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idService: service.idService,
      idPosition: position.idPosition,
      idShiftPattern: pattern.idShiftPattern,
      dayOfWeek: form.dayOfWeek,
      startTime: this.toApiTime(form.startTime),
      endTime: this.toApiTime(form.endTime),
      isOvernight: form.isOvernight,
      requiredWorkerCount: Number(form.requiredWorkerCount),
      notes: this.optional(form.notes),
    };
    const editing = this.editingShiftSegment();
    const request = editing
      ? this.api.updateShiftSegment(
          client.idClient,
          service.idService,
          position.idPosition,
          pattern.idShiftPattern,
          editing.idShiftSegment,
          input,
        )
      : this.api.createShiftSegment(
          client.idClient,
          service.idService,
          position.idPosition,
          pattern.idShiftPattern,
          input,
        );

    this.saving.set(true);
    request
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.shiftSegmentEditorOpen.set(false);
          this.message.set(
            editing ? 'Segmento actualizado correctamente.' : 'Segmento creado correctamente.',
          );
          this.loadShiftSegments(pattern);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected deactivateShiftSegment(segment: ShiftSegment): void {
    if (!this.allowWrite(true)) return;
    this.error.set('');
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    const pattern = this.selectedShiftPattern();
    if (
      !client ||
      !service ||
      !position ||
      !pattern ||
      !window.confirm('¿Deseas desactivar este segmento?')
    ) {
      return;
    }

    this.saving.set(true);
    this.api
      .deactivateShiftSegment(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
        pattern.idShiftPattern,
        segment.idShiftSegment,
      )
      .pipe(
        this.withScope(2),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Segmento desactivado correctamente.');
          this.loadShiftSegments(pattern);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected money(value: number, currencyCode: string): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode }).format(
      value,
    );
  }

  protected dayLabel(value: string): string {
    return this.weekDays.find((day) => day.value === value)?.label ?? 'Día no especificado';
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

  private setError(error: HttpErrorResponse): void {
    const detail =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)['detail']
        : null;
    this.error.set(typeof detail === 'string' ? detail : 'No fue posible completar la operación.');
  }
}
