import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { GiCatalogPicker, GiCatalogOption, GiCatalogCreation } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { GiSelect, GiSelectOption } from '../../../shared/ui/gi-select/gi-select';
import { ClientContact, ClientContactPurpose, ClientSite } from '../data-access/client.models';

/** Lo que hace falta para dar de alta un contacto. */
export type NewContact = {
  readonly fullName: string;
  readonly purpose: ClientContactPurpose;
  readonly idClientSite: string | null;
  readonly jobTitle: string;
  readonly email: string;
  readonly phone: string;
  readonly isPrimary: boolean;
};

/**
 * La pestaña de Contactos.
 *
 * <p>Un contacto sin sede asignada no es un error: hay contactos comerciales que valen para todo
 * el cliente. Se dice cuál es cuál en lugar de esconderlo, porque quien busca a quién llamar en
 * una sede necesita distinguirlos.</p>
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
          description="Un contacto dice a quién llamar cuando algo pasa en la sede."
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
              <span class="contact__role">{{ contact.jobTitle || 'Sin puesto registrado' }}</span>
              <span class="contact__where">
                {{ contact.clientSiteName || 'Contacto del cliente, no de una sede' }}
              </span>
              <span class="contact__reach">{{ reach(contact) }}</span>
            </li>
          }
        </ul>

        @if (canWrite() && !adding()) {
          <p class="contacts__footer">
            <button class="button" type="button" (click)="startAdd()">Agregar contacto</button>
          </p>
        }
      }

      @if (adding()) {
        <form class="new" (ngSubmit)="$event.preventDefault()">
          <p class="new__kicker">NUEVO CONTACTO</p>

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
              catalogLabel="el catálogo de puestos"
              inputId="nc-puesto"
              [options]="jobPositions()"
              [value]="idJobPosition()"
              [canWrite]="canWrite()"
              (valueChange)="idJobPosition.set($event)"
              (create)="createJobPosition.emit($event)"
            />
          </div>

          <div class="new__row new__row--two">
            <gi-select
              label="Para qué se le llama"
              [options]="purposes"
              [value]="purpose()"
              (valueChange)="purpose.set($any($event))"
            />
            <!--
              Sin sede es una opción legítima y va primero: un contacto comercial vale para todo el
              cliente, y obligar a elegir una sede lo obligaría a mentir.
            -->
            <gi-select
              label="Sede a la que pertenece"
              placeholder="Del cliente, no de una sede"
              [options]="siteOptions()"
              [value]="idClientSite()"
              (valueChange)="idClientSite.set($event)"
            />
          </div>

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
              {{ saving() ? 'Guardando…' : 'Guardar contacto' }}
            </button>
          </p>
        </form>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .contacts__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

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
  readonly sites = input<readonly ClientSite[]>([]);
  readonly canWrite = input(false);
  readonly saving = input(false);

  /** Abre el alta desde fuera, como hace la pestaña de Sedes. */
  readonly openAdd = input(false);

  readonly jobPositions = input<readonly GiCatalogOption[]>([]);

  readonly create = output<NewContact>();
  readonly createJobPosition = output<GiCatalogCreation>();

  protected readonly sueltos = { standalone: true };

  protected readonly purposes: readonly GiSelectOption[] = [
    { value: 'Operational', label: 'Operación' },
    { value: 'Administrative', label: 'Administración' },
    { value: 'Billing', label: 'Facturación' },
    { value: 'Payments', label: 'Pagos' },
    { value: 'Purchasing', label: 'Compras' },
    { value: 'Legal', label: 'Legal' },
    { value: 'Emergency', label: 'Emergencias' },
    { value: 'InternalSecurity', label: 'Seguridad interna' },
  ];

  private readonly addingByHand = signal(false);
  protected readonly adding = computed(() => this.canWrite() && (this.addingByHand() || this.openAdd()));

  protected readonly fullName = signal('');
  /** El identificador del puesto, no su texto: es lo que el servidor acepta. */
  protected readonly idJobPosition = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly purpose = signal<ClientContactPurpose>('Operational');
  protected readonly idClientSite = signal('');
  protected readonly isPrimary = signal(false);

  protected readonly siteOptions = computed<readonly GiSelectOption[]>(() => [
    { value: '', label: 'Del cliente, no de una sede' },
    ...this.sites()
      .filter((site) => site.active)
      .map((site) => ({ value: site.idClientSite, label: site.name })),
  ]);

  /**
   * Un contacto necesita nombre y alguna forma de contacto.
   *
   * <p>No es una validación de formulario por costumbre: la lista ya dice «Sin teléfono ni correo
   * registrados» para los que llegaron así, y no tiene sentido crear más.</p>
   */
  protected readonly ready = computed(
    () => !!this.fullName().trim() && (!!this.email().trim() || !!this.phone().trim()),
  );

  protected startAdd(): void {
    if (!this.canWrite()) return;
    this.reset();
    this.addingByHand.set(true);
  }

  protected cancelAdd(): void {
    this.addingByHand.set(false);
    this.reset();
  }

  protected submit(): void {
    if (!this.ready() || this.saving()) return;

    this.create.emit({
      fullName: this.fullName().trim(),
      purpose: this.purpose(),
      idClientSite: this.idClientSite() || null,
      jobTitle: this.jobPositions().find((p) => p.idCatalogItem === this.idJobPosition())?.name ?? '',
      email: this.email().trim(),
      phone: this.phone().trim(),
      isPrimary: this.isPrimary(),
    });

    this.addingByHand.set(false);
    this.reset();
  }

  /** Cómo se le llega. Sin ninguno, se dice: un contacto sin forma de contacto no sirve. */
  protected reach(contact: ClientContact): string {
    const vias = [contact.mobilePhone, contact.phone, contact.email].filter((via) => !!via);
    return vias.length ? vias.join(' · ') : 'Sin teléfono ni correo registrados';
  }

  /**
   * Se vacía siempre al abrir y al cerrar.
   *
   * <p>Es lo que faltaba en el alta de sedes y por lo que se podían crear duplicados sin darse
   * cuenta: el formulario conservaba lo anterior y bastaba con volver a guardar.</p>
   */
  private reset(): void {
    this.fullName.set('');
    this.idJobPosition.set('');
    this.email.set('');
    this.phone.set('');
    this.purpose.set('Operational');
    this.idClientSite.set('');
    this.isPrimary.set(false);
  }
}
