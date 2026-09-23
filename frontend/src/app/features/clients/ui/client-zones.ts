import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DireccionPorCodigoPostal } from '../../../shared/data-access/direccion-por-codigo-postal';
import { CatalogSelect } from '../../../shared/ui/catalog-select/catalog-select';
import { GiEmptyState, GiSelect, GiSelectOption } from '../../../shared/ui/gi-ui';
import { ClientContact, ClientZone } from '../data-access/client.models';

/** Lo que hace falta para dar de alta una zona. Nada más: el código lo pone el sistema. */
export type NewZone = {
  readonly name: string;
  readonly street: string;
  readonly neighborhood: string;
  readonly municipality: string;
  readonly state: string;
  readonly postalCode: string;
  /** El país, en clave. Iba fijo en «MX» hasta el 22 de septiembre de 2026. */
  readonly countryCode: string;
};

/**
 * La pestaña de Zonas.
 *
 * <p>Aquí se dice lo que la pantalla existe para decir: <b>sin zona no se puede crear un
 * servicio</b>, porque el servicio se liga a una zona. El aviso llega al mirar al cliente y no dos
 * pantallas después, al fallar el alta del servicio.</p>
 *
 * <p>El vacío no es «no hay nada»: es <b>falta un prerrequisito</b>, y por eso usa esa variante y
 * ofrece, ahí mismo, el formulario que lo resuelve.</p>
 */
