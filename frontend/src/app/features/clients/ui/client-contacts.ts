import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { GiCatalogPicker, GiCatalogOption, GiCatalogCreation } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { GiSelect, GiSelectOption } from '../../../shared/ui/gi-select/gi-select';
import { ClientContact, ClientContactPurpose, ClientContactScope, ClientZone } from '../data-access/client.models';

/** Lo que hace falta para dar de alta un contacto. */
export type NewContact = {
  readonly fullName: string;
  /** El propósito, por identificador del catálogo. */
  readonly idPurposeCatalogItem: string | null;
  /** El propósito heredado. Se sigue mandando mientras el servidor conserve la columna. */
  readonly purpose: ClientContactPurpose;
  readonly scope: ClientContactScope;
  readonly idClientZone: string | null;
  readonly idContactJobPositionCatalogItem: string | null;
  readonly jobTitle: string;
  readonly email: string;
  readonly phone: string;
  readonly isPrimary: boolean;
};

/**
 * La pestaña de Contactos.
 *
 * <p>Un contacto sin zona asignada no es un error: hay contactos comerciales que valen para todo
 * el cliente. Se dice cuál es cuál en lugar de esconderlo, porque quien busca a quién llamar en
 * una zona necesita distinguirlos.</p>
 *
 * <p><b>El alta se agregó el 7 de septiembre de 2026.</b> Antes el botón «Agregar contacto» emitía
 * una señal que nadie escuchaba, y detrás no había formulario: la pestaña prometía algo que no
 * existía. Los endpoints sí estaban, en el servidor y en el cliente; lo único que faltaba era
 * esto.</p>
 */
