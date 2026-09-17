import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
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
  Client,
  ClientContact,
  ClientInput,
  ClientListItem,
  ClientSite,
  ClientSitePresenceFilter,
  ClientStatusFilter,
  clientDisplayName,
  clientServiceBlockReason,
} from '../../data-access/client.models';
import { ClientData } from '../../ui/client-data';
import { ClientEditForm } from '../../ui/client-edit-form';
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
    ClientEditForm,
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

  /**
   * El cliente que se esta editando, con su ficha completa.
   *
   * <p>Se trae del servidor y no se toma de la fila del listado: la fila no lleva los campos
   * fiscales, y el <c>PUT</c> reemplaza el perfil entero. Un formulario prellenado con la fila los
   * mandaria vacios y los borraria en silencio.</p>
   */
  protected readonly editingClient = signal<Client | null>(null);
  protected readonly loadingClient = signal(false);

  protected startEdit(client: ClientListItem): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.loadingClient.set(true);
    this.formProblem.set(null);

    this.api.getClient(organizationId, client.idClient).subscribe({
      next: (completo) => {
        this.loadingClient.set(false);
        this.editingClient.set(completo);
      },
      error: (problem) => {
        this.loadingClient.set(false);
        this.actionError.set(readServerProblem(problem, 'No se pudo abrir la ficha del cliente.').message);
      },
    });
  }

  /**
   * La accion que corresponde a la pestaña abierta.
   *
   * <p>Cada apartado tiene la suya y todas viven en el mismo sitio, la cabecera de la ficha. Antes
   * estaban repartidas: editar el cliente en el menu de la fila del listado, agregar sede dentro de
   * su pestaña, agregar contacto en otro boton al pie. Quien queria hacer algo tenia que aprender
   * donde estaba cada cosa.</p>
   */
  protected readonly panelActionLabel = computed(() => {
    switch (this.activeTab()) {
      case 'sites':
        return 'Agregar sede';
      case 'contacts':
        return 'Agregar contacto';
      case 'documents':
        return 'Agregar documento';
      default:
        return 'Editar cliente';
    }
  });

  protected runPanelAction(client: ClientListItem): void {
    switch (this.activeTab()) {
      case 'sites':
        this.addSite();
        return;
      case 'contacts':
        this.addingContact.set(true);
        return;
      case 'documents':
        this.addingDocument.set(true);
        return;
      default:
        this.startEdit(client);
    }
  }

  /** Abre el alta de contacto desde la cabecera. La pestaña la lee y despliega su formulario. */
  protected readonly addingContact = signal(false);
  protected readonly addingDocument = signal(false);

  protected cancelEdit(): void {
    if (this.saving()) { return; }
    this.editingClient.set(null);
    this.formProblem.set(null);
  }

  protected saveEdit(datos: ClientInput): void {
    const client = this.editingClient();

    if (!client || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.formProblem.set(null);

    this.api.updateClient(client.idClient, datos).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingClient.set(null);
        this.load();
      },
      error: (problem) => {
        this.saving.set(false);
        this.formProblem.set(readServerProblem(problem, 'No se pudo guardar el cliente.'));
      },
    });
  }

  /** Las categorias de documento del cliente, del catalogo de la organizacion. */
  protected readonly documentCategories = signal<readonly { idCatalogItem: string; name: string }[]>([]);

  protected createDocumentCategory(creation: GiCatalogCreation): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.catalogApi
      .createItem({
        idOrganization: organizationId,
        type: 'ClientDocumentCategory',
        name: creation.name,
        description: null,
      })
      .subscribe({
        next: (creado) => {
          this.documentCategories.update((valores) => [
            ...valores,
            { idCatalogItem: creado.idCatalogItem, name: creado.name },
          ]);
        },
        error: (problem) =>
          this.actionError.set(
            readServerProblem(problem, 'No se pudo agregar la categoría al catálogo.').message,
          ),
      });
  }

  private loadDocumentCategories(): void {
    const organizationId = this.organizationId();
    if (!organizationId) return;

    this.catalogApi.listItems(organizationId, 'ClientDocumentCategory').subscribe({
      next: (items) =>
        this.documentCategories.set(
          items
            .filter((item) => item.active)
            .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
        ),
      error: () => this.documentCategories.set([]),
    });
  }

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
        },
        error: (problem) =>
          this.actionError.set(readServerProblem(problem, 'No se pudo agregar el puesto al catálogo.').message),
      });
  }

  /**
   * Los puestos hacen falta para el alta de contacto. Se piden una vez por organizacion: son los
   * mismos para toda ella, y pedirlos al abrir cada cliente repetiria la misma respuesta.
   */
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

  /**
   * Las pestañas del panel, con lo que hay dentro de cada una.
   *
   * <p><b>Los contadores salen de lo cargado, no del listado.</b> Antes venían de `siteCount` y
   * `contactCount` del elemento de la lista, que sólo se refresca al recargar la lista entera: al
   * crear un contacto el número se quedaba atrás, y la pestaña decía uno mientras el contenido
   * mostraba otro.</p>
   *
   * <p>Mientras el detalle viaja se usa el del listado, que es lo último que se sabe: es mejor un
   * número de hace un momento que un cero que parece una afirmación.</p>
   */
  protected readonly panelTabs = computed<readonly GiTab[]>(() => {
    const client = this.selected();
    const cargando = this.detailLoading();

    return [
      { id: 'data', label: 'Datos' },
      { id: 'sites', label: 'Sedes', count: cargando ? (client?.siteCount ?? 0) : this.sites().length },
      { id: 'contacts', label: 'Contactos', count: cargando ? (client?.contactCount ?? 0) : this.contacts().length },
      { id: 'documents', label: 'Documentos' },
    ];
  });

  /** Por qué no se puede crear el servicio, o vacío si sí se puede. Se escribe, no se pinta. */
  protected readonly blockReason = computed(() => {
    const client = this.selected();
    return client ? clientServiceBlockReason(client) : '';
  });

  constructor() {
    /**
     * Recargar cuando cambia la organizacion, y <b>solo</b> por eso.
     *
     * <p>El <c>untracked</c> no es adorno. Un efecto se suscribe a todas las señales que se leen
     * mientras corre, incluidas las que lee el metodo al que llama: <c>load()</c> consulta la
     * busqueda, los tres filtros y la lista de puestos, asi que el efecto acababa dependiendo de
     * las seis.</p>
     *
     * <p>Con los puestos eso cerraba un <b>ciclo infinito</b>. <c>load()</c> pedia el catalogo de
     * puestos cuando estaba vacio, la respuesta hacia <c>jobPositions.set([...])</c> —un arreglo
     * nuevo cada vez, aunque viniera vacio—, el efecto se despertaba y volvia a llamar a
     * <c>load()</c>. En una organizacion con puestos se notaba como una carga de mas; en una recien
     * creada, que no tiene ninguno, la pantalla se quedaba recargando para siempre y parpadeaba
     * sin parar.</p>
     */
    effect(() => {
      const organizationId = this.organizationId();
      const puedeLeer = this.canRead();

      untracked(() => {
        if (organizationId && puedeLeer) {
          this.load();
          this.loadMunicipalities(organizationId);
          // Los puestos van aqui, una vez por organizacion, y no dentro de `load()`: no forman
          // parte de traer la lista, y pedirlos desde ahi los ataba a cada busqueda y a cada
          // filtro.
          this.loadJobPositions();
          this.loadDocumentCategories();
        } else {
          this.clients.set([]);
        }
      });
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
        this.startEdit(event.client);
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
      case 'activate':
        this.activateClient(event.client);
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

  /**
   * Reactivar un cliente desactivado.
   *
   * <p>No pregunta antes. La confirmación existe para lo que cuesta deshacer, y esto es
   * exactamente lo contrario: es el deshacer. Ponerle un diálogo lo haría parecer igual de grave
   * que desactivar, que es lo que la persona vino a corregir.</p>
   *
   * <p>El aviso dice lo que <b>no</b> vuelve. Reactivar al cliente no revive sus sedes ni sus
   * servicios: cada uno se desactivó por su motivo, y devolverlos en bloque decidiría por el
   * usuario cosas que no pidió. Callarlo dejaría creer que la ficha volvió entera.</p>
   */
  protected activateClient(client: ClientListItem): void {
    const organizationId = this.organizationId();

    if (!organizationId) {
      return;
    }

    this.saving.set(true);
    this.actionError.set('');

    this.api.activateClient(organizationId, client.idClient).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (problem) => {
        this.saving.set(false);
        this.actionError.set(readServerProblem(problem, 'No se pudo reactivar el cliente.').message);
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
            this.finishCreate(client.idClient);
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
            this.finishCreate(idClient);
            return;
          }

          this.createContactFor(organizationId, idClient, site.idClientSite, value);
        },
        error: () => {
          // El cliente sí quedó. Se dice exactamente eso, y la pantalla lo lleva al estado que lo
          // explica en lugar de dejar un mensaje de error suelto.
          this.finishCreate(idClient);
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
        next: () => this.finishCreate(idClient),
        error: () =>
          this.finishCreate(idClient),
      });
  }

  /** Cierra el alta, recarga y deja seleccionado lo que se acaba de crear. */
  /**
   * Cierra el alta y deja seleccionado lo que se acaba de crear.
   *
   * <p>Ya no lleva mensaje: el aviso de exito se retiro a peticion del usuario. Lo que paso se ve
   * solo —la ficha abierta, el contador nuevo, la fila en la lista—, y cuando el cliente quedo sin
   * sede la pantalla lo dice abriendo esa pestana, que es mas util que una linea de texto.</p>
   */
  private finishCreate(idClient: string): void {
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
          this.savedWithoutSite.set(created && created.siteCount === 0 ? created : null);
          this.load();

          if (created) {
            this.open(created, created.siteCount === 0 ? 'sites' : 'data');
          }
        },
        error: () => {
          this.saving.set(false);
          this.creating.set(false);
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

  /**
   * Las tres acciones de una sede.
   *
   * <p><b>Antes sólo atendía «Ver contactos».</b> El menú ofrecía editar y desactivar, el
   * componente emitía las tres, y esta función descartaba dos en silencio: desde fuera, dos
   * opciones del menú simplemente no hacían nada. Los endpoints estaban desde el principio.</p>
   *
   * <p>El `default` no está de adorno: si mañana el menú suma una acción, se nota aquí en lugar de
   * caer al vacío como cayeron éstas.</p>
   */
  protected onSiteAction(event: { id: string; site: ClientSite }): void {
    switch (event.id) {
      case 'contacts':
        this.activeTab.set('contacts');
        return;
      case 'edit':
        this.editingSite.set(event.site);
        return;
      case 'deactivate':
        this.deactivateSite(event.site);
        return;
      default:
        this.actionError.set(`La acción «${event.id}» todavía no está conectada.`);
    }
  }

  /** La sede que la pestaña debe abrir en edición. */
  protected readonly editingSite = signal<ClientSite | null>(null);

  protected updateSite(event: { site: ClientSite; datos: NewSite }): void {
    const organizationId = this.organizationId();
    const client = this.selected();

    if (!organizationId || !client || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.actionError.set('');

    this.api
      .updateSite(client.idClient, event.site.idClientSite, {
        idOrganization: organizationId,
        idClient: client.idClient,
        name: event.datos.name,
        street: event.datos.street,
        exteriorNumber: null,
        interiorNumber: null,
        neighborhood: event.datos.neighborhood || null,
        municipality: event.datos.municipality,
        state: event.datos.state,
        postalCode: event.datos.postalCode,
        countryCode: 'MX',
        accessInstructions: null,
        timeZoneId: null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingSite.set(null);
          this.loadDetail(client);
          this.load();
        },
        error: (problem) => {
          this.saving.set(false);
          this.actionError.set(readServerProblem(problem, 'No se pudo actualizar la sede.').message);
        },
      });
  }

  /**
   * Desactiva una sede. No la borra: aquí los registros no se borran.
   *
   * <p>Se pregunta antes, y se dice qué deja de poder hacerse, porque un servicio se presta en una
   * sede: sin sedes activas el cliente no puede contratar nuevos servicios.</p>
   */
  protected deactivateSite(site: ClientSite): void {
    const organizationId = this.organizationId();
    const client = this.selected();

    if (!organizationId || !client || !this.canWrite() || this.saving()) {
      return;
    }

    if (!window.confirm(
      `¿Desactivar la sede "${site.name}"?

No se borra: deja de poder elegirse para servicios `
      + 'nuevos y su nombre sigue ocupado para este cliente.')) {
      return;
    }

    this.saving.set(true);
    this.actionError.set('');

    this.api.deactivateSite(organizationId, client.idClient, site.idClientSite).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadDetail(client);
        this.load();
      },
      error: (problem) => {
        this.saving.set(false);
        this.actionError.set(readServerProblem(problem, 'No se pudo desactivar la sede.').message);
      },
    });
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
  /**
   * Guardar los cambios de un contacto.
   *
   * <p>Editar no existia: un contacto capturado con el telefono mal se quedaba mal para siempre, o
   * habia que agregar otro y dejar el viejo colgando. El endpoint ya estaba; faltaba la pantalla.</p>
   */
  protected updateContact(event: { contact: ClientContact; datos: NewContact }): void {
    const organizationId = this.organizationId();
    const client = this.selected();

    if (!organizationId || !client || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.api
      .updateContact(client.idClient, event.contact.idClientContact, {
        idOrganization: organizationId,
        idClient: client.idClient,
        idClientSite: event.datos.idClientSite,
        purpose: event.datos.purpose,
        fullName: event.datos.fullName,
        jobTitle: event.datos.jobTitle || null,
        email: event.datos.email || null,
        phone: event.datos.phone || null,
        // El movil no esta en el formulario, asi que se conserva el que hubiera. Mandarlo nulo lo
        // borraria, y quien vino a corregir un puesto no pidio perder un telefono.
        mobilePhone: event.contact.mobilePhone,
        isPrimary: event.datos.isPrimary,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.loadDetail(client);
          this.load();
        },
        error: (problem) => {
          this.saving.set(false);
          this.actionError.set(readServerProblem(problem, 'No se pudo guardar el contacto.').message);
        },
      });
  }

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
          this.loadDetail(client);
          // Y la lista, que es de donde salen los contadores del pie de la ficha y la columna de
          // «sin contacto». Era el unico de los siete guardados que no la recargaba: la pestaña
          // decia 3 y el pie seguia diciendo 2, sobre el mismo cliente y a la vez.
          this.load();
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