@Component({
  selector: 'app-client-zones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CatalogSelect, FormsModule, GiEmptyState, GiSelect],
  // Una por formulario abierto: el domicilio a medio escribir es de esta pestaña, no de la
  // aplicación entera.
  providers: [DireccionPorCodigoPostal],
  template: `
    <section class="zones">
      @if (adding()) {
        <form class="new" (ngSubmit)="$event.preventDefault()">
          <p class="new__kicker">{{ editando() ? 'EDITAR ZONA' : 'NUEVA ZONA' }}</p>

          <label class="field" for="ns-nombre">
            <span class="field__label">NOMBRE DE LA ZONA</span>
            <input id="ns-nombre" name="name" type="text" [ngModel]="zoneName()" (ngModelChange)="zoneName.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          </label>

          <div class="new__row new__row--calle">
            <label class="field" for="ns-calle">
              <span class="field__label">CALLE Y NÚMERO</span>
              <input id="ns-calle" name="street" type="text" [ngModel]="street()" (ngModelChange)="street.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
            </label>
            <label class="field" for="ns-cp">
              <span class="field__label">CÓDIGO POSTAL</span>
              <input id="ns-cp" name="postalCode" type="text" inputmode="numeric" maxlength="5" [ngModel]="direccion.postalCode()" (ngModelChange)="direccion.onPostalCode($event)" [ngModelOptions]="sueltos" autocomplete="off" />
              @if (direccion.buscando()) {
                <small class="field__nota">Buscando…</small>
              } @else if (direccion.sinPadron()) {
                <small class="field__nota" role="status">No está en el padrón. Elige el estado y el municipio abajo.</small>
              }
            </label>
          </div>

          <!--
            El país se elige, no se supone. Iba fijo en «MX» y los otros dos desplegables lo
            recibían como constante: una organización que opere fuera no podía capturar una zona, y
            nada en la pantalla lo decía. Ahora encabeza la cascada —país, estado, municipio— y
            cambiarlo invalida lo de abajo, que pertenecía al país anterior.
          -->
          <div class="new__row new__row--three">
            <label class="field" for="ns-pais">
              <span class="field__label">PAÍS</span>
              <app-catalog-select
                id="ns-pais"
                type="Country"
                label="País"
                [organizationId]="organizationId()"
                [ngModel]="direccion.countryCode()"
                (ngModelChange)="direccion.onCountry($event)"
                [ngModelOptions]="sueltos"
              />
            </label>
            <!--
              La colonia es desplegable cuando el código postal la resolvió, y texto libre cuando
              no. «Otra» está siempre: el padrón se publica cada tanto y los fraccionamientos
              nuevos tardan en entrar, así que no puede impedir la captura.
            -->
            <label class="field" for="ns-colonia">
              <span class="field__label">COLONIA</span>
              @if (direccion.coloniaEnLista()) {
                <gi-select
                  id="ns-colonia"
                  label="Colonia"
                  placeholder="Selecciona la colonia"
              [openDown]="true"
                  [openDown]="true"
                  [options]="direccion.opcionesDeColonia()"
                  [value]="direccion.neighborhood()"
                  (valueChange)="direccion.onColonia($event)"
                />
              } @else {
                <input id="ns-colonia" name="neighborhood" type="text" [ngModel]="direccion.neighborhood()" (ngModelChange)="direccion.neighborhood.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
              }
            </label>
            <label class="field" for="ns-estado">
              <span class="field__label">ESTADO</span>
              <app-catalog-select
                id="ns-estado"
                type="State"
                label="Estado"
                [country]="direccion.countryCode()"
                [organizationId]="organizationId()"
                [ngModel]="direccion.state()"
                (ngModelChange)="direccion.onState($event)"
                [ngModelOptions]="sueltos"
              />
            </label>
            <label class="field" for="ns-municipio">
              <span class="field__label">MUNICIPIO</span>
              <app-catalog-select
                id="ns-municipio"
                type="City"
                label="Municipio"
                [country]="direccion.countryCode()"
                [state]="direccion.state()"
                [organizationId]="organizationId()"
                [ngModel]="direccion.municipality()"
                (ngModelChange)="direccion.municipality.set($event)"
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
            >Guardar zona</button>
          </p>

          <!-- La razón se escribe. Un botón gris sin explicación obliga a adivinar. -->
          <p class="new__reason" id="ns-falta" [hidden]="ready()">
            Hacen falta el nombre, la calle, el municipio, el estado y el código postal.
          </p>
        </form>
      } @else if (zones().length === 0) {
        @if (canWrite()) {
          <gi-empty-state
            variant="missing-prerequisite"
            title="Este cliente todavía no tiene zona"
            description="El servicio se liga a una zona, así que sin zona no se puede crear el servicio de este cliente. Con la dirección y un contacto queda resuelto."
            actionLabel="Agregar zona"
            (action)="startAdd()"
          />
        } @else {
          <!--
            Sin permiso de escritura esto sí es un callejón, y el sistema prohíbe con razón un
            vacío que no ofrece salida. Se dice la verdad en su lugar: falta la zona, y quién
            puede ponerla.
          -->
          <p class="zones__blocked">
            <span class="zones__blocked-title">Este cliente todavía no tiene zona</span>
            <span class="zones__blocked-body">
              Sin zona no se le pueden crear servicios. Lo resuelve quien administra clientes en tu
              organización.
            </span>
          </p>
        }
      } @else {
        <!--
          Sin boton aqui: «Agregar zona» vive en la cabecera de la ficha, con las acciones de los
          demas apartados. Estaba en los dos sitios a la vez, uno encima del otro, y eran el mismo.
          El de la lista vacia si se queda: ahi no hay cabecera que mirar todavia, y esa pantalla
          existe para decir que falta la zona y como ponerla.
        -->
        <p class="zones__intro">
          <span>Cada servicio se liga a una zona. Al crear el servicio se elige de esta lista.</span>
        </p>

        <ul class="zones__list">
          @for (zone of zones(); track zone.idClientZone) {
            @let contact = contactOf(zone.idClientZone);
            <li class="zone">
              <p class="zone__header">
                <span class="zone__name">{{ zone.name }}</span>
                @if (!contact) {
                  <span class="zone__pill">Sin contacto</span>
                }
                <!--
                  Sin menu de tres puntos: las acciones se ven. El menu escondia «Editar zona»
                  detras de un clic y de un icono que no dice nada, y habia que abrirlo para
                  descubrir que se podia hacer con la zona.
                -->
                @if (canWrite()) {
                  <span class="zone__actions">
                    <button class="zone__accion" type="button" (click)="act.emit({ id: 'edit', zone })">
                      Editar
                    </button>
                    <button class="zone__accion zone__accion--baja" type="button" (click)="act.emit({ id: 'deactivate', zone })">
                      Desactivar
                    </button>
                  </span>
                }
              </p>

              <div class="zone__body">
                <span class="zone__field">
                  <span class="zone__label">DIRECCIÓN</span>
                  <span class="zone__value">{{ address(zone) }}</span>
                </span>
                <span class="zone__field">
                  <span class="zone__label">CONTACTO</span>
                  @if (contact) {
                    <span class="zone__value zone__value--strong">{{ contact.fullName }}</span>
                    <span class="zone__note">
                      {{ contact.jobTitle || 'Sin puesto registrado' }}@if (contactIsFromClient(zone.idClientZone)) { · contacto del cliente }
                    </span>
                  } @else {
                    <span class="zone__value zone__value--missing">Sin contacto</span>
                    <span class="zone__note">La zona funciona, pero nadie responde por ella.</span>
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

    .zones { display: flex; flex-direction: column; gap: 0.75rem; }

    .zones__intro {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0;
      color: var(--gestia-muted);
      font-size: 12px;
    }

    .zones__add {
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

    .zones__add:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .zones__blocked {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .zones__blocked-title { color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .zones__blocked-body { color: var(--gestia-muted); font-size: 12.5px; }

    .zones__list { display: flex; flex-direction: column; gap: 0.75rem; margin: 0; padding: 0; list-style: none; }

    .zone { border: 1px solid var(--gestia-border); border-radius: var(--gestia-radius); }

    .zone__header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 0;
      padding: 0.7rem 0.8rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .zone__name { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

    .zone__pill {
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .zone__actions { display: flex; gap: 0.35rem; }

    .zone__accion {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.15rem 0.5rem;
      background: var(--gestia-surface);
      color: var(--gestia-navy);
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .zone__accion:hover { border-color: var(--gestia-cyan-dark); }
    .zone__accion:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
    .zone__accion--baja { color: var(--gestia-danger); }

    .zone__actions-vieja { margin-left: auto; display: flex; }

    .zone__body { display: flex; gap: 1.25rem; padding: 0.7rem 0.8rem; }

    .zone__field { display: flex; flex: 1; flex-direction: column; gap: 0.2rem; min-width: 0; }

    .zone__label { color: var(--gestia-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; }

    .zone__value { color: var(--gestia-text); font-size: 12px; overflow-wrap: anywhere; }
    .zone__value--strong { font-weight: 600; }
    .zone__value--missing { color: var(--gestia-warning); font-weight: 600; }

    .zone__note { color: var(--gestia-muted); font-size: 11.5px; }

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
    .new__row--three { grid-template-columns: repeat(4, minmax(0, 1fr)); }
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

    .field__nota { color: var(--gestia-muted); font-size: 11px; }

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
      .zone__body { flex-direction: column; gap: 0.6rem; }
      .new__row--three, .new__row--calle { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class ClientZones {
  /**
   * Las opciones de `ngModel`, en una sola instancia.
   *
   * <p>Escritas en la plantilla como `{ standalone: true }` se construía un objeto nuevo en
   * <b>cada ciclo de detección</b>, y `NgModel` se reconfiguraba con cada uno: la vista no
   * llegaba a estabilizarse y el proceso terminaba sin memoria. Sólo se ve con la pantalla
   * montada, porque en prueba de componente el ciclo se detiene solo.</p>
   */
  protected readonly sueltos = { standalone: true };

  readonly zones = input.required<readonly ClientZone[]>();
  readonly contacts = input<readonly ClientContact[]>([]);
  readonly canWrite = input(false);
  readonly saving = input(false);
  /** El catálogo geográfico es por organización. */
  readonly organizationId = input('');
  /** Se abre desde fuera cuando el aviso de «guardado sin zona» manda aquí. */
  readonly openAdd = input(false);

  /** La zona a editar, cuando la pide el menú de la fila. */
  readonly editing = input<ClientZone | null>(null);

  readonly act = output<{ id: string; zone: ClientZone }>();
  /** «Ya no estoy editando esta zona». La pagina es la que suelta la zona, no este componente. */
  readonly closeEdit = output<void>();

  /**
   * El alta se cerro.
   *
   * <p>Hace falta desde que «Agregar zona» vive en la cabecera de la ficha: quien decide abrirla es
   * la pagina, y sin este aviso cancelar apagaba la bandera de aqui dentro pero no la de alla. El
   * formulario se quedaba abierto y no habia forma de cerrarlo.</p>
   */
  readonly closeAdd = output<void>();
  readonly edit = output<{ zone: ClientZone; datos: NewZone }>();
  readonly create = output<NewZone>();

  private readonly addingByHand = signal(false);
  protected readonly adding = computed(() => this.addingByHand() || this.openAdd() || !!this.editando());

  /**
   * La zona que se esta editando, o nula si se esta creando una.
   *
   * <p>El formulario es el mismo. Antes «Editar zona» no hacia nada: el menu emitia la accion y la
   * pagina solo atendia «Ver contactos», asi que editar y desactivar caian al vacio.</p>
   */
  protected readonly editando = signal<ClientZone | null>(null);

  constructor() {
    // La orden viene del menú, que vive en la fila; el formulario vive aquí.
    //
    // El efecto manda en los DOS sentidos, y esa es la correccion. Antes solo sabia abrir: cuando
    // `editing` volvia a nulo no hacia nada, y cuando el formulario se cerraba por su cuenta el
    // efecto veia `editing` todavia puesto y lo volvia a abrir en el acto. El resultado era que
    // «Guardar zona» guardaba de verdad —la zona cambiaba en la base y salia el aviso de que habia
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

      if (pedida.idClientZone !== this.editando()?.idClientZone) {
        this.startEdit(pedida);
      }
    });
  }

  protected readonly zoneName = signal('');
  protected readonly street = signal('');

  /** El domicilio, con su código postal al mando. Compartido con el expediente de personal. */
  protected readonly direccion = inject(DireccionPorCodigoPostal);

  /** Lo mínimo para que la zona sea una dirección y no un nombre suelto. */
  protected readonly ready = computed(
    () =>
      !!this.zoneName().trim() &&
      !!this.street().trim() &&
      !!this.direccion.municipality().trim() &&
      !!this.direccion.state().trim() &&
      !!this.direccion.postalCode().trim(),
  );

  protected startAdd(): void {
    this.editando.set(null);
    this.limpiar();
    this.addingByHand.set(true);
  }

  /** Abre el mismo formulario, con la zona cargada. */
  protected startEdit(zone: ClientZone): void {
    this.addingByHand.set(false);
    this.editando.set(zone);
    this.zoneName.set(zone.name);
    this.street.set(zone.street ?? '');
    this.direccion.cargar(zone);
  }

  protected cancelAdd(): void {
    this.addingByHand.set(false);

    // Editando, el que suelta la zona es la pagina; cerrar aqui y no avisarle dejaba `editing`
    // apuntando a la zona, y el efecto reabria el formulario en cuanto se cerraba.
    if (this.editando()) {
      this.closeEdit.emit();
      return;
    }

    this.limpiar();
    this.closeAdd.emit();
  }

  /**
   * Guarda y deja el formulario como lo encontró.
   *
   * <p><b>Antes no limpiaba ni cerraba.</b> Al guardar, la zona se creaba y el formulario se
   * quedaba abierto con los mismos datos dentro: pulsar otra vez creaba una zona idéntica, y nada
   * lo impedía. Se podían acumular duplicados sin darse cuenta.</p>
   *
   * <p>La guarda de `saving` cubre el otro camino del mismo problema: el doble clic mientras la
   * primera petición sigue en vuelo.</p>
   */
  protected submit(): void {
    if (this.saving() || !this.ready()) {
      return;
    }

    const datos: NewZone = {
      name: this.zoneName().trim(),
      street: this.street().trim(),
      neighborhood: this.direccion.neighborhood().trim(),
      municipality: this.direccion.municipality().trim(),
      state: this.direccion.state().trim(),
      postalCode: this.direccion.postalCode().trim(),
      countryCode: this.direccion.countryCode(),
    };

    const enEdicion = this.editando();

    if (enEdicion) {
      // Se cierra cuando el servidor confirma, no ahora. Cerrarlo aqui lo reabria, y ademas
      // habria borrado lo escrito si el guardado fallaba.
      this.edit.emit({ zone: enEdicion, datos });
      return;
    }

    this.create.emit(datos);
    this.addingByHand.set(false);
    this.limpiar();
    this.closeAdd.emit();
  }

  private limpiar(): void {
    this.zoneName.set('');
    this.street.set('');
    this.direccion.limpiar();
  }


  /** El primer contacto de la zona. La marca de principal no siempre está puesta. */
  /**
   * Quién responde por esta zona.
   *
   * <p><b>Primero el contacto de la zona; si no lo hay, el del cliente.</b> Antes sólo miraba los
   * atados a la zona, y como la mayoría de los contactos se registran a nivel de cliente —23 de 26
   * en la base viva—, casi toda zona decía «Sin contacto· la zona funciona, pero nadie responde por
   * ella», con la pestaña de Contactos mostrando un número mayor que cero al lado.</p>
   *
   * <p>Un contacto del cliente cubre a todas sus zonas: para eso existe.</p>
   */
  protected contactOf(idClientZone: string): ClientContact | undefined {
    const activos = this.contacts().filter((contact) => contact.active !== false);

    return activos.find((contact) => contact.idClientZone === idClientZone)
      ?? activos.find((contact) => !contact.idClientZone);
  }

  /** Si quien responde es del cliente y no de esta zona, conviene decirlo. */
  protected contactIsFromClient(idClientZone: string): boolean {
    const contacto = this.contactOf(idClientZone);
    return !!contacto && !contacto.idClientZone;
  }

  protected address(zone: ClientZone): string {
    return [
      [zone.street, zone.exteriorNumber].filter(Boolean).join(' '),
      zone.neighborhood,
      zone.municipality,
      zone.state,
      zone.postalCode,
    ]
      .filter((part) => !!part)
      .join(', ');
  }
}