@Component({
  selector: 'app-client-contacts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, GiCatalogPicker, GiEmptyState, GiSelect],
  template: `
    <section class="contacts">
      @if (contacts().length === 0 && !adding()) {
        <gi-empty-state
          variant="no-data"
          title="Este cliente todavía no tiene contactos"
          description="Un contacto dice a quién llamar cuando algo pasa en la zona."
          [actionLabel]="canWrite() ? 'Agregar contacto' : ''"
          (action)="startAdd()"
        />
      } @else {
        <ul class="contacts__list">
          @for (contact of contacts(); track contact.idClientContact) {
            <li class="contact">
              <span class="contact__main">
                <span class="contact__name">{{ contact.fullName }}</span>
                @if (contact.isPrimary) {
                  <span class="contact__pill">Principal</span>
                }
              </span>
              <span class="contact__role">
                {{ contact.contactJobPositionName || contact.jobTitle || 'Sin puesto registrado' }}
                @if (contact.purposeName) { · {{ contact.purposeName }} }
              </span>
              <span class="contact__where">
                {{ contact.clientZoneName || 'Contacto del cliente, no de una zona' }}
              </span>
              <span class="contact__reach">{{ reach(contact) }}</span>
              @if (canWrite()) {
                <!-- Editar estaba en ninguna parte: un contacto capturado con el telefono mal se
                     quedaba mal para siempre, o habia que agregar otro y dejar el viejo. -->
                <button class="contact__editar" type="button" (click)="startEdit(contact)">Editar</button>
              }
            </li>
          }
        </ul>

        <!--
          Sin boton aqui: «Agregar contacto» vive en la cabecera de la ficha, con las acciones de
          los demas apartados. Tenerlo en los dos sitios daba dos caminos al mismo formulario.
        -->
      }

      @if (adding()) {
        <form class="new" (ngSubmit)="$event.preventDefault()">
          <p class="new__kicker">{{ editando() ? 'EDITAR CONTACTO' : 'NUEVO CONTACTO' }}</p>

          <div class="new__row new__row--two">
            <label class="field" for="nc-nombre">
              <span class="field__label">NOMBRE COMPLETO</span>
              <input id="nc-nombre" name="fullName" type="text" autocomplete="off"
                [ngModel]="fullName()" (ngModelChange)="fullName.set($event)" [ngModelOptions]="sueltos" />
            </label>
            <!--
              El puesto NO es texto libre, aunque la caja lo pareciera: el servidor lo valida contra
              el catalogo de puestos y devuelve 409 con cualquier cosa escrita a mano. Es el mismo
              selector que usa Personal, con alta al vuelo para no obligar a salir a Catalogos.
            -->
            <gi-catalog-picker
              label="Puesto"
              catalogLabel="el catálogo de puestos de contacto"
              inputId="nc-puesto"
              [options]="jobPositions()"
              [value]="idContactJobPosition()"
              [canWrite]="canWrite()"
              (valueChange)="idContactJobPosition.set($event)"
              (create)="createJobPosition.emit($event)"
            />
          </div>

          <div class="new__row new__row--two">
            <gi-catalog-picker
              label="Para qué se le llama"
              catalogLabel="el catálogo de propósitos de contacto"
              inputId="nc-proposito"
              [options]="purposeOptions()"
              [value]="idPurpose()"
              [canWrite]="canWrite()"
              (valueChange)="idPurpose.set($event)"
              (create)="createPurpose.emit($event)"
            />
            <!--
              Sin zona es una opción legítima y va primero: un contacto comercial vale para todo el
              cliente, y obligar a elegir una zona lo obligaría a mentir.
            -->
            <gi-select
              label="A quién cubre"
              [options]="scopeOptions"
              [value]="scope()"
              (valueChange)="scope.set($any($event))"
            />
          </div>

          @if (scope() === 'Zone') {
            <div class="new__row">
              <gi-select
                label="Zona a la que pertenece"
                placeholder="Elige la zona"
                [options]="zoneOptions()"
                [value]="idClientZone()"
                (valueChange)="idClientZone.set($event)"
              />
            </div>
          }

          <div class="new__row new__row--two">
            <label class="field" for="nc-correo">
              <span class="field__label">CORREO</span>
              <input id="nc-correo" name="email" type="email" autocomplete="off"
                [ngModel]="email()" (ngModelChange)="email.set($event)" [ngModelOptions]="sueltos" />
            </label>
            <label class="field" for="nc-telefono">
              <span class="field__label">TELÉFONO</span>
              <input id="nc-telefono" name="phone" type="tel" autocomplete="off"
                [ngModel]="phone()" (ngModelChange)="phone.set($event)" [ngModelOptions]="sueltos" />
            </label>
          </div>

          <label class="check" for="nc-principal">
            <input id="nc-principal" name="isPrimary" type="checkbox"
              [ngModel]="isPrimary()" (ngModelChange)="isPrimary.set($event)" [ngModelOptions]="sueltos" />
            <span>Es el contacto principal</span>
          </label>

          @if (!ready()) {
            <p class="new__reason">Falta el nombre, y al menos un correo o un teléfono: un contacto
              al que no se puede llamar no sirve para lo que existe.</p>
          }

          <p class="new__footer">
            <button class="button" type="button" (click)="cancelAdd()">Cancelar</button>
            <button class="button button--primary" type="button"
              [disabled]="saving() || !ready()" (click)="submit()">
              {{ saving() ? 'Guardando…' : editando() ? 'Guardar cambios' : 'Guardar contacto' }}
            </button>
          </p>
        </form>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .contacts__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

    .contact__editar {
      justify-self: start;
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

    .contact__editar:hover { border-color: var(--gestia-cyan-dark); }
    .contact__editar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .contact {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.7rem 0;
      border-bottom: 1px solid var(--gestia-border);
    }

    .contact:last-child { border-bottom: 0; }

    .contact__main { display: flex; align-items: center; gap: 0.45rem; }

    .contact__name { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

    .contact__pill {
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--gestia-cyan-dark);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-cyan-dark);
      font-size: 10.5px;
      font-weight: 600;
    }

    .contact__role, .contact__where, .contact__reach { color: var(--gestia-muted); font-size: 11.5px; }

    .contacts__footer { display: flex; justify-content: flex-end; margin: 0.7rem 0 0; }

    .new {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      margin-top: 0.7rem;
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
    .new__row--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }

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

    .check { display: flex; align-items: center; gap: 0.5rem; font-size: 12.5px; }

    .check input:focus-visible { outline: 2px solid var(--gestia-cyan); }

    .new__footer { display: flex; justify-content: flex-end; gap: 0.55rem; margin: 0; }

    .new__reason { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    @media (max-width: 48rem) {
      .new__row--two { grid-template-columns: 1fr; }
    }
  `,
})
export class ClientContacts {
  readonly contacts = input.required<readonly ClientContact[]>();
  readonly zones = input<readonly ClientZone[]>([]);
  readonly canWrite = input(false);
  readonly saving = input(false);

  /** Abre el alta desde fuera, como hace la pestaña de Zonas. */
  readonly openAdd = input(false);

  readonly jobPositions = input<readonly GiCatalogOption[]>([]);

  /** Los propósitos del catálogo de la organización, desde la conversión del 19 de septiembre. */
  readonly purposes = input<readonly GiCatalogOption[]>([]);

  readonly create = output<NewContact>();
  readonly edit = output<{ contact: ClientContact; datos: NewContact }>();
  readonly closeAdd = output<void>();

  /** El contacto que se esta editando, o nulo si el formulario es un alta. */
  protected readonly editando = signal<ClientContact | null>(null);
  readonly createJobPosition = output<GiCatalogCreation>();
  readonly createPurpose = output<GiCatalogCreation>();

  protected readonly sueltos = { standalone: true };

  /**
   * A quién cubre el contacto.
   *
   * <p>«Del cliente» va primero porque es el caso normal: veintitrés de los veintiséis contactos de
   * la base viva son del cliente, no de una zona.</p>
   */
  protected readonly scopeOptions: readonly GiSelectOption[] = [
    { value: 'General', label: 'A todo el cliente' },
    { value: 'Zone', label: 'Sólo a una zona' },
  ];

  protected readonly purposeOptions = computed(() => this.purposes());

