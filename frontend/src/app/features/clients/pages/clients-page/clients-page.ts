import { HttpErrorResponse } from '@angular/common/http';
import { CatalogSelect } from '../../../../shared/ui/catalog-select/catalog-select';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../data-access/client-api.service';
import { EntityDocuments } from '../../../documents/components/entity-documents/entity-documents';
import { Client, ClientContact, ClientContactInput, ClientContactPurpose, ClientInput, ClientSite, ClientSiteInput, CreateClient, CreateClientSite, CreateServiceContract, ManagedService, Organization, PagedResult, ServiceContract, ServiceContractInput, ServiceContractStatus } from '../../data-access/client.models';

type ClientTab = 'summary' | 'sites' | 'services' | 'contracts' | 'contacts' | 'documents';
type ClientStatusFilter = 'all' | 'active' | 'inactive';
type ClientServiceFilter = 'all' | 'withServices' | 'withoutServices';
type ClientSiteFilter = 'all' | 'withSite' | 'withoutSite';
type ClientContractFilter = 'all' | 'withActiveContract' | 'withoutActiveContract';
type ClientDocumentsFilter = 'all' | 'pending' | 'complete';

@Component({
  selector: 'app-clients-page',
  imports: [ReactiveFormsModule, RouterLink, EntityDocuments, CatalogSelect],
  templateUrl: './clients-page.html',
  styleUrl: './clients-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage implements OnInit {
  protected readonly timeZones = Intl.supportedValuesOf('timeZone');
  private readonly api = inject(ClientApiService);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClient = signal<Client | null>(null);
  protected readonly sites = signal<readonly ClientSite[]>([]);
  protected readonly contacts = signal<readonly ClientContact[]>([]);
  protected readonly contracts = signal<readonly ServiceContract[]>([]);
  protected readonly documentContract = signal<ServiceContract | null>(null);
  protected readonly services = signal<readonly ManagedService[]>([]);
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
  protected readonly clientWizardStep = signal(1);
  protected readonly siteEditorOpen = signal(false);
  protected readonly contactEditorOpen = signal(false);
  protected readonly contractEditorOpen = signal(false);
  protected readonly organizationEditorOpen = signal(false);
  protected readonly editingClient = signal<Client | null>(null);
  protected readonly editingSite = signal<ClientSite | null>(null);
  protected readonly editingContact = signal<ClientContact | null>(null);
  protected readonly editingContract = signal<ServiceContract | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly clientStatusFilter = signal<ClientStatusFilter>('all');
  protected readonly clientServiceFilter = signal<ClientServiceFilter>('all');
  protected readonly clientSiteFilter = signal<ClientSiteFilter>('all');
  protected readonly clientContractFilter = signal<ClientContractFilter>('all');
  protected readonly clientDocumentsFilter = signal<ClientDocumentsFilter>('all');
  protected readonly responsibleFilter = signal('');
  protected readonly startDateFilter = signal('');
  protected readonly endDateFilter = signal('');
  protected readonly activeClientTab = signal<ClientTab>('summary');
  protected readonly clientServiceCounts = signal<Record<string, number>>({});
  protected readonly selectedOrganization = computed(
    () => this.organizations().find((organization) => organization.idOrganization === this.selectedOrganizationId()) ?? null,
  );
  protected readonly canAdministerPlatform = computed(() => this.auth.session()?.permissions.includes('PLATFORM.ADMIN') ?? false);
  protected readonly pageHeadingTitle = computed(() => this.canAdministerPlatform() ? 'Clientes operativos' : 'Configuración del cliente');
  protected readonly pageHeadingDescription = computed(() => this.canAdministerPlatform() ? 'Cartera de clientes operativos de la organización.' : 'Expediente comercial del cliente.');
  protected readonly todayContext = computed(() => {
    const date = new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
    return `Organización actual · Hoy, ${date.replace('.', '')}`;
  });
  protected readonly selectedClientName = computed(() => this.selectedClient()?.legalName ?? 'Sin cliente seleccionado');
  protected readonly visibleClients = computed(() =>
    this.result().items.filter((client) => {
      const matchesStatus =
        this.clientStatusFilter() === 'all' ||
        (this.clientStatusFilter() === 'active' && client.active) ||
        (this.clientStatusFilter() === 'inactive' && !client.active);
      const serviceCount = this.serviceCount(client);
      const matchesServices =
        this.clientServiceFilter() === 'all' ||
        (this.clientServiceFilter() === 'withServices' && serviceCount > 0) ||
        (this.clientServiceFilter() === 'withoutServices' && serviceCount === 0);
      const hasKnownSite =
        (this.selectedClient()?.idClient === client.idClient && this.sites().length > 0) ||
        Boolean(client.taxAddress?.trim());
      const matchesSite =
        this.clientSiteFilter() === 'all' ||
        (this.clientSiteFilter() === 'withSite' && hasKnownSite) ||
        (this.clientSiteFilter() === 'withoutSite' && !hasKnownSite);
      const selectedClientContracts =
        this.selectedClient()?.idClient === client.idClient ? this.contracts() : [];
      const hasActiveContract = selectedClientContracts.some(
        (contract) => contract.active && ['Executed', 'Effective'].includes(contract.status),
      );
      const matchesContract =
        this.clientContractFilter() === 'all' ||
        (this.clientContractFilter() === 'withActiveContract' && hasActiveContract) ||
        (this.clientContractFilter() === 'withoutActiveContract' && !hasActiveContract);
      const matchesResponsible =
        !this.responsibleFilter().trim() ||
        (this.selectedClient()?.idClient === client.idClient &&
          this.contacts().some((contact) =>
            contact.fullName.toLowerCase().includes(this.responsibleFilter().trim().toLowerCase()),
          ));

      return matchesStatus && matchesServices && matchesSite && matchesContract && matchesResponsible;
    }),
  );
  protected readonly activeClientsCount = computed(() => this.result().items.filter((client) => client.active).length);
  protected readonly knownServicesCount = computed(() =>
    Object.values(this.clientServiceCounts()).reduce((total, count) => total + count, 0),
  );
  protected readonly primaryContact = computed(
    () => this.contacts().find((contact) => contact.isPrimary) ?? this.contacts()[0] ?? null,
  );
  protected readonly primarySite = computed(() => this.sites()[0] ?? null);
  protected readonly newClientDisabledReason = computed(() => {
    if (this.canAdministerPlatform() && !this.auth.activeOrganization()) {
      return 'Selecciona una organización en la barra superior para operar dentro de ella.';
    }

    if (!this.selectedOrganizationId()) {
      return this.canAdministerPlatform()
        ? 'Selecciona o crea una organización para asociar el cliente.'
        : 'Tu usuario no tiene una organización asignada.';
    }

    if (this.selectedOrganization()?.active === false) {
      return 'La organización seleccionada está inactiva.';
    }

    return '';
  });
  protected readonly canCreateClient = computed(() => !this.newClientDisabledReason());
  protected readonly clientTabs: readonly { value: ClientTab; label: string; count?: () => number }[] = [
    { value: 'summary', label: 'Resumen' },
    { value: 'sites', label: 'Sedes', count: () => this.sites().length },
    { value: 'services', label: 'Servicios', count: () => this.services().length },
    { value: 'contracts', label: 'Contratos', count: () => this.contracts().length },
    { value: 'contacts', label: 'Contactos', count: () => this.contacts().length },
    { value: 'documents', label: 'Documentos' },
  ];
  protected readonly activeContractsCount = computed(() =>
    this.contracts().filter((contract) => contract.active && ['Executed', 'Effective'].includes(contract.status)).length,
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

  protected readonly organizationForm = this.formBuilder.nonNullable.group({
    codeOrganization: ['', [Validators.required, Validators.maxLength(30)]],
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    rfc: ['', [Validators.maxLength(13)]],
    status: ['active'],
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
    contactFullName: ['', [Validators.maxLength(200)]],
    contactPhone: ['', [Validators.maxLength(30)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(254)]],
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
          const organizationId = this.resolveOrganizationSelection(preferredId, organizations);
          this.selectedOrganizationId.set(organizationId);
          if (organizationId) {
            this.loadClients(1);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectOrganization(organizationId: string): void {
    if (this.canAdministerPlatform() && this.auth.activeOrganizationId() !== organizationId) {
      this.error.set('Finaliza el soporte actual e inicia una nueva sesión para cambiar de organización.');
      return;
    }
    this.selectedOrganizationId.set(organizationId);
    this.selectedClient.set(null);
    this.sites.set([]);
    this.contacts.set([]);
    this.contracts.set([]);
    this.services.set([]);
    this.message.set('');
    this.loadClients(1);
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
  }

  protected updateClientStatusFilter(value: ClientStatusFilter): void {
    this.clientStatusFilter.set(value);
  }

  protected updateClientServiceFilter(value: ClientServiceFilter): void {
    this.clientServiceFilter.set(value);
  }

  protected updateClientSiteFilter(value: ClientSiteFilter): void {
    this.clientSiteFilter.set(value);
  }

  protected updateClientContractFilter(value: ClientContractFilter): void {
    this.clientContractFilter.set(value);
  }

  protected updateClientDocumentsFilter(value: ClientDocumentsFilter): void {
    this.clientDocumentsFilter.set(value);
  }

  protected updateResponsibleFilter(value: string): void {
    this.responsibleFilter.set(value);
  }

  protected updateStartDateFilter(value: string): void {
    this.startDateFilter.set(value);
  }

  protected updateEndDateFilter(value: string): void {
    this.endDateFilter.set(value);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.clientStatusFilter.set('all');
    this.clientServiceFilter.set('all');
    this.clientSiteFilter.set('all');
    this.clientContractFilter.set('all');
    this.clientDocumentsFilter.set('all');
    this.responsibleFilter.set('');
    this.startDateFilter.set('');
    this.endDateFilter.set('');
    this.loadClients(1);
  }

  protected applySavedFilter(filter: 'active' | 'withoutContract' | 'pendingDocuments' | 'withServices'): void {
    if (filter === 'active') {
      this.clientStatusFilter.set('active');
    }

    if (filter === 'withoutContract') {
      this.clientContractFilter.set('withoutActiveContract');
    }

    if (filter === 'pendingDocuments') {
      this.clientDocumentsFilter.set('pending');
    }

    if (filter === 'withServices') {
      this.clientServiceFilter.set('withServices');
    }
  }

  protected updatePageSize(value: string): void {
    const pageSize = Number(value) || 20;
    this.result.update((result) => ({ ...result, pageSize }));
    this.loadClients(1);
  }

  protected showClientTab(tab: ClientTab): void {
    this.activeClientTab.set(tab);
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
          this.loadClientServiceCounts(result.items);
          const current = this.selectedClient();
          if (!current && result.items.length) {
            this.selectClient(result.items[0]);
          } else if (current && !result.items.some((item) => item.idClient === current.idClient)) {
            this.selectedClient.set(null);
            this.sites.set([]);
            this.contacts.set([]);
            this.contracts.set([]);
            this.services.set([]);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectClient(client: Client): void {
    this.documentContract.set(null);
    this.selectedClient.set(client);
    this.activeClientTab.set('summary');
    this.loadClientDetail(client);
  }

  protected loadClientDetail(client = this.selectedClient()): void {
    if (!client) return;
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
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateOrganization(): void {
    if (!this.canAdministerPlatform()) {
      this.error.set('Sólo el Super Admin BKT puede crear organizaciones.');
      return;
    }

    this.organizationForm.reset({ codeOrganization: '', legalName: '', rfc: '', status: 'active' });
    this.organizationEditorOpen.set(true);
  }

  protected saveOrganization(): void {
    if (!this.canAdministerPlatform()) {
      this.error.set('Sólo el Super Admin BKT puede crear organizaciones.');
      return;
    }

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
    this.clientWizardStep.set(1);
    this.clientForm.reset({
      codeClient: '',
      legalName: '',
      tradeName: '',
      rfc: '',
      nationality: 'Mexicana',
      taxActivity: '',
      taxAddress: '',
      employerRegistrationNumber: '',
      contactFullName: '',
      contactPhone: '',
      contactEmail: '',
    });
    this.clientEditorOpen.set(true);
  }

  protected openEditClient(client: Client): void {
    this.editingClient.set(client);
    this.clientWizardStep.set(1);
    this.clientForm.reset({
      codeClient: client.codeClient,
      legalName: client.legalName,
      tradeName: client.tradeName ?? '',
      rfc: client.rfc,
      nationality: client.nationality ?? '',
      taxActivity: client.taxActivity ?? '',
      taxAddress: client.taxAddress ?? '',
      employerRegistrationNumber: client.employerRegistrationNumber ?? '',
      contactFullName: '',
      contactPhone: '',
      contactEmail: '',
    });
    this.clientEditorOpen.set(true);
  }

  protected nextClientWizardStep(): void {
    const step = this.clientWizardStep();
    const controls = step === 1
      ? [this.clientForm.controls.codeClient, this.clientForm.controls.rfc, this.clientForm.controls.legalName]
      : [this.clientForm.controls.contactEmail];

    controls.forEach((control) => control.markAsTouched());
    if (controls.some((control) => control.invalid)) {
      return;
    }

    this.clientWizardStep.set(Math.min(3, step + 1));
  }

  protected previousClientWizardStep(): void {
    this.clientWizardStep.update((step) => Math.max(1, step - 1));
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
    const primaryContactInput = this.primaryContactInput(form);

    this.saving.set(true);
    this.error.set('');
    request
      .pipe(
        switchMap((client) => {
          if (!editing && primaryContactInput) {
            return this.api.createContact(client.idClient, primaryContactInput(client)).pipe(map(() => client));
          }

          return of(client);
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
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
    this.saving.set(true);
    this.api.deactivateClient(this.selectedOrganizationId(), client.idClient).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.message.set('Cliente desactivado correctamente.');
        this.selectedClient.set(null);
        this.sites.set([]);
        this.contacts.set([]);
        this.contracts.set([]);
        this.services.set([]);
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

    this.saving.set(true);
    this.api.deactivateSite(this.selectedOrganizationId(), client.idClient, site.idClientSite).pipe(finalize(() => this.saving.set(false))).subscribe({
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

    this.saving.set(true);
    this.api.deactivateContact(this.selectedOrganizationId(), client.idClient, contact.idClientContact).pipe(finalize(() => this.saving.set(false))).subscribe({
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

    this.saving.set(true);
    this.api.deactivateContract(this.selectedOrganizationId(), client.idClient, contract.idServiceContract).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.message.set('Contrato desactivado correctamente.');
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected closeEditors(): void {
    this.clientEditorOpen.set(false);
    this.siteEditorOpen.set(false);
    this.contactEditorOpen.set(false);
    this.contractEditorOpen.set(false);
    this.organizationEditorOpen.set(false);
  }

  protected purposeLabel(value: ClientContactPurpose): string {
    return this.contactPurposes.find((item) => item.value === value)?.label ?? 'Contacto';
  }

  protected address(site: ClientSite): string {
    return [site.street, site.exteriorNumber, site.neighborhood, site.municipality, site.state, site.postalCode]
      .filter(Boolean)
      .join(', ');
  }

  protected contractStatusLabel(value: ServiceContractStatus): string {
    return this.contractStatuses.find((item) => item.value === value)?.label ?? 'Sin estado';
  }

  protected clientStatusLabel(client: Client): string {
    return client.active ? 'Activo' : 'Inactivo';
  }

  protected serviceCount(client: Client): number {
    return this.clientServiceCounts()[client.idClient] ?? (this.selectedClient()?.idClient === client.idClient ? this.services().length : 0);
  }

  protected clientLocationSummary(client: Client): string {
    if (this.selectedClient()?.idClient === client.idClient && this.sites().length) {
      const mainSite = this.sites()[0];
      return [mainSite.municipality, mainSite.state].filter(Boolean).join(', ');
    }

    return client.taxAddress || 'Sin ubicación capturada';
  }

  protected dateLabel(value: string | null): string {
    if (!value) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  }

  protected isInvalid(formName: 'client' | 'organization', controlName: string): boolean {
    const control = formName === 'client' ? this.clientForm.get(controlName) : this.organizationForm.get(controlName);
    return Boolean(control?.invalid && (control.touched || control.dirty));
  }

  private primaryContactInput(
    form: ReturnType<typeof this.clientForm.getRawValue>,
  ): ((client: Client) => ClientContactInput) | null {
    const fullName = this.optional(form.contactFullName);
    const phone = this.optional(form.contactPhone);
    const email = this.optional(form.contactEmail);

    if (!fullName && !phone && !email) {
      return null;
    }

    return (client) => ({
      idOrganization: this.selectedOrganizationId(),
      idClient: client.idClient,
      idClientSite: null,
      purpose: 'Operational',
      fullName: fullName ?? 'Contacto principal',
      jobTitle: null,
      email,
      phone,
      mobilePhone: null,
      isPrimary: true,
    });
  }

  private optional(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private resolveOrganizationSelection(preferredId: string | undefined, organizations: readonly Organization[]): string {
    if (this.canAdministerPlatform()) {
      const activeId = this.auth.activeOrganizationId();
      return activeId && organizations.some((organization) => organization.idOrganization === activeId)
        ? activeId
        : '';
    }

    const preferred = preferredId?.trim();
    const current = this.selectedOrganizationId().trim();
    const activeOrganization = organizations.find((organization) => organization.active);
    const fallback = activeOrganization ?? organizations[0] ?? null;

    if (preferred && organizations.some((organization) => organization.idOrganization === preferred)) {
      return preferred;
    }

    if (current && organizations.some((organization) => organization.idOrganization === current)) {
      return current;
    }

    return fallback?.idOrganization ?? '';
  }

  private loadClientServiceCounts(clients: readonly Client[]): void {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId || clients.length === 0) {
      this.clientServiceCounts.set({});
      return;
    }

    const requests = Object.fromEntries(
      clients.map((client) => [client.idClient, this.api.listServices(organizationId, client.idClient)]),
    );

    forkJoin(requests).subscribe({
      next: (servicesByClient) => {
        this.clientServiceCounts.set(
          Object.fromEntries(
            Object.entries(servicesByClient).map(([idClient, services]) => [idClient, services.length]),
          ),
        );
      },
      error: () => {
        this.clientServiceCounts.set({});
      },
    });
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

  private setError(error: HttpErrorResponse): void {
    const detail =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)['detail']
        : null;
    this.error.set(typeof detail === 'string' ? detail : 'No fue posible completar la operación.');
  }
}
