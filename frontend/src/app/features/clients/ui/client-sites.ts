import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogSelect } from '../../../shared/ui/catalog-select/catalog-select';
import { GiEmptyState, GiRowAction, GiRowActions } from '../../../shared/ui/gi-ui';
import { ClientContact, ClientSite } from '../data-access/client.models';

/** Lo que hace falta para dar de alta una sede. Nada más: el código lo pone el sistema. */
export type NewSite = {
  readonly name: string;
  readonly street: string;
  readonly neighborhood: string;
  readonly municipality: string;
  readonly state: string;
  readonly postalCode: string;
};

/**
 * La pestaña de Sedes.
 *
 * <p>Aquí se dice lo que la pantalla existe para decir: <b>sin sede no se puede crear un
 * servicio</b>, porque el servicio se liga a una sede. El aviso llega al mirar al cliente y no dos
 * pantallas después, al fallar el alta del servicio.</p>
 *
 * <p>El vacío no es «no hay nada»: es <b>falta un prerrequisito</b>, y por eso usa esa variante y
 * ofrece, ahí mismo, el formulario que lo resuelve.</p>
 */
@Component({
  selector: 'app-client-sites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CatalogSelect, FormsModule, GiEmptyState, GiRowActions],
  template: `
    <section class="sites">
      @if (adding()) {
        <form class="new" (ngSubmit)="$event.preventDefault()">
          <p class="new__kicker">{{ editando() ? 'EDITAR SEDE' : 'NUEVA SEDE' }}</p>

          <label class="field" for="ns-nombre">
            <span class="field__label">NOMBRE DE LA SEDE</span>
            <input id="ns-nombre" name="name" type="text" [ngModel]="siteName()" (ngModelChange)="siteName.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          </label>

          <div class="new__row new__row--calle">
            <label class="field" for="ns-calle">
              <span class="field__label">CALLE Y NÚMERO</span>
              <input id="ns-calle" name="street" type="text" [ngModel]="street()" (ngModelChange)="street.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
            </label>
            <label class="field" for="ns-cp">
              <span class="field__label">CÓDIGO POSTAL</span>
              <input id="ns-cp" name="postalCode" type="text" [ngModel]="postalCode()" (ngModelChange)="postalCode.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
            </label>
          </div>

          <div class="new__row new__row--three">
            <label class="field" for="ns-colonia">
              <span class="field__label">COLONIA</span>
              <input id="ns-colonia" name="neighborhood" type="text" [ngModel]="neighborhood()" (ngModelChange)="neighborhood.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
            </label>
            <label class="field" for="ns-estado">
              <span class="field__label">ESTADO</span>
              <app-catalog-select
                id="ns-estado"
                type="State"
                label="Estado"
                country="MX"
                [organizationId]="organizationId()"
                [ngModel]="state()"
                (ngModelChange)="onState($event)"
                [ngModelOptions]="sueltos"
              />
            </label>
            <label class="field" for="ns-municipio">
              <span class="field__label">MUNICIPIO</span>
              <app-catalog-select
                id="ns-municipio"
                type="City"
                label="Municipio"
                country="MX"
                [state]="state()"
                [organizationId]="organizationId()"
                [ngModel]="municipality()"
                (ngModelChange)="municipality.set($event)"
                [ngModelOptions]="sueltos"
              />
            </label>
          </div>

          <p class="new__footer">
            <button class="button" type="button" (click)="cancelAdd()">Cancelar</button>
            <button
              class="button button--primary"
              type="button"
              [disabled]="saving() || !ready()"
              [attr.aria-describedby]="ready() ? null : 'ns-falta'"
              (click)="submit()"
            >Guardar sede</button>
          </p>

          <!-- La razón se escribe. Un botón gris sin explicación obliga a adivinar. -->
          <p class="new__reason" id="ns-falta" [hidden]="ready()">
            Hacen falta el nombre, la calle, el municipio, el estado y el código postal.
          </p>
        </form>
      } @else if (sites().length === 0) {
        @if (canWrite()) {
          <gi-empty-state
            variant="missing-prerequisite"
            title="Este cliente todavía no tiene sede"
            description="El servicio se liga a una sede, así que sin sede no se puede crear el servicio de este cliente. Con la dirección y un contacto queda resuelto."
            actionLabel="Agregar sede"
            (action)="startAdd()"
          />
        } @else {
          <!--
            Sin permiso de escritura esto sí es un callejón, y el sistema prohíbe con razón un
            vacío que no ofrece salida. Se dice la verdad en su lugar: falta la sede, y quién
            puede ponerla.
          -->
          <p class="sites__blocked">
            <span class="sites__blocked-title">Este cliente todavía no tiene sede</span>
            <span class="sites__blocked-body">
              Sin sede no se le pueden crear servicios. Lo resuelve quien administra clientes en tu
              organización.
            </span>
          </p>
        }
      } @else {
        <p class="sites__intro">
          <span>Cada servicio se liga a una sede. Al crear el servicio se elige de esta lista.</span>
          @if (canWrite()) {
            <button class="sites__add" type="button" (click)="startAdd()">Agregar sede</button>
          }
        </p>

        <ul class="sites__list">
          @for (site of sites(); track site.idClientSite) {
            @let contact = contactOf(site.idClientSite);
            <li class="site">
              <p class="site__header">
                <span class="site__name">{{ site.name }}</span>
                @if (!contact) {
                  <span class="site__pill">Sin contacto</span>
                }
                <span class="site__actions">
                  <gi-row-actions
                    [actions]="actions()"
                    [label]="'Acciones de la sede ' + site.name"
                    (select)="act.emit({ id: $event.id, site })"
                  />
                </span>
              </p>

              <div class="site__body">
                <span class="site__field">
                  <span class="site__label">DIRECCIÓN</span>
                  <span class="site__value">{{ address(site) }}</span>
                </span>
                <span class="site__field">
                  <span class="site__label">CONTACTO</span>
                  @if (contact) {
                    <span class="site__value site__value--strong">{{ contact.fullName }}</span>
                    <span class="site__note">
                      {{ contact.jobTitle || 'Sin puesto registrado' }}@if (contactIsFromClient(site.idClientSite)) { · contacto del cliente }
                    </span>
                  } @else {
                    <span class="site__value site__value--missing">Sin contacto</span>
                    <span class="site__note">La sede funciona, pero nadie responde por ella.</span>
                  }
                </span>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .sites { display: flex; flex-direction: column; gap: 0.75rem; }

    .sites__intro {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0;
      color: var(--gestia-muted);
      font-size: 12px;
    }

    .sites__add {
      flex: none;
      margin-left: auto;
      height: var(--gestia-control-height);
      padding: 0 0.8rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .sites__add:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .sites__blocked {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .sites__blocked-title { color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .sites__blocked-body { color: var(--gestia-muted); font-size: 12.5px; }

    .sites__list { display: flex; flex-direction: column; gap: 0.75rem; margin: 0; padding: 0; list-style: none; }

    .site { border: 1px solid var(--gestia-border); border-radius: var(--gestia-radius); }

    .site__header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 0;
      padding: 0.7rem 0.8rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .site__name { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

    .site__pill {
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .site__actions { margin-left: auto; display: flex; }

    .site__body { display: flex; gap: 1.25rem; padding: 0.7rem 0.8rem; }

    .site__field { display: flex; flex: 1; flex-direction: column; gap: 0.2rem; min-width: 0; }

    .site__label { color: var(--gestia-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; }

    .site__value { color: var(--gestia-text); font-size: 12px; overflow-wrap: anywhere; }
    .site__value--strong { font-weight: 600; }
    .site__value--missing { color: var(--gestia-warning); font-weight: 600; }

    .site__note { color: var(--gestia-muted); font-size: 11.5px; }

    .new {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .new__kicker {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .new__row { display: grid; gap: 0.7rem; }
    .new__row--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .new__row--calle { grid-template-columns: 2fr 1fr; }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

    .field__label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .field input {
      box-sizing: border-box;
      width: 100%;
      height: var(--gestia-control-height);
      padding: 0 0.7rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .field input:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .new__footer { display: flex; justify-content: flex-end; gap: 0.55rem; margin: 0; }

    .new__reason { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .button {
      height: var(--gestia-control-height);
      padding: 0 0.85rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .button:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
    .button:disabled { color: var(--gestia-muted); cursor: not-allowed; }

    .button--primary {
      border-color: var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .button--primary:disabled { border-color: var(--gestia-border); background: var(--gestia-surface); }

    @media (width < 45rem) {
      .site__body { flex-direction: column; gap: 0.6rem; }
      .new__row--three, .new__row--calle { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class ClientSites {
  /**
   * Las opciones de `ngModel`, en una sola instancia.
   *
   * <p>Escritas en la plantilla como `{ standalone: true }` se construía un objeto nuevo en
   * <b>cada ciclo de detección</b>, y `NgModel` se reconfiguraba con cada uno: la vista no
   * llegaba a estabilizarse y el proceso terminaba sin memoria. Sólo se ve con la pantalla
   * montada, porque en prueba de componente el ciclo se detiene solo.</p>
   */
  protected readonly sueltos = { standalone: true };

  readonly sites = input.required<readonly ClientSite[]>();
  readonly contacts = input<readonly ClientContact[]>([]);
  readonly canWrite = input(false);
  readonly saving = input(false);
  /** El catálogo geográfico es por organización. */
  readonly organizationId = input('');
  /** Se abre desde fuera cuando el aviso de «guardado sin sede» manda aquí. */
  readonly openAdd = input(false);

  /** La sede a editar, cuando la pide el menú de la fila. */
  readonly editing = input<ClientSite | null>(null);

  readonly act = output<{ id: string; site: ClientSite }>();
  /** «Ya no estoy editando esta sede». La pagina es la que suelta la sede, no este componente. */
  readonly closeEdit = output<void>();
  readonly edit = output<{ site: ClientSite; datos: NewSite }>();
  readonly create = output<NewSite>();

  private readonly addingByHand = signal(false);
  protected readonly adding = computed(() => this.addingByHand() || this.openAdd() || !!this.editando());

  /**
   * La sede que se esta editando, o nula si se esta creando una.
   *
   * <p>El formulario es el mismo. Antes «Editar sede» no hacia nada: el menu emitia la accion y la
   * pagina solo atendia «Ver contactos», asi que editar y desactivar caian al vacio.</p>
   */
  protected readonly editando = signal<ClientSite | null>(null);

  constructor() {
    // La orden viene del menú, que vive en la fila; el formulario vive aquí.
    //
    // El efecto manda en los DOS sentidos, y esa es la correccion. Antes solo sabia abrir: cuando
    // `editing` volvia a nulo no hacia nada, y cuando el formulario se cerraba por su cuenta el
    // efecto veia `editing` todavia puesto y lo volvia a abrir en el acto. El resultado era que
    // «Guardar sede» guardaba de verdad —la sede cambiaba en la base y salia el aviso de que habia
    // quedado actualizada— y el formulario seguia ahi, como si no hubiera pasado nada. «Cancelar»
    // hacia lo mismo.
    effect(() => {
      const pedida = this.editing();

      if (!pedida) {
        if (this.editando()) {
          this.editando.set(null);
          this.limpiar();
        }

        return;
      }

      if (pedida.idClientSite !== this.editando()?.idClientSite) {
        this.startEdit(pedida);
      }
    });
  }

  protected readonly siteName = signal('');
  protected readonly street = signal('');
  protected readonly neighborhood = signal('');
  protected readonly municipality = signal('');
  protected readonly state = signal('');
  protected readonly postalCode = signal('');

  /** Lo mínimo para que la sede sea una dirección y no un nombre suelto. */
  protected readonly ready = computed(
    () =>
      !!this.siteName().trim() &&
      !!this.street().trim() &&
      !!this.municipality().trim() &&
      !!this.state().trim() &&
      !!this.postalCode().trim(),
  );

  protected readonly actions = computed<readonly GiRowAction[]>(() => [
    {
      id: 'edit',
      label: 'Editar sede',
      disabled: !this.canWrite(),
      disabledReason: 'Necesitas permiso de escritura sobre clientes',
    },
    { id: 'contacts', label: 'Ver contactos' },
    {
      id: 'deactivate',
      label: 'Desactivar sede',
      destructive: true,
      disabled: !this.canWrite(),
      disabledReason: 'Necesitas permiso de escritura sobre clientes',
    },
  ]);


  /**
   * El estado y el municipio salen del catálogo geográfico, no de texto libre.
   *
   * <p>El servidor los valida contra `State` y `City` y rechaza cualquier otra cosa con
   * «Selecciona una ciudad o municipio activo del estado». Escribirlos a mano dejaba un formulario
   * que se llenaba entero y fallaba al guardar, sin decir dónde.</p>
   */
  protected onState(valor: string): void {
    this.state.set(valor);
    // Cambiar de estado invalida el municipio elegido: pertenecía al estado anterior.
    this.municipality.set('');
  }

  protected startAdd(): void {
    this.editando.set(null);
    this.limpiar();
    this.addingByHand.set(true);
  }

  /** Abre el mismo formulario, con la sede cargada. */
  protected startEdit(site: ClientSite): void {
    this.addingByHand.set(false);
    this.editando.set(site);
    this.siteName.set(site.name);
    this.street.set(site.street ?? '');
    this.neighborhood.set(site.neighborhood ?? '');
    this.municipality.set(site.municipality ?? '');
    this.state.set(site.state ?? '');
    this.postalCode.set(site.postalCode ?? '');
  }

  protected cancelAdd(): void {
    this.addingByHand.set(false);

    // Editando, el que suelta la sede es la pagina; cerrar aqui y no avisarle dejaba `editing`
    // apuntando a la sede, y el efecto reabria el formulario en cuanto se cerraba.
    if (this.editando()) {
      this.closeEdit.emit();
      return;
    }

    this.limpiar();
  }

  /**
   * Guarda y deja el formulario como lo encontró.
   *
   * <p><b>Antes no limpiaba ni cerraba.</b> Al guardar, la sede se creaba y el formulario se
   * quedaba abierto con los mismos datos dentro: pulsar otra vez creaba una sede idéntica, y nada
   * lo impedía. Se podían acumular duplicados sin darse cuenta.</p>
   *
   * <p>La guarda de `saving` cubre el otro camino del mismo problema: el doble clic mientras la
   * primera petición sigue en vuelo.</p>
   */
  protected submit(): void {
    if (this.saving() || !this.ready()) {
      return;
    }

    const datos: NewSite = {
      name: this.siteName().trim(),
      street: this.street().trim(),
      neighborhood: this.neighborhood().trim(),
      municipality: this.municipality().trim(),
      state: this.state().trim(),
      postalCode: this.postalCode().trim(),
    };

    const enEdicion = this.editando();

    if (enEdicion) {
      // Se cierra cuando el servidor confirma, no ahora. Cerrarlo aqui lo reabria, y ademas
      // habria borrado lo escrito si el guardado fallaba.
      this.edit.emit({ site: enEdicion, datos });
      return;
    }

    this.create.emit(datos);
    this.addingByHand.set(false);
    this.limpiar();
  }

  private limpiar(): void {
    this.siteName.set('');
    this.street.set('');
    this.neighborhood.set('');
    this.municipality.set('');
    this.state.set('');
    this.postalCode.set('');
  }

  /** El primer contacto de la sede. La marca de principal no siempre está puesta. */
  /**
   * Quién responde por esta sede.
   *
   * <p><b>Primero el contacto de la sede; si no lo hay, el del cliente.</b> Antes sólo miraba los
   * atados a la sede, y como la mayoría de los contactos se registran a nivel de cliente —23 de 26
   * en la base viva—, casi toda sede decía «Sin contacto· la sede funciona, pero nadie responde por
   * ella», con la pestaña de Contactos mostrando un número mayor que cero al lado.</p>
   *
   * <p>Un contacto del cliente cubre a todas sus sedes: para eso existe.</p>
   */
  protected contactOf(idClientSite: string): ClientContact | undefined {
    const activos = this.contacts().filter((contact) => contact.active !== false);

    return activos.find((contact) => contact.idClientSite === idClientSite)
      ?? activos.find((contact) => !contact.idClientSite);
  }

  /** Si quien responde es del cliente y no de esta sede, conviene decirlo. */
  protected contactIsFromClient(idClientSite: string): boolean {
    const contacto = this.contactOf(idClientSite);
    return !!contacto && !contacto.idClientSite;
  }

  protected address(site: ClientSite): string {
    return [
      [site.street, site.exteriorNumber].filter(Boolean).join(' '),
      site.neighborhood,
      site.municipality,
      site.state,
      site.postalCode,
    ]
      .filter((part) => !!part)
      .join(', ');
  }
}