  private readonly addingByHand = signal(false);
  protected readonly adding = computed(() => this.canWrite() && (this.addingByHand() || this.openAdd()));

  protected readonly fullName = signal('');
  /** El identificador del puesto, no su texto: es lo que el servidor acepta. */
  protected readonly idContactJobPosition = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly purpose = signal<ClientContactPurpose>('Operational');
  protected readonly idPurpose = signal('');
  protected readonly scope = signal<ClientContactScope>('General');
  protected readonly idClientZone = signal('');
  protected readonly isPrimary = signal(false);

  protected readonly zoneOptions = computed<readonly GiSelectOption[]>(() => [
    ...this.zones()
      .filter((zone) => zone.active)
      .map((zone) => ({ value: zone.idClientZone, label: zone.name })),
  ]);

  /**
   * Un contacto necesita nombre y alguna forma de contacto.
   *
   * <p>No es una validación de formulario por costumbre: la lista ya dice «Sin teléfono ni correo
   * registrados» para los que llegaron así, y no tiene sentido crear más.</p>
   */
  protected readonly ready = computed(
    () =>
      !!this.fullName().trim() &&
      (!!this.email().trim() || !!this.phone().trim()) &&
      // Con alcance de zona hay que decir cuál. El servidor lo rechaza igual; decirlo aquí evita
      // que el usuario mande una petición que ya se sabe que va a fallar.
      (this.scope() === 'General' || !!this.idClientZone()),
  );

  protected startAdd(): void {
    if (!this.canWrite()) return;
    this.reset();
    this.editando.set(null);
    this.addingByHand.set(true);
  }

  /**
   * Abre el mismo formulario, prellenado.
   *
   * <p>Editar no estaba en ninguna parte: un contacto capturado con el telefono mal se quedaba mal
   * para siempre, o habia que agregar otro y dejar el viejo colgando. El formulario es el mismo
   * porque los campos son los mismos; lo unico que cambia es de donde salen los valores y a donde
   * va el resultado.</p>
   */
  protected startEdit(contact: ClientContact): void {
    if (!this.canWrite()) return;

    this.reset();
    this.fullName.set(contact.fullName);
    this.email.set(contact.email ?? '');
    this.phone.set(contact.phone ?? '');
    this.purpose.set(contact.purpose);
    this.idPurpose.set(contact.idPurposeCatalogItem ?? '');
    this.scope.set(contact.scope);
    this.idClientZone.set(contact.idClientZone ?? '');
    this.isPrimary.set(contact.isPrimary);
    // Por identificador, no por nombre: el contacto ya lo trae desde la conversión del catálogo, y
    // buscarlo por texto fallaba en cuanto alguien renombraba el puesto.
    this.idContactJobPosition.set(contact.idContactJobPositionCatalogItem ?? '');

    this.editando.set(contact);
    this.addingByHand.set(true);
  }

  protected cancelAdd(): void {
    this.addingByHand.set(false);
    this.editando.set(null);
    this.reset();
    this.closeAdd.emit();
  }

  protected submit(): void {
    if (!this.ready() || this.saving()) return;

    const datos: NewContact = {
      fullName: this.fullName().trim(),
      idPurposeCatalogItem: this.idPurpose() || null,
      purpose: this.purpose(),
      scope: this.scope(),
      // Con alcance general la zona no viaja, aunque haya quedado elegida antes de cambiar de
      // alcance: el servidor la descartaría igual, y mandarla haría creer que se guardó.
      idClientZone: this.scope() === 'Zone' ? this.idClientZone() || null : null,
      idContactJobPositionCatalogItem: this.idContactJobPosition() || null,
      jobTitle: this.jobPositions().find((p) => p.idCatalogItem === this.idContactJobPosition())?.name ?? '',
      email: this.email().trim(),
      phone: this.phone().trim(),
      isPrimary: this.isPrimary(),
    };

    const enEdicion = this.editando();

    if (enEdicion) {
      this.edit.emit({ contact: enEdicion, datos });
    } else {
      this.create.emit(datos);
    }

    this.addingByHand.set(false);
    this.editando.set(null);
    this.reset();
    this.closeAdd.emit();
  }

  /** Cómo se le llega. Sin ninguno, se dice: un contacto sin forma de contacto no sirve. */
  protected reach(contact: ClientContact): string {
    const vias = [contact.mobilePhone, contact.phone, contact.email].filter((via) => !!via);
    return vias.length ? vias.join(' · ') : 'Sin teléfono ni correo registrados';
  }

  /**
   * Se vacía siempre al abrir y al cerrar.
   *
   * <p>Es lo que faltaba en el alta de zonas y por lo que se podían crear duplicados sin darse
   * cuenta: el formulario conservaba lo anterior y bastaba con volver a guardar.</p>
   */
  private reset(): void {
    this.fullName.set('');
    this.idContactJobPosition.set('');
    this.email.set('');
    this.phone.set('');
    this.purpose.set('Operational');
    this.idPurpose.set('');
    this.scope.set('General');
    this.idClientZone.set('');
    this.isPrimary.set(false);
  }
}
