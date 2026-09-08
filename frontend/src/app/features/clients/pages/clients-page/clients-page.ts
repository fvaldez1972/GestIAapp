import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { EntityDocuments } from '../../../documents/components/entity-documents/entity-documents';
import {
  GiConfirmDialog,
  GiDetailPanel,
  GiEmptyState,
  GiFilterBar,
  GiFilterGroup,
  GiTab,
  GiTabContent,
  GiTableState,
} from '../../../../shared/ui/gi-ui';
import { ClientApiService } from '../../data-access/client-api.service';
import {
  ClientContact,
  ClientListItem,
  ClientSite,
  ClientSitePresenceFilter,
  ClientStatusFilter,
  clientDisplayName,
  clientServiceBlockReason,
} from '../../data-access/client.models';
import { ClientData } from '../../ui/client-data';
import { ClientForm, ClientFormValue } from '../../ui/client-form';
import { CatalogApiService } from '../../../catalogs/data-access/catalog-api.service';
import { GiCatalogOption, GiCatalogCreation } from '../../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { ServerProblem, readServerProblem } from '../../../../shared/util/server-problem';
import { ClientContacts, NewContact } from '../../ui/client-contacts';
import { ClientSites, NewSite } from '../../ui/client-sites';
import { ClientTable } from '../../ui/client-table';

/**
 * Clientes.
 *
 * <p>El paso 4 del recorrido, y el sitio donde <b>se exige la sede</b>. El servicio se liga a una
 * sede, así que un cliente sin sede no puede tener servicios; decirlo aquí, en el momento, evita
 * que el usuario se entere al fallar el alta del servicio dos pantallas más adelante.</p>
 *
 * <p>Esta clase compone y carga: pide, reparte a las cinco piezas, y encadena el alta. Ningún
 * cuerpo vive aquí.</p>
 */
