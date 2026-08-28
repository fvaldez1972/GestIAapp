import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';
import { Employee } from '../../../workforce/data-access/workforce.models';
import { ClientApiService } from '../../data-access/client-api.service';
import {
  Client,
  ClientContact,
  ClientContactInput,
  ClientContactPurpose,
  ClientInput,
  ClientSite,
  ClientSiteInput,
  CreateClient,
  CreateClientSite,
  CreateManagedService,
  CreateServiceContract,
  CreateServicePosition,
  CreateServiceAssignment,
  CreateShiftPattern,
  ManagedService,
  ManagedServiceInput,
  Organization,
  PagedResult,
  ServiceAssignment,
  ServiceAssignmentInput,
  ServiceAssignmentType,
  ScheduledShift,
  ScheduledShiftInput,
  ScheduleVersion,
  ScheduleVersionInput,
  ScheduleVersionStatus,
  ServiceConfiguration,
  ServiceConfigurationInput,
  ServiceContract,
  ServiceContractInput,
  ServiceContractStatus,
  ServicePosition,
  ServicePositionInput,
  ShiftPattern,
  ShiftPatternInput,
  ShiftSegment,
  ShiftSegmentInput,
} from '../../data-access/client.models';

@Component({
  selector: 'app-clients-page',
  imports: [ReactiveFormsModule],
  templateUrl: './clients-page.html',
  styleUrl: './clients-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClient = signal<Client | null>(null);
  protected readonly sites = signal<readonly ClientSite[]>([]);
  protected readonly contacts = signal<readonly ClientContact[]>([]);
  protected readonly contracts = signal<readonly ServiceContract[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly configurations = signal<readonly ServiceConfiguration[]>([]);
  protected readonly positions = signal<readonly ServicePosition[]>([]);
  protected readonly shiftPatterns = signal<readonly ShiftPattern[]>([]);
  protected readonly shiftSegments = signal<readonly ShiftSegment[]>([]);
  protected readonly assignments = signal<readonly ServiceAssignment[]>([]);
  protected readonly scheduleVersions = signal<readonly ScheduleVersion[]>([]);
  protected readonly scheduledShifts = signal<readonly ScheduledShift[]>([]);
  protected readonly activeEmployees = signal<readonly Employee[]>([]);
  protected readonly selectedService = signal<ManagedService | null>(null);
  protected readonly selectedPosition = signal<ServicePosition | null>(null);
  protected readonly selectedShiftPattern = signal<ShiftPattern | null>(null);
  protected readonly selectedScheduleVersion = signal<ScheduleVersion | null>(null);
  protected readonly result = signal<PagedResult<Client>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  protected readonly loading = signal(false);
  protected readonly loadingDetail = signal(false);
  protected readonly saving = signal(false);
  protected readonly clientEditorOpen = signal(false);
  protected readonly siteEditorOpen = signal(false);
  protected readonly contactEditorOpen = signal(false);
  protected readonly contractEditorOpen = signal(false);
  protected readonly serviceEditorOpen = signal(false);
  protected readonly configurationEditorOpen = signal(false);
  protected readonly positionEditorOpen = signal(false);
  protected readonly shiftPatternEditorOpen = signal(false);
  protected readonly shiftSegmentEditorOpen = signal(false);
  protected readonly assignmentEditorOpen = signal(false);
  protected readonly scheduleVersionEditorOpen = signal(false);
  protected readonly scheduledShiftEditorOpen = signal(false);
  protected readonly organizationEditorOpen = signal(false);
  protected readonly editingClient = signal<Client | null>(null);
  protected readonly editingSite = signal<ClientSite | null>(null);
  protected readonly editingContact = signal<ClientContact | null>(null);
  protected readonly editingContract = signal<ServiceContract | null>(null);
  protected readonly editingService = signal<ManagedService | null>(null);
  protected readonly editingConfiguration = signal<ServiceConfiguration | null>(null);
  protected readonly editingPosition = signal<ServicePosition | null>(null);
  protected readonly editingShiftPattern = signal<ShiftPattern | null>(null);
  protected readonly editingShiftSegment = signal<ShiftSegment | null>(null);
  protected readonly editingAssignment = signal<ServiceAssignment | null>(null);
  protected readonly editingScheduleVersion = signal<ScheduleVersion | null>(null);
  protected readonly editingScheduledShift = signal<ScheduledShift | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly selectedClientName = computed(() => this.selectedClient()?.legalName ?? 'Sin cliente seleccionado');
  protected readonly selectedServiceName = computed(() => this.selectedService()?.name ?? 'Sin servicio seleccionado');
  protected readonly selectedPositionName = computed(() => this.selectedPosition()?.name ?? 'Sin posición seleccionada');
  protected readonly selectedShiftPatternName = computed(() => this.selectedShiftPattern()?.name ?? 'Sin patrón seleccionado');
  protected readonly selectedScheduleVersionName = computed(
    () => this.selectedScheduleVersion()?.name ?? 'Sin planeación seleccionada',
  );

  protected readonly contractStatuses: readonly { value: ServiceContractStatus; label: string }[] = [
    { value: 'Draft', label: 'Borrador' },
    { value: 'UnderReview', label: 'En revisión' },
    { value: 'Executed', label: 'Firmado' },
    { value: 'Effective', label: 'Vigente' },
    { value: 'Expired', label: 'Vencido' },
    { value: 'Terminated', label: 'Terminado' },
  ];

  protected readonly contactPurposes: readonly { value: ClientContactPurpose; label: string }[] = [
    { value: 'Operational', label: 'Operativo' },
    { value: 'Administrative', label: 'Administrativo' },
    { value: 'Billing', label: 'Facturación' },
    { value: 'Legal', label: 'Legal' },
    { value: 'Emergency', label: 'Emergencia' },
    { value: 'Payments', label: 'Pagos' },
    { value: 'Purchasing', label: 'Compras' },
    { value: 'InternalSecurity', label: 'Seguridad interna' },
  ];

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

  protected readonly scheduleStatuses: readonly { value: ScheduleVersionStatus; label: string }[] = [
    { value: 'Draft', label: 'Borrador' },
    { value: 'Published', label: 'Publicado' },
    { value: 'Superseded', label: 'Reemplazado' },
  ];

  protected readonly organizationForm = this.formBuilder.nonNullable.group({
    codeOrganization: ['', [Validators.required, Validators.maxLength(30)]],
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    rfc: ['', [Validators.maxLength(13)]],
  });

  protected readonly clientForm = this.formBuilder.nonNullable.group({
    codeClient: ['', [Validators.required, Validators.maxLength(30)]],
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    tradeName: ['', [Validators.maxLength(200)]],
    rfc: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(13)]],
    nationality: ['Mexicana', [Validators.maxLength(80)]],
    taxActivity: ['', [Validators.maxLength(300)]],
    taxAddress: ['', [Validators.maxLength(500)]],
    employerRegistrationNumber: ['', [Validators.maxLength(30)]],
  });

  protected readonly siteForm = this.formBuilder.nonNullable.group({
    codeClientSite: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    street: ['', [Validators.required, Validators.maxLength(200)]],
    exteriorNumber: ['', [Validators.maxLength(30)]],
    interiorNumber: ['', [Validators.maxLength(30)]],
    neighborhood: ['', [Validators.maxLength(120)]],
    municipality: ['', [Validators.required, Validators.maxLength(120)]],
    state: ['', [Validators.required, Validators.maxLength(120)]],
    postalCode: ['', [Validators.required, Validators.maxLength(10)]],
    countryCode: ['MX', [Validators.required, Validators.maxLength(2)]],
    accessInstructions: ['', [Validators.maxLength(1000)]],
    timeZoneId: ['America/Mexico_City', [Validators.maxLength(100)]],
  });

  protected readonly contactForm = this.formBuilder.nonNullable.group({
    idClientSite: [''],
    purpose: ['Operational' as ClientContactPurpose, [Validators.required]],
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    jobTitle: ['', [Validators.maxLength(120)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.maxLength(30)]],
    mobilePhone: ['', [Validators.maxLength(30)]],
    isPrimary: [false],
  });

  protected readonly contractForm = this.formBuilder.nonNullable.group({
    codeServiceContract: ['', [Validators.required, Validators.maxLength(30)]],
    status: ['Draft' as ServiceContractStatus, [Validators.required]],
    signedDate: [''],
    effectiveFromDate: ['', [Validators.required]],
    effectiveToDate: [''],
    paymentTermDays: [30, [Validators.required, Validators.min(0), Validators.max(365)]],
    terminationNoticeDays: [30, [Validators.required, Validators.min(0), Validators.max(365)]],
    currencyCode: ['MXN', [Validators.required, Validators.maxLength(3)]],
    documentReference: ['', [Validators.maxLength(500)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  protected readonly serviceForm = this.formBuilder.nonNullable.group({
    codeService: ['', [Validators.required, Validators.maxLength(30)]],
    idClientSite: ['', [Validators.required]],
    idServiceContract: [''],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
    invoiceDescription: ['', [Validators.maxLength(300)]],
    startDate: ['', [Validators.required]],
    endDate: [''],
  });

  protected readonly configurationForm = this.formBuilder.nonNullable.group({
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
  });

  protected readonly positionForm = this.formBuilder.nonNullable.group({
    codePosition: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    requiredWorkerCount: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    requiredSkillProfile: ['', [Validators.maxLength(1000)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly shiftPatternForm = this.formBuilder.nonNullable.group({
    codeShiftPattern: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(1000)]],
    effectiveFromDate: ['', [Validators.required]],
    effectiveToDate: [''],
  });

  protected readonly shiftSegmentForm = this.formBuilder.nonNullable.group({
    dayOfWeek: ['Monday', [Validators.required]],
    startTime: ['08:00', [Validators.required]],
    endTime: ['16:00', [Validators.required]],
    isOvernight: [false],
    requiredWorkerCount: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly assignmentForm = this.formBuilder.nonNullable.group({
    idEmployee: ['', [Validators.required]],
    idPosition: ['', [Validators.required]],
    assignmentType: ['Primary' as ServiceAssignmentType, [Validators.required]],
    startDate: ['', [Validators.required]],
    endDate: [''],
    isPrimary: [true],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly scheduleVersionForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    periodStartDate: ['', [Validators.required]],
    periodEndDate: ['', [Validators.required]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly scheduledShiftForm = this.formBuilder.nonNullable.group({
    idEmployee: ['', [Validators.required]],
    idPosition: ['', [Validators.required]],
    shiftDate: ['', [Validators.required]],
    startTime: ['08:00', [Validators.required]],
    endTime: ['16:00', [Validators.required]],
    isOvernight: [false],
    notes: ['', [Validators.maxLength(1000)]],
  });

  ngOnInit(): void {
    this.loadOrganizations();
  }

  protected loadOrganizations(preferredId?: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .listOrganizations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (organizations) => {
          this.organizations.set(organizations);
          const organizationId = preferredId ?? this.selectedOrganizationId() ?? organizations[0]?.idOrganization ?? '';
          this.selectedOrganizationId.set(organizationId);
          if (organizationId) {
            this.loadClients(1);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectOrganization(organizationId: string): void {
    this.selectedOrganizationId.set(organizationId);
    this.selectedClient.set(null);
    this.sites.set([]);
    this.contacts.set([]);
    this.contracts.set([]);
    this.services.set([]);
    this.configurations.set([]);
    this.positions.set([]);
    this.shiftPatterns.set([]);
    this.shiftSegments.set([]);
    this.assignments.set([]);
    this.scheduleVersions.set([]);
    this.scheduledShifts.set([]);
    this.activeEmployees.set([]);
    this.selectedService.set(null);
    this.selectedPosition.set(null);
    this.selectedShiftPattern.set(null);
    this.selectedScheduleVersion.set(null);
    this.message.set('');
    this.loadClients(1);
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
  }

  protected loadClients(page = this.result().page): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      this.result.set({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.api
      .listClients(organizationId, this.search(), page, this.result().pageSize)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          const current = this.selectedClient();
          if (!current && result.items.length) {
            this.selectClient(result.items[0]);
          } else if (current && !result.items.some((item) => item.idClient === current.idClient)) {
            this.selectedClient.set(null);
            this.sites.set([]);
            this.contacts.set([]);
            this.contracts.set([]);
            this.services.set([]);
            this.configurations.set([]);
            this.positions.set([]);
            this.shiftPatterns.set([]);
            this.shiftSegments.set([]);
            this.assignments.set([]);
            this.scheduleVersions.set([]);
            this.scheduledShifts.set([]);
            this.selectedService.set(null);
            this.selectedPosition.set(null);
            this.selectedShiftPattern.set(null);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectClient(client: Client): void {
    this.selectedClient.set(client);
    this.loadClientDetail(client);
  }

  protected loadClientDetail(client = this.selectedClient()): void {
    if (!client) {
      return;
    }

    this.loadingDetail.set(true);
    this.error.set('');
    const organizationId = this.selectedOrganizationId();
    forkJoin({
      sites: this.api.listSites(organizationId, client.idClient),
      contacts: this.api.listContacts(organizationId, client.idClient),
      contracts: this.api.listContracts(organizationId, client.idClient),
      services: this.api.listServices(organizationId, client.idClient),
    })
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: ({ sites, contacts, contracts, services }) => {
          this.sites.set(sites);
          this.contacts.set(contacts);
          this.contracts.set(contracts);
          this.services.set(services);

          const currentService = this.selectedService();
          const nextService =
            (currentService && services.find((service) => service.idService === currentService.idService)) ??
            services[0] ??
            null;
          this.selectedService.set(nextService);
          if (nextService) {
            this.loadServicePlanning(nextService);
          } else {
            this.configurations.set([]);
            this.positions.set([]);
            this.shiftPatterns.set([]);
            this.shiftSegments.set([]);
            this.assignments.set([]);
            this.scheduleVersions.set([]);
            this.scheduledShifts.set([]);
            this.selectedPosition.set(null);
            this.selectedShiftPattern.set(null);
            this.selectedScheduleVersion.set(null);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateOrganization(): void {
    this.organizationForm.reset({ codeOrganization: '', legalName: '', rfc: '' });
    this.organizationEditorOpen.set(true);
  }

  protected saveOrganization(): void {
    if (this.organizationForm.invalid) {
      this.organizationForm.markAllAsTouched();
      return;
    }

    const form = this.organizationForm.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.api
      .createOrganization({
        codeOrganization: form.codeOrganization,
        legalName: form.legalName,
        rfc: this.optional(form.rfc),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (organization) => {
          this.organizationEditorOpen.set(false);
          this.message.set('Organización creada correctamente.');
          this.loadOrganizations(organization.idOrganization);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateClient(): void {
    this.editingClient.set(null);
    this.clientForm.reset({
      codeClient: '',
      legalName: '',
      tradeName: '',
      rfc: '',
      nationality: 'Mexicana',
      taxActivity: '',
      taxAddress: '',
      employerRegistrationNumber: '',
    });
    this.clientEditorOpen.set(true);
  }

  protected openEditClient(client: Client): void {
    this.editingClient.set(client);
    this.clientForm.reset({
      codeClient: client.codeClient,
      legalName: client.legalName,
      tradeName: client.tradeName ?? '',
      rfc: client.rfc,
      nationality: client.nationality ?? '',
      taxActivity: client.taxActivity ?? '',
      taxAddress: client.taxAddress ?? '',
      employerRegistrationNumber: client.employerRegistrationNumber ?? '',
    });
    this.clientEditorOpen.set(true);
  }

  protected saveClient(): void {
    if (this.clientForm.invalid || !this.selectedOrganizationId()) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const form = this.clientForm.getRawValue();
    const input: ClientInput = {
      idOrganization: this.selectedOrganizationId(),
      legalName: form.legalName,
      tradeName: this.optional(form.tradeName),
      rfc: form.rfc,
      nationality: this.optional(form.nationality),
      taxActivity: this.optional(form.taxActivity),
      taxAddress: this.optional(form.taxAddress),
      publicRegistryDate: null,
      commercialRegistryFolio: null,
      employerRegistrationNumber: this.optional(form.employerRegistrationNumber),
      incorporationDate: null,
      incorporationDeedNumber: null,
      legalRepresentativeInstrumentNumber: null,
    };
    const editing = this.editingClient();
    const request = editing
      ? this.api.updateClient(editing.idClient, input)
      : this.api.createClient({ ...input, codeClient: form.codeClient } satisfies CreateClient);

    this.saving.set(true);
    this.error.set('');
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (client) => {
        this.clientEditorOpen.set(false);
        this.message.set(editing ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.');
        this.selectedClient.set(client);
        this.loadClients(editing ? this.result().page : 1);
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivate(client: Client): void {
    if (!window.confirm(`¿Deseas desactivar a ${client.legalName}?`)) {
      return;
    }

    this.api.deactivateClient(this.selectedOrganizationId(), client.idClient).subscribe({
      next: () => {
        this.message.set('Cliente desactivado correctamente.');
        this.selectedClient.set(null);
        this.sites.set([]);
        this.contacts.set([]);
        this.contracts.set([]);
        this.services.set([]);
        this.configurations.set([]);
        this.positions.set([]);
        this.shiftPatterns.set([]);
        this.shiftSegments.set([]);
        this.selectedService.set(null);
        this.selectedPosition.set(null);
        this.selectedShiftPattern.set(null);
        this.loadClients(1);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected openCreateSite(): void {
    if (!this.selectedClient()) {
      return;
    }

    this.editingSite.set(null);
    this.siteForm.reset({
      codeClientSite: '',
      name: '',
      street: '',
      exteriorNumber: '',
      interiorNumber: '',
      neighborhood: '',
      municipality: '',
      state: '',
      postalCode: '',
      countryCode: 'MX',
      accessInstructions: '',
      timeZoneId: 'America/Mexico_City',
    });
    this.siteEditorOpen.set(true);
  }

  protected openEditSite(site: ClientSite): void {
    this.editingSite.set(site);
    this.siteForm.reset({
      codeClientSite: site.codeClientSite,
      name: site.name,
      street: site.street,
      exteriorNumber: site.exteriorNumber ?? '',
      interiorNumber: site.interiorNumber ?? '',
      neighborhood: site.neighborhood ?? '',
      municipality: site.municipality,
      state: site.state,
      postalCode: site.postalCode,
      countryCode: site.countryCode,
      accessInstructions: site.accessInstructions ?? '',
      timeZoneId: site.timeZoneId ?? 'America/Mexico_City',
    });
    this.siteEditorOpen.set(true);
  }

  protected saveSite(): void {
    const client = this.selectedClient();
    if (!client || this.siteForm.invalid) {
      this.siteForm.markAllAsTouched();
      return;
    }

    const form = this.siteForm.getRawValue();
    const input: ClientSiteInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      name: form.name,
      street: form.street,
      exteriorNumber: this.optional(form.exteriorNumber),
      interiorNumber: this.optional(form.interiorNumber),
      neighborhood: this.optional(form.neighborhood),
      municipality: form.municipality,
      state: form.state,
      postalCode: form.postalCode,
      countryCode: this.optional(form.countryCode),
      accessInstructions: this.optional(form.accessInstructions),
      timeZoneId: this.optional(form.timeZoneId),
    };
    const editing = this.editingSite();
    const request = editing
      ? this.api.updateSite(client.idClient, editing.idClientSite, input)
      : this.api.createSite(client.idClient, { ...input, codeClientSite: form.codeClientSite } satisfies CreateClientSite);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.siteEditorOpen.set(false);
        this.message.set(editing ? 'Sede actualizada correctamente.' : 'Sede creada correctamente.');
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateSite(site: ClientSite): void {
    const client = this.selectedClient();
    if (!client || !window.confirm(`¿Deseas desactivar la sede ${site.name}?`)) {
      return;
    }

    this.api.deactivateSite(this.selectedOrganizationId(), client.idClient, site.idClientSite).subscribe({
      next: () => {
        this.message.set('Sede desactivada correctamente.');
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected openCreateContact(): void {
    if (!this.selectedClient()) {
      return;
    }

    this.editingContact.set(null);
    this.contactForm.reset({
      idClientSite: '',
      purpose: 'Operational',
      fullName: '',
      jobTitle: '',
      email: '',
      phone: '',
      mobilePhone: '',
      isPrimary: false,
    });
    this.contactEditorOpen.set(true);
  }

  protected openEditContact(contact: ClientContact): void {
    this.editingContact.set(contact);
    this.contactForm.reset({
      idClientSite: contact.idClientSite ?? '',
      purpose: contact.purpose,
      fullName: contact.fullName,
      jobTitle: contact.jobTitle ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      mobilePhone: contact.mobilePhone ?? '',
      isPrimary: contact.isPrimary,
    });
    this.contactEditorOpen.set(true);
  }

  protected saveContact(): void {
    const client = this.selectedClient();
    if (!client || this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const form = this.contactForm.getRawValue();
    const input: ClientContactInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idClientSite: this.optional(form.idClientSite),
      purpose: form.purpose,
      fullName: form.fullName,
      jobTitle: this.optional(form.jobTitle),
      email: this.optional(form.email),
      phone: this.optional(form.phone),
      mobilePhone: this.optional(form.mobilePhone),
      isPrimary: form.isPrimary,
    };
    const editing = this.editingContact();
    const request = editing
      ? this.api.updateContact(client.idClient, editing.idClientContact, input)
      : this.api.createContact(client.idClient, input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.contactEditorOpen.set(false);
        this.message.set(editing ? 'Contacto actualizado correctamente.' : 'Contacto creado correctamente.');
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateContact(contact: ClientContact): void {
    const client = this.selectedClient();
    if (!client || !window.confirm(`¿Deseas desactivar a ${contact.fullName}?`)) {
      return;
    }

    this.api.deactivateContact(this.selectedOrganizationId(), client.idClient, contact.idClientContact).subscribe({
      next: () => {
        this.message.set('Contacto desactivado correctamente.');
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected openCreateContract(): void {
    if (!this.selectedClient()) {
      return;
    }

    this.editingContract.set(null);
    this.contractForm.reset({
      codeServiceContract: '',
      status: 'Draft',
      signedDate: '',
      effectiveFromDate: this.today(),
      effectiveToDate: '',
      paymentTermDays: 30,
      terminationNoticeDays: 30,
      currencyCode: 'MXN',
      documentReference: '',
      notes: '',
    });
    this.contractEditorOpen.set(true);
  }

  protected openEditContract(contract: ServiceContract): void {
    this.editingContract.set(contract);
    this.contractForm.reset({
      codeServiceContract: contract.codeServiceContract,
      status: contract.status,
      signedDate: this.dateOnly(contract.signedDate),
      effectiveFromDate: this.dateOnly(contract.effectiveFromDate),
      effectiveToDate: this.dateOnly(contract.effectiveToDate),
      paymentTermDays: contract.paymentTermDays,
      terminationNoticeDays: contract.terminationNoticeDays,
      currencyCode: contract.currencyCode,
      documentReference: contract.documentReference ?? '',
      notes: contract.notes ?? '',
    });
    this.contractEditorOpen.set(true);
  }

  protected saveContract(): void {
    const client = this.selectedClient();
    if (!client || this.contractForm.invalid) {
      this.contractForm.markAllAsTouched();
      return;
    }

    const form = this.contractForm.getRawValue();
    const input: ServiceContractInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      status: form.status,
      signedDate: this.optionalDate(form.signedDate),
      effectiveFromDate: form.effectiveFromDate,
      effectiveToDate: this.optionalDate(form.effectiveToDate),
      paymentTermDays: Number(form.paymentTermDays),
      terminationNoticeDays: Number(form.terminationNoticeDays),
      currencyCode: this.optional(form.currencyCode),
      documentReference: this.optional(form.documentReference),
      notes: this.optional(form.notes),
    };
    const editing = this.editingContract();
    const request = editing
      ? this.api.updateContract(client.idClient, editing.idServiceContract, input)
      : this.api.createContract(client.idClient, {
          ...input,
          codeServiceContract: form.codeServiceContract,
        } satisfies CreateServiceContract);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.contractEditorOpen.set(false);
        this.message.set(editing ? 'Contrato actualizado correctamente.' : 'Contrato creado correctamente.');
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateContract(contract: ServiceContract): void {
    const client = this.selectedClient();
    if (!client || !window.confirm(`¿Deseas desactivar el contrato ${contract.codeServiceContract}?`)) {
      return;
    }

    this.api.deactivateContract(this.selectedOrganizationId(), client.idClient, contract.idServiceContract).subscribe({
      next: () => {
        this.message.set('Contrato desactivado correctamente.');
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected openCreateService(): void {
    if (!this.selectedClient()) {
      return;
    }

    this.editingService.set(null);
    this.serviceForm.reset({
      codeService: '',
      idClientSite: this.sites()[0]?.idClientSite ?? '',
      idServiceContract: this.contracts()[0]?.idServiceContract ?? '',
      name: '',
      description: '',
      invoiceDescription: '',
      startDate: this.today(),
      endDate: '',
    });
    this.serviceEditorOpen.set(true);
  }

  protected openEditService(service: ManagedService): void {
    this.editingService.set(service);
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

  protected saveService(): void {
    const client = this.selectedClient();
    if (!client || this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
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
      : this.api.createService(client.idClient, { ...input, codeService: form.codeService } satisfies CreateManagedService);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (service) => {
        this.serviceEditorOpen.set(false);
        this.message.set(editing ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.');
        this.selectedService.set(service);
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateService(service: ManagedService): void {
    const client = this.selectedClient();
    if (!client || !window.confirm(`¿Deseas desactivar el servicio ${service.name}?`)) {
      return;
    }

    this.api.deactivateService(this.selectedOrganizationId(), client.idClient, service.idService).subscribe({
      next: () => {
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

  protected selectService(service: ManagedService): void {
    this.selectedService.set(service);
    this.loadServicePlanning(service);
  }

  protected loadServicePlanning(service = this.selectedService()): void {
    this.loadConfigurations(service);
    this.loadPositions(service);
    this.loadAssignments(service);
    this.loadScheduleVersions(service);
    this.loadActiveEmployees();
  }

  protected loadConfigurations(service = this.selectedService()): void {
    const client = this.selectedClient();
    if (!client || !service) {
      this.configurations.set([]);
      return;
    }

    this.api.listServiceConfigurations(this.selectedOrganizationId(), client.idClient, service.idService).subscribe({
      next: (configurations) => this.configurations.set(configurations),
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected loadPositions(service = this.selectedService()): void {
    const client = this.selectedClient();
    if (!client || !service) {
      this.positions.set([]);
      this.shiftPatterns.set([]);
      this.shiftSegments.set([]);
      this.assignments.set([]);
      this.scheduleVersions.set([]);
      this.scheduledShifts.set([]);
      this.selectedScheduleVersion.set(null);
      this.selectedPosition.set(null);
      this.selectedShiftPattern.set(null);
      return;
    }

    this.api.listPositions(this.selectedOrganizationId(), client.idClient, service.idService).subscribe({
      next: (positions) => {
        this.positions.set(positions);
        const current = this.selectedPosition();
        const nextPosition =
          (current && positions.find((position) => position.idPosition === current.idPosition)) ??
          positions[0] ??
          null;
        this.selectedPosition.set(nextPosition);
        if (nextPosition) {
          this.loadShiftPatterns(nextPosition);
        } else {
          this.shiftPatterns.set([]);
          this.shiftSegments.set([]);
          this.selectedShiftPattern.set(null);
        }
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected selectPosition(position: ServicePosition): void {
    this.selectedPosition.set(position);
    this.loadShiftPatterns(position);
  }

  protected loadShiftPatterns(position = this.selectedPosition()): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || !position) {
      this.shiftPatterns.set([]);
      this.shiftSegments.set([]);
      this.selectedShiftPattern.set(null);
      return;
    }

    this.api
      .listShiftPatterns(this.selectedOrganizationId(), client.idClient, service.idService, position.idPosition)
      .subscribe({
        next: (patterns) => {
          this.shiftPatterns.set(patterns);
          const current = this.selectedShiftPattern();
          const nextPattern =
            (current && patterns.find((pattern) => pattern.idShiftPattern === current.idShiftPattern)) ??
            patterns[0] ??
            null;
          this.selectedShiftPattern.set(nextPattern);
          if (nextPattern) {
            this.loadShiftSegments(nextPattern);
          } else {
            this.shiftSegments.set([]);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectShiftPattern(pattern: ShiftPattern): void {
    this.selectedShiftPattern.set(pattern);
    this.loadShiftSegments(pattern);
  }

  protected loadShiftSegments(pattern = this.selectedShiftPattern()): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    if (!client || !service || !position || !pattern) {
      this.shiftSegments.set([]);
      return;
    }

    this.api
      .listShiftSegments(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
        pattern.idShiftPattern,
      )
      .subscribe({
        next: (segments) => this.shiftSegments.set(segments),
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected loadAssignments(service = this.selectedService()): void {
    const client = this.selectedClient();
    if (!client || !service) {
      this.assignments.set([]);
      return;
    }

    this.api.listAssignments(this.selectedOrganizationId(), client.idClient, service.idService).subscribe({
      next: (assignments) => this.assignments.set(assignments),
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected loadActiveEmployees(): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      this.activeEmployees.set([]);
      return;
    }

    this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 100).subscribe({
      next: (result) => this.activeEmployees.set(result.items),
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected loadScheduleVersions(service = this.selectedService()): void {
    const client = this.selectedClient();
    if (!client || !service) {
      this.scheduleVersions.set([]);
      this.scheduledShifts.set([]);
      this.selectedScheduleVersion.set(null);
      return;
    }

    this.api.listScheduleVersions(this.selectedOrganizationId(), client.idClient, service.idService).subscribe({
      next: (versions) => {
        this.scheduleVersions.set(versions);
        const current = this.selectedScheduleVersion();
        const nextVersion =
          (current && versions.find((version) => version.idScheduleVersion === current.idScheduleVersion)) ??
          versions[0] ??
          null;
        this.selectedScheduleVersion.set(nextVersion);
        if (nextVersion) {
          this.loadScheduledShifts(nextVersion);
        } else {
          this.scheduledShifts.set([]);
        }
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected selectScheduleVersion(version: ScheduleVersion): void {
    this.selectedScheduleVersion.set(version);
    this.loadScheduledShifts(version);
  }

  protected loadScheduledShifts(version = this.selectedScheduleVersion()): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || !version) {
      this.scheduledShifts.set([]);
      return;
    }

    this.api
      .listScheduledShifts(this.selectedOrganizationId(), client.idClient, service.idService, version.idScheduleVersion)
      .subscribe({
        next: (shifts) => this.scheduledShifts.set(shifts),
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateScheduleVersion(): void {
    if (!this.selectedClient() || !this.selectedService()) {
      return;
    }

    this.editingScheduleVersion.set(null);
    this.scheduleVersionForm.reset({
      name: `Planeación ${this.today()}`,
      periodStartDate: this.today(),
      periodEndDate: this.today(),
      notes: '',
    });
    this.scheduleVersionEditorOpen.set(true);
  }

  protected openEditScheduleVersion(version: ScheduleVersion): void {
    this.editingScheduleVersion.set(version);
    this.scheduleVersionForm.reset({
      name: version.name,
      periodStartDate: this.dateOnly(version.periodStartDate),
      periodEndDate: this.dateOnly(version.periodEndDate),
      notes: version.notes ?? '',
    });
    this.scheduleVersionEditorOpen.set(true);
  }

  protected saveScheduleVersion(): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.scheduleVersionForm.invalid) {
      this.scheduleVersionForm.markAllAsTouched();
      return;
    }

    const form = this.scheduleVersionForm.getRawValue();
    const input: ScheduleVersionInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idService: service.idService,
      name: form.name,
      periodStartDate: form.periodStartDate,
      periodEndDate: form.periodEndDate,
      notes: this.optional(form.notes),
    };
    const editing = this.editingScheduleVersion();
    const request = editing
      ? this.api.updateScheduleVersion(client.idClient, service.idService, editing.idScheduleVersion, input)
      : this.api.createScheduleVersion(client.idClient, service.idService, input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (version) => {
        this.scheduleVersionEditorOpen.set(false);
        this.selectedScheduleVersion.set(version);
        this.message.set(editing ? 'Planeación actualizada correctamente.' : 'Planeación creada correctamente.');
        this.loadScheduleVersions(service);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected publishScheduleVersion(version: ScheduleVersion): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || !window.confirm(`¿Deseas publicar la planeación ${version.name}?`)) {
      return;
    }

    this.api
      .publishScheduleVersion(this.selectedOrganizationId(), client.idClient, service.idService, version.idScheduleVersion)
      .subscribe({
        next: (published) => {
          this.selectedScheduleVersion.set(published);
          this.message.set('Planeación publicada correctamente.');
          this.loadScheduleVersions(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateScheduledShift(): void {
    const version = this.selectedScheduleVersion();
    if (!this.selectedClient() || !this.selectedService() || !version || version.status !== 'Draft') {
      return;
    }

    this.editingScheduledShift.set(null);
    this.scheduledShiftForm.reset({
      idEmployee: this.activeEmployees()[0]?.idEmployee ?? '',
      idPosition: this.selectedPosition()?.idPosition ?? this.positions()[0]?.idPosition ?? '',
      shiftDate: this.dateOnly(version.periodStartDate),
      startTime: '08:00',
      endTime: '16:00',
      isOvernight: false,
      notes: '',
    });
    this.scheduledShiftEditorOpen.set(true);
  }

  protected openEditScheduledShift(shift: ScheduledShift): void {
    this.editingScheduledShift.set(shift);
    this.scheduledShiftForm.reset({
      idEmployee: shift.idEmployee,
      idPosition: shift.idPosition,
      shiftDate: this.dateOnly(shift.shiftDate),
      startTime: shift.startTime.slice(0, 5),
      endTime: shift.endTime.slice(0, 5),
      isOvernight: shift.isOvernight,
      notes: shift.notes ?? '',
    });
    this.scheduledShiftEditorOpen.set(true);
  }

  protected saveScheduledShift(): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    const version = this.selectedScheduleVersion();
    if (!client || !service || !version || this.scheduledShiftForm.invalid) {
      this.scheduledShiftForm.markAllAsTouched();
      return;
    }

    const form = this.scheduledShiftForm.getRawValue();
    const input: ScheduledShiftInput = {
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idService: service.idService,
      idScheduleVersion: version.idScheduleVersion,
      idPosition: form.idPosition,
      idEmployee: form.idEmployee,
      shiftDate: form.shiftDate,
      startTime: this.toApiTime(form.startTime),
      endTime: this.toApiTime(form.endTime),
      isOvernight: form.isOvernight,
      notes: this.optional(form.notes),
    };
    const editing = this.editingScheduledShift();
    const request = editing
      ? this.api.updateScheduledShift(client.idClient, service.idService, version.idScheduleVersion, editing.idScheduledShift, input)
      : this.api.createScheduledShift(client.idClient, service.idService, version.idScheduleVersion, input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.scheduledShiftEditorOpen.set(false);
        this.message.set(editing ? 'Turno actualizado correctamente.' : 'Turno programado correctamente.');
        this.loadScheduledShifts(version);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateScheduledShift(shift: ScheduledShift): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    const version = this.selectedScheduleVersion();
    if (!client || !service || !version || !window.confirm(`¿Deseas desactivar el turno de ${shift.employeeName}?`)) {
      return;
    }

    this.api
      .deactivateScheduledShift(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        version.idScheduleVersion,
        shift.idScheduledShift,
      )
      .subscribe({
        next: () => {
          this.message.set('Turno desactivado correctamente.');
          this.loadScheduledShifts(version);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateAssignment(): void {
    if (!this.selectedClient() || !this.selectedService() || !this.positions().length) {
      return;
    }

    this.editingAssignment.set(null);
    this.assignmentForm.reset({
      idEmployee: this.activeEmployees()[0]?.idEmployee ?? '',
      idPosition: this.selectedPosition()?.idPosition ?? this.positions()[0]?.idPosition ?? '',
      assignmentType: 'Primary',
      startDate: this.today(),
      endDate: '',
      isPrimary: true,
      notes: '',
    });
    this.assignmentEditorOpen.set(true);
  }

  protected openEditAssignment(assignment: ServiceAssignment): void {
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
    this.assignmentEditorOpen.set(true);
  }

  protected saveAssignment(): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.assignmentForm.invalid) {
      this.assignmentForm.markAllAsTouched();
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
      ? this.api.updateAssignment(client.idClient, service.idService, editing.idServiceAssignment, input)
      : this.api.createAssignment(client.idClient, service.idService, {
          ...input,
          idEmployee: form.idEmployee,
        } satisfies CreateServiceAssignment);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.assignmentEditorOpen.set(false);
        this.message.set(editing ? 'Asignación actualizada correctamente.' : 'Asignación creada correctamente.');
        this.loadAssignments(service);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateAssignment(assignment: ServiceAssignment): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || !window.confirm(`¿Deseas desactivar la asignación de ${assignment.employeeName}?`)) {
      return;
    }

    this.api
      .deactivateAssignment(this.selectedOrganizationId(), client.idClient, service.idService, assignment.idServiceAssignment)
      .subscribe({
        next: () => {
          this.message.set('Asignación desactivada correctamente.');
          this.loadAssignments(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateConfiguration(): void {
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
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.configurationForm.invalid) {
      this.configurationForm.markAllAsTouched();
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
      ? this.api.updateServiceConfiguration(client.idClient, service.idService, editing.idServiceConfiguration, input)
      : this.api.createServiceConfiguration(client.idClient, service.idService, input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.configurationEditorOpen.set(false);
        this.message.set(editing ? 'Configuración actualizada correctamente.' : 'Configuración creada correctamente.');
        this.loadConfigurations(service);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateConfiguration(configuration: ServiceConfiguration): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || !window.confirm('¿Deseas desactivar esta configuración de servicio?')) {
      return;
    }

    this.api
      .deactivateServiceConfiguration(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        configuration.idServiceConfiguration,
      )
      .subscribe({
        next: () => {
          this.message.set('Configuración desactivada correctamente.');
          this.loadConfigurations(service);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreatePosition(): void {
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
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || this.positionForm.invalid) {
      this.positionForm.markAllAsTouched();
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
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (position) => {
        this.positionEditorOpen.set(false);
        this.message.set(editing ? 'Posición actualizada correctamente.' : 'Posición creada correctamente.');
        this.selectedPosition.set(position);
        this.loadPositions(service);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivatePosition(position: ServicePosition): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    if (!client || !service || !window.confirm(`¿Deseas desactivar la posición ${position.name}?`)) {
      return;
    }

    this.api.deactivatePosition(this.selectedOrganizationId(), client.idClient, service.idService, position.idPosition).subscribe({
      next: () => {
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
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    if (!client || !service || !position || this.shiftPatternForm.invalid) {
      this.shiftPatternForm.markAllAsTouched();
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
      ? this.api.updateShiftPattern(client.idClient, service.idService, position.idPosition, editing.idShiftPattern, input)
      : this.api.createShiftPattern(client.idClient, service.idService, position.idPosition, {
          ...input,
          codeShiftPattern: form.codeShiftPattern,
        } satisfies CreateShiftPattern);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (pattern) => {
        this.shiftPatternEditorOpen.set(false);
        this.message.set(editing ? 'Patrón actualizado correctamente.' : 'Patrón creado correctamente.');
        this.selectedShiftPattern.set(pattern);
        this.loadShiftPatterns(position);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateShiftPattern(pattern: ShiftPattern): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    if (!client || !service || !position || !window.confirm(`¿Deseas desactivar el patrón ${pattern.name}?`)) {
      return;
    }

    this.api
      .deactivateShiftPattern(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
        pattern.idShiftPattern,
      )
      .subscribe({
        next: () => {
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
    if (!this.selectedClient() || !this.selectedService() || !this.selectedPosition() || !this.selectedShiftPattern()) {
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
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    const pattern = this.selectedShiftPattern();
    if (!client || !service || !position || !pattern || this.shiftSegmentForm.invalid) {
      this.shiftSegmentForm.markAllAsTouched();
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
      : this.api.createShiftSegment(client.idClient, service.idService, position.idPosition, pattern.idShiftPattern, input);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.shiftSegmentEditorOpen.set(false);
        this.message.set(editing ? 'Segmento actualizado correctamente.' : 'Segmento creado correctamente.');
        this.loadShiftSegments(pattern);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivateShiftSegment(segment: ShiftSegment): void {
    const client = this.selectedClient();
    const service = this.selectedService();
    const position = this.selectedPosition();
    const pattern = this.selectedShiftPattern();
    if (!client || !service || !position || !pattern || !window.confirm('¿Deseas desactivar este segmento?')) {
      return;
    }

    this.api
      .deactivateShiftSegment(
        this.selectedOrganizationId(),
        client.idClient,
        service.idService,
        position.idPosition,
        pattern.idShiftPattern,
        segment.idShiftSegment,
      )
      .subscribe({
        next: () => {
          this.message.set('Segmento desactivado correctamente.');
          this.loadShiftSegments(pattern);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected closeEditors(): void {
    this.clientEditorOpen.set(false);
    this.siteEditorOpen.set(false);
    this.contactEditorOpen.set(false);
    this.contractEditorOpen.set(false);
    this.serviceEditorOpen.set(false);
    this.configurationEditorOpen.set(false);
    this.positionEditorOpen.set(false);
    this.shiftPatternEditorOpen.set(false);
    this.shiftSegmentEditorOpen.set(false);
    this.assignmentEditorOpen.set(false);
    this.scheduleVersionEditorOpen.set(false);
    this.scheduledShiftEditorOpen.set(false);
    this.organizationEditorOpen.set(false);
  }

  protected purposeLabel(value: ClientContactPurpose): string {
    return this.contactPurposes.find((item) => item.value === value)?.label ?? value;
  }

  protected address(site: ClientSite): string {
    return [site.street, site.exteriorNumber, site.neighborhood, site.municipality, site.state, site.postalCode]
      .filter(Boolean)
      .join(', ');
  }

  protected contractStatusLabel(value: ServiceContractStatus): string {
    return this.contractStatuses.find((item) => item.value === value)?.label ?? value;
  }

  protected siteName(idClientSite: string): string {
    return this.sites().find((site) => site.idClientSite === idClientSite)?.name ?? 'Sede no disponible';
  }

  protected money(value: number, currencyCode: string): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode }).format(value);
  }

  protected dayLabel(value: string): string {
    return this.weekDays.find((day) => day.value === value)?.label ?? value;
  }

  protected durationLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
  }

  protected assignmentTypeLabel(value: ServiceAssignmentType): string {
    return this.assignmentTypes.find((item) => item.value === value)?.label ?? value;
  }

  protected scheduleStatusLabel(value: ScheduleVersionStatus): string {
    return this.scheduleStatuses.find((item) => item.value === value)?.label ?? value;
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
    return new Date().toISOString().slice(0, 10);
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
