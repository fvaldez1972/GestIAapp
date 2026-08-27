import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
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
  ManagedService,
  ManagedServiceInput,
  Organization,
  PagedResult,
  ServiceConfiguration,
  ServiceConfigurationInput,
  ServiceContract,
  ServiceContractInput,
  ServiceContractStatus,
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
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClient = signal<Client | null>(null);
  protected readonly sites = signal<readonly ClientSite[]>([]);
  protected readonly contacts = signal<readonly ClientContact[]>([]);
  protected readonly contracts = signal<readonly ServiceContract[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly configurations = signal<readonly ServiceConfiguration[]>([]);
  protected readonly selectedService = signal<ManagedService | null>(null);
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
  protected readonly organizationEditorOpen = signal(false);
  protected readonly editingClient = signal<Client | null>(null);
  protected readonly editingSite = signal<ClientSite | null>(null);
  protected readonly editingContact = signal<ClientContact | null>(null);
  protected readonly editingContract = signal<ServiceContract | null>(null);
  protected readonly editingService = signal<ManagedService | null>(null);
  protected readonly editingConfiguration = signal<ServiceConfiguration | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly selectedClientName = computed(() => this.selectedClient()?.legalName ?? 'Sin cliente seleccionado');
  protected readonly selectedServiceName = computed(() => this.selectedService()?.name ?? 'Sin servicio seleccionado');

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
    this.selectedService.set(null);
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
            this.selectedService.set(null);
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
            this.loadConfigurations(nextService);
          } else {
            this.configurations.set([]);
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
        this.selectedService.set(null);
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
        }
        this.loadClientDetail(client);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected selectService(service: ManagedService): void {
    this.selectedService.set(service);
    this.loadConfigurations(service);
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

  protected closeEditors(): void {
    this.clientEditorOpen.set(false);
    this.siteEditorOpen.set(false);
    this.contactEditorOpen.set(false);
    this.contractEditorOpen.set(false);
    this.serviceEditorOpen.set(false);
    this.configurationEditorOpen.set(false);
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

  private setError(error: HttpErrorResponse): void {
    const detail =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)['detail']
        : null;
    this.error.set(typeof detail === 'string' ? detail : 'No fue posible completar la operación.');
  }
}