@Component({
  selector: 'app-clients-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClientContacts,
    ClientData,
    ClientForm,
    ClientSites,
    ClientTable,
    EntityDocuments,
    GiConfirmDialog,
    GiDetailPanel,
    GiEmptyState,
    GiFilterBar,
    GiTabContent,
  ],
  templateUrl: './clients-page.html',
  styleUrl: './clients-page.scss',
})
export class ClientsPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ClientApiService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly router = inject(Router);

  /** La organización se hereda de la barra de contexto. Esta pantalla no tiene selector propio. */
  protected readonly organizationId = this.auth.operationalOrganizationId;
  protected readonly canRead = computed(() => this.auth.hasPermission('CLIENTS.READ'));
  protected readonly canWrite = computed(() => this.auth.hasPermission('CLIENTS.WRITE'));

  protected readonly clients = signal<readonly ClientListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');

  protected readonly search = signal('');
  protected readonly status = signal<ClientStatusFilter>('Active');
  protected readonly sitePresence = signal<ClientSitePresenceFilter>('Any');
  protected readonly municipality = signal('');
  protected readonly municipalities = signal<readonly string[]>([]);

  protected readonly selected = signal<ClientListItem | null>(null);
  protected readonly activeTab = signal('data');
  protected readonly sites = signal<readonly ClientSite[]>([]);
  protected readonly contacts = signal<readonly ClientContact[]>([]);
  protected readonly detailLoading = signal(false);

  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly formProblem = signal<ServerProblem | null>(null);
  /** El cliente recién guardado sin sede. Es el aviso de arriba, y desaparece al resolverlo. */
  protected readonly savedWithoutSite = signal<ClientListItem | null>(null);
  protected readonly confirming = signal<ClientListItem | null>(null);

  protected readonly name = clientDisplayName;

  /** Abre el formulario de sede desde el aviso de arriba, sin que el usuario lo busque. */
  protected readonly addingSite = signal(false);

  protected readonly subtitle = computed(() => {
    const total = this.total();
    const sinSede = this.clients().filter((client) => client.siteCount === 0).length;

    if (!total) {
      return 'Cada cliente necesita al menos una sede para poder tener servicios.';
    }

    const base = `${total} ${total === 1 ? 'cliente' : 'clientes'}.`;

    return sinSede > 0
      ? `${base} ${sinSede} ${sinSede === 1 ? 'todavía no tiene sede' : 'todavía no tienen sede'}, así que ` +
          `${sinSede === 1 ? 'no puede' : 'no pueden'} tener servicios.`
      : `${base} Todos tienen al menos una sede.`;
  });

  /**
   * Lo que fallo al guardar, que no es lo mismo que lo que fallo al cargar.
   *
   * <p>Van separados porque la tabla usa `error()` para decir que la lista no se pudo traer, y
   * pinta un «Reintentar» en lugar de las filas. Un guardado fallido escrito ahi hacia desaparecer
   * la lista entera y ofrecia reintentar algo que no era lo que habia fallado.</p>
   */
  protected readonly actionError = signal('');

  /**
   * Los puestos del catalogo, para el contacto.
   *
   * <p>El puesto de un contacto NO es texto libre: el servidor lo valida contra el catalogo de
   * puestos y devuelve 409 con cualquier cosa escrita a mano. Es el mismo catalogo que usa
   * Personal.</p>
   */
  protected readonly jobPositions = signal<readonly GiCatalogOption[]>([]);

  protected createJobPosition(creation: GiCatalogCreation): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.catalogApi
      .createItem({ idOrganization: organizationId, type: 'JobPosition', name: creation.name, description: null })
      .subscribe({
        next: (creado) => {
          this.jobPositions.update((valores) => [...valores, { idCatalogItem: creado.idCatalogItem, name: creado.name }]);
          this.message.set(`«${creado.name}» quedó en el catálogo de puestos y se puede reutilizar.`);
        },
        error: (problem) =>
          this.actionError.set(readServerProblem(problem, 'No se pudo agregar el puesto al catálogo.').message),
      });
  }

  private loadJobPositions(): void {
    const organizationId = this.organizationId();
    if (!organizationId) return;

    this.catalogApi.listItems(organizationId, 'JobPosition').subscribe({
      next: (items) =>
        this.jobPositions.set(
          items.filter((item) => item.active).map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
        ),
      error: () => this.jobPositions.set([]),
    });
  }

  protected readonly tableState = computed<GiTableState>(() => {
    if (this.error()) return 'error';
    if (this.loading()) return 'loading';
    if (this.clients().length) return 'ready';
    return this.hasFilters() ? 'empty-filtered' : 'empty';
  });

  protected readonly hasFilters = computed(
    () => !!this.search().trim() || this.status() !== 'Active' || this.sitePresence() !== 'Any' || !!this.municipality(),
  );

  protected readonly filterGroups = computed<readonly GiFilterGroup[]>(() => {
    const groups: GiFilterGroup[] = [
      {
        id: 'status',
        label: 'Estado del cliente',
        value: this.status() === 'All' ? '' : this.status(),
        allLabel: 'Todos',
        options: [
          { value: 'Active', label: 'Activo' },
          { value: 'Inactive', label: 'Inactivo' },
        ],
      },
      {
        id: 'site',
        label: 'Sede',
        value: this.sitePresence() === 'Any' ? '' : this.sitePresence(),
        allLabel: 'Todos',
        options: [
          { value: 'WithSite', label: 'Con al menos una sede' },
          { value: 'WithoutSite', label: 'Sin sede' },
        ],
      },
    ];

    // El municipio sólo se ofrece cuando hay de dónde elegir: un grupo con una sola opción real es
    // un control que no puede cambiar nada, y el sistema lo rechaza en desarrollo.
    if (this.municipalities().length > 1) {
      groups.push({
        id: 'municipality',
        label: 'Municipio',
        value: this.municipality(),
        allLabel: 'Todos',
        options: this.municipalities().map((name) => ({ value: name, label: name })),
      });
    }

    return groups;
  });

  protected readonly panelTabs = computed<readonly GiTab[]>(() => {
    const client = this.selected();

    return [
      { id: 'data', label: 'Datos' },
      { id: 'sites', label: 'Sedes', count: client?.siteCount ?? 0 },
      { id: 'contacts', label: 'Contactos', count: client?.contactCount ?? 0 },
      { id: 'documents', label: 'Documentos' },
    ];
  });

  /** Por qué no se puede crear el servicio, o vacío si sí se puede. Se escribe, no se pinta. */
  protected readonly blockReason = computed(() => {
    const client = this.selected();
    return client ? clientServiceBlockReason(client) : '';
  });

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();

      if (organizationId && this.canRead()) {
        this.load();
        this.loadMunicipalities(organizationId);
      } else {
        this.clients.set([]);
      }
    });
  }

  // ── Listado ──────────────────────────────────────────────────────────────────────────────

  protected onSearch(value: string): void {
    this.search.set(value);
    this.load();
  }

  protected onFilter(change: { groupId: string; value: string }): void {
    if (change.groupId === 'status') {
      this.status.set((change.value || 'All') as ClientStatusFilter);
    } else if (change.groupId === 'site') {
      this.sitePresence.set((change.value || 'Any') as ClientSitePresenceFilter);
    } else {
      this.municipality.set(change.value);
    }

    this.load();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set('Active');
    this.sitePresence.set('Any');
    this.municipality.set('');
    this.load();
  }

  protected load(): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canRead()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    // Los puestos hacen falta para el alta de contacto. Van con la lista y no con cada ficha: son
    // los mismos para toda la organizacion, y pedirlos al abrir cada cliente seria repetir la
    // misma respuesta.
    if (!this.jobPositions().length) {
      this.loadJobPositions();
    }

    this.api
      .searchClients({
        organizationId,
        search: this.search(),
        status: this.status(),
        sitePresence: this.sitePresence(),
        municipality: this.municipality(),
        pageSize: 25,
      })
      .subscribe({
        next: (result) => {
          this.clients.set(result.items);
          this.total.set(result.totalCount);
          this.loading.set(false);
          this.refreshSelection(result.items);
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de clientes.');
          this.loading.set(false);
        },
      });
  }

  private loadMunicipalities(organizationId: string): void {
    this.api.listClientMunicipalities(organizationId).subscribe({
      next: (municipalities) => this.municipalities.set(municipalities),
      error: () => this.municipalities.set([]),
    });
  }

  /** Tras recargar, la ficha abierta y el aviso siguen al dato nuevo, no al de antes. */
  private refreshSelection(items: readonly ClientListItem[]): void {
    const selected = this.selected();

    if (selected) {
      const fresh = items.find((item) => item.idClient === selected.idClient);
      this.selected.set(fresh ?? selected);
    }

    const saved = this.savedWithoutSite();

    if (saved) {
      const fresh = items.find((item) => item.idClient === saved.idClient);

      // El aviso se va solo en cuanto el cliente tiene sede: se resolvió, no hace falta cerrarlo.
      this.savedWithoutSite.set(fresh && fresh.siteCount === 0 ? fresh : null);
    }
  }

  // ── Ficha ────────────────────────────────────────────────────────────────────────────────

  protected open(client: ClientListItem, tab = 'data'): void {
    this.creating.set(false);
    this.addingSite.set(false);
    this.selected.set(client);
    this.activeTab.set(tab);
    this.sites.set([]);
    this.contacts.set([]);
    this.loadDetail(client);
  }

  protected closePanel(): void {
    this.selected.set(null);
    this.creating.set(false);
  }

  private loadDetail(client: ClientListItem): void {
    const organizationId = this.organizationId();

    if (!organizationId) {
      return;
    }

    this.detailLoading.set(true);

    forkJoin({
      sites: this.api.listSites(organizationId, client.idClient).pipe(catchError(() => of([]))),
      contacts: this.api.listContacts(organizationId, client.idClient).pipe(catchError(() => of([]))),
    }).subscribe((detail) => {
      this.sites.set(detail.sites);
      this.contacts.set(detail.contacts);
      this.detailLoading.set(false);
    });
  }

  // ── Acciones de fila ─────────────────────────────────────────────────────────────────────

  protected onRowAction(event: { id: string; client: ClientListItem }): void {
    switch (event.id) {
      case 'edit':
        this.open(event.client, 'data');
        break;
      case 'sites':
        this.open(event.client, 'sites');
        break;
      case 'documents':
        this.open(event.client, 'documents');
        break;
      case 'deactivate':
        this.confirming.set(event.client);
        break;
    }
  }

  protected confirmDeactivate(): void {
    const client = this.confirming();
    const organizationId = this.organizationId();

    if (!client || !organizationId) {
      return;
    }

    this.confirming.set(null);
    this.saving.set(true);

    this.api.deactivateClient(organizationId, client.idClient).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(`${this.name(client)} quedó desactivado. Sus registros se conservan.`);
        if (this.selected()?.idClient === client.idClient) {
          this.closePanel();
        }
        this.load();
      },
      error: (problem) => {
        this.saving.set(false);
        this.actionError.set(readServerProblem(problem, 'No se pudo desactivar el cliente.').message);
      },
    });
  }

  // ── Alta ─────────────────────────────────────────────────────────────────────────────────

  protected startCreate(): void {
    this.selected.set(null);
    this.creating.set(true);
    this.formProblem.set(null);
  }

  /**
   * El alta encadena tres llamadas: cliente, sede y contacto.
   *
   * <p>No es una transacción, y no hace falta que lo sea: <b>cada fallo parcial cae en un estado
   * que esta misma pantalla nombra</b>. Si falla la sede, el cliente queda «sin sede», que es la
   * vista que ya sabe explicarse. Si falla el contacto, la sede queda «sin contacto», que es la
   * píldora del listado. Lo único obligatorio es decir con precisión qué sí se guardó.</p>
   */
  protected saveNew(event: { value: ClientFormValue; withSite: boolean }): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.formProblem.set(null);

    const { value, withSite } = event;

    this.api
      .createClient({
        idOrganization: organizationId,
        legalName: value.legalName,
        tradeName: value.tradeName || null,
        rfc: value.rfc,
        nationality: null,
        taxActivity: null,
        taxAddress: null,
        publicRegistryDate: null,
        commercialRegistryFolio: null,
        employerRegistrationNumber: null,
        incorporationDate: null,
        incorporationDeedNumber: null,
        legalRepresentativeInstrumentNumber: null,
      })
      .subscribe({
        next: (client) => {
          if (!withSite) {
            this.finishCreate(client.idClient, 'Se guardó el cliente. Todavía no tiene sede.');
            return;
          }

          this.createSiteFor(organizationId, client.idClient, value);
        },
        error: (problem) => {
          this.saving.set(false);
          this.formProblem.set(readServerProblem(problem, 'No se pudo guardar el cliente.'));
        },
      });
  }

  private createSiteFor(organizationId: string, idClient: string, value: ClientFormValue): void {
    this.api
      .createSite(idClient, {
        idOrganization: organizationId,
        idClient,
        codeClientSite: `SED-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        name: value.site.name,
        street: value.site.street,
        exteriorNumber: null,
        interiorNumber: null,
        neighborhood: value.site.neighborhood || null,
        municipality: value.site.municipality,
        state: value.site.state,
        postalCode: value.site.postalCode,
        countryCode: 'MX',
        accessInstructions: null,
        timeZoneId: null,
      })
      .subscribe({
        next: (site) => {
          if (!value.contact.fullName) {
            this.finishCreate(idClient, 'Se guardaron el cliente y su sede.');
            return;
          }

          this.createContactFor(organizationId, idClient, site.idClientSite, value);
        },
        error: () => {
          // El cliente sí quedó. Se dice exactamente eso, y la pantalla lo lleva al estado que lo
          // explica en lugar de dejar un mensaje de error suelto.
          this.finishCreate(
            idClient,
            'Se guardó el cliente, pero no su sede. Revisa la dirección y agrégala desde la ficha.',
          );
        },
      });
  }

  private createContactFor(
    organizationId: string,
    idClient: string,
    idClientSite: string,
    value: ClientFormValue,
  ): void {
    this.api
      .createContact(idClient, {
        idOrganization: organizationId,
        idClient,
        idClientSite,
        purpose: 'Operational',
        fullName: value.contact.fullName,
        jobTitle: value.contact.jobTitle || null,
        email: value.contact.email || null,
        phone: value.contact.phone || null,
        mobilePhone: null,
        isPrimary: true,
      })
      .subscribe({
        next: () => this.finishCreate(idClient, 'Se guardaron el cliente, su sede y su contacto.'),
        error: () =>
          this.finishCreate(
            idClient,
            'Se guardaron el cliente y su sede, pero no el contacto. Se puede agregar desde la sede.',
          ),
      });
  }

  /** Cierra el alta, recarga y deja seleccionado lo que se acaba de crear. */
  private finishCreate(idClient: string, message: string): void {
    const organizationId = this.organizationId();

    if (!organizationId) {
      return;
    }

    this.api
      // El tope del servidor es 100 por página. Pedir más devuelve un 400 de validación, y el
      // alta terminaba sin poder decir que el cliente quedó sin sede, que es justo lo que esta
      // pantalla existe para decir.
      .searchClients({ organizationId, status: 'All', pageSize: 100 })
      .subscribe({
        next: (result) => {
          const created = result.items.find((item) => item.idClient === idClient) ?? null;

          this.saving.set(false);
          this.creating.set(false);
          this.message.set(message);
          this.savedWithoutSite.set(created && created.siteCount === 0 ? created : null);
          this.load();

          if (created) {
            this.open(created, created.siteCount === 0 ? 'sites' : 'data');
          }
        },
        error: () => {
          this.saving.set(false);
          this.creating.set(false);
          this.message.set(message);
          this.load();
        },
      });
  }

  // ── Salidas ──────────────────────────────────────────────────────────────────────────────

  /** La transición al paso siguiente, con el cliente ya elegido. */
  protected goToServices(client: ClientListItem): void {
    void this.router.navigate(['/servicios'], { queryParams: { clientId: client.idClient } });
  }

  /** El «Agregar sede» del aviso: abre la ficha en Sedes con el formulario ya desplegado. */
  protected addSite(): void {
    const client = this.selected() ?? this.savedWithoutSite();

    if (client) {
      this.open(client, 'sites');
      this.addingSite.set(true);
    }
  }

  protected onSiteAction(event: { id: string; site: ClientSite }): void {
    if (event.id === 'contacts') {
      this.activeTab.set('contacts');
    }
  }

  /**
   * El alta de sede, que es la salida del estado «sin sede».
   *
   * <p>Al guardarla, el listado se recarga y el aviso de arriba desaparece solo, porque el cliente
   * deja de estar sin sede. Nadie tiene que cerrar nada.</p>
   */
  /**
   * Alta de contacto.
   *
   * <p>La pestaña tenía el botón desde el principio y detrás no había nada: emitía una señal que
   * la página no escuchaba. Los endpoints ya existían, en el servidor y en el cliente.</p>
   */
  protected createContact(contact: NewContact): void {
    const organizationId = this.organizationId();
    const client = this.selected();

    if (!organizationId || !client || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.api
      .createContact(client.idClient, {
        idOrganization: organizationId,
        idClient: client.idClient,
        idClientSite: contact.idClientSite,
        purpose: contact.purpose,
        fullName: contact.fullName,
        jobTitle: contact.jobTitle || null,
        email: contact.email || null,
        phone: contact.phone || null,
        mobilePhone: null,
        isPrimary: contact.isPrimary,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set(`${contact.fullName} quedó registrado como contacto.`);
          this.loadDetail(client);
        },
        error: (problem) => {
          this.saving.set(false);
          this.actionError.set(readServerProblem(problem, 'No se pudo guardar el contacto.').message);
        },
      });
  }

  protected createSite(site: NewSite): void {
    const organizationId = this.organizationId();
    const client = this.selected();

    if (!organizationId || !client || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.api
      .createSite(client.idClient, {
        idOrganization: organizationId,
        idClient: client.idClient,
        codeClientSite: `SED-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        name: site.name,
        street: site.street,
        exteriorNumber: null,
        interiorNumber: null,
        neighborhood: site.neighborhood || null,
        municipality: site.municipality,
        state: site.state,
        postalCode: site.postalCode,
        countryCode: 'MX',
        accessInstructions: null,
        timeZoneId: null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.addingSite.set(false);
          this.message.set(`${site.name} quedó registrada. Ya se pueden crear servicios de este cliente.`);
          this.loadDetail(client);
          this.load();
        },
        error: (problem) => {
          this.saving.set(false);
          this.actionError.set(readServerProblem(problem, 'No se pudo guardar la sede.').message);
        },
      });
  }
}
