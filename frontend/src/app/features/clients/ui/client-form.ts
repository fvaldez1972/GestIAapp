import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DireccionPorCodigoPostal } from '../../../shared/data-access/direccion-por-codigo-postal';
import { CatalogSelect } from '../../../shared/ui/catalog-select/catalog-select';
import { GiCatalogPicker, GiCatalogOption, GiCatalogCreation } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { GiSelect } from '../../../shared/ui/gi-select/gi-select';
import { ServerProblem, fieldError } from '../../../shared/util/server-problem';

/** Lo que el formulario devuelve. La zona y el contacto van aparte porque pueden no ir. */
export type ClientFormValue = {
  readonly legalName: string;
  readonly tradeName: string;
  readonly rfc: string;
  readonly zone: {
    readonly name: string;
    readonly street: string;
    readonly neighborhood: string;
    readonly municipality: string;
    readonly state: string;
    readonly postalCode: string;
  };
  readonly contact: {
    readonly fullName: string;
    readonly jobTitle: string;
    readonly phone: string;
    readonly email: string;
  };
};

/**
 * El alta de un cliente, con su zona y su contacto.
 *
 * <p><b>Aquí se dice que la zona es obligatoria para crear servicios</b>, antes de guardar y no al
 * fallar el paso siguiente. El bloque lleva el motivo en su propio rótulo, y las dos salidas dicen
 * exactamente qué hace cada una: «Guardar cliente y zona» deja el paso completo, «Guardar sin
 * zona» deja un expediente válido que todavía no permite servicios.</p>
 *
 * <p>No hay campo de código ni de fecha de alta: los pone el servidor. Pedirle al usuario que
 * invente un identificador es pedirle que resuelva un problema del sistema.</p>
 */
@Component({
  selector: 'app-client-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CatalogSelect, FormsModule, GiCatalogPicker, GiSelect],
  // Uno por formulario abierto: el domicilio a medio escribir es de esta alta, no de la aplicación.
  providers: [DireccionPorCodigoPostal],
  template: `
    <form class="form" (ngSubmit)="$event.preventDefault()">
      <section class="form__block">
        <!--
          Secciones numeradas con su línea de qué hacen, como la maqueta. Sin los iconos
          circulares: no dicen nada que el título no diga ya.
        -->
        <p class="form__paso"><span class="form__num">1</span> Identificación</p>

        <label class="field field--wide" for="cf-razon">
          <span class="field__label">RAZÓN SOCIAL<span class="field__req" aria-hidden="true">*</span></span>
          <input id="cf-razon" name="legalName" type="text" [ngModel]="legalName()" (ngModelChange)="legalName.set($event)" [ngModelOptions]="sueltos" autocomplete="off"
            [class.is-invalid]="errorDe('legalName')" [attr.aria-invalid]="errorDe('legalName') ? 'true' : null" />
          @if (errorDe('legalName'); as falla) {
            <small class="field__error" role="alert">{{ falla }}</small>
          }
        </label>

        <div class="form__row form__row--two">
          <label class="field" for="cf-corto">
            <span class="field__label">NOMBRE CORTO</span>
            <input id="cf-corto" name="tradeName" type="text" [ngModel]="tradeName()" (ngModelChange)="tradeName.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          </label>
          <label class="field" for="cf-rfc">
            <!-- El bosquejo lo marcaba opcional. No lo es: el servidor lo usa para la unicidad
                 del cliente junto con el código. -->
            <span class="field__label">RFC<span class="field__req" aria-hidden="true">*</span></span>
            <input id="cf-rfc" name="rfc" type="text" [ngModel]="rfc()" (ngModelChange)="rfc.set($event)" [ngModelOptions]="sueltos" placeholder="Trece caracteres" autocomplete="off"
              [class.is-invalid]="errorDe('rfc')" [attr.aria-invalid]="errorDe('rfc') ? 'true' : null" />
            @if (errorDe('rfc'); as falla) {
              <small class="field__error" role="alert">{{ falla }}</small>
            }
          </label>
        </div>
      </section>

      <section class="form__block">
        <!--
          «Zona» a secas, no «Zona principal». El modelo no tiene jerarquía entre zonas —lo que la
          lista llamaba principal era la primera por nombre— y ponerlo en el título del alta sería
          inventar un concepto que no existe.
        -->
        <p class="form__paso"><span class="form__num">2</span> Zona</p>

        <label class="field field--wide" for="cf-zona">
          <span class="field__label">NOMBRE DE LA ZONA<span class="field__req" aria-hidden="true">*</span></span>
          <input id="cf-zona" name="zoneName" type="text" [ngModel]="zoneName()" (ngModelChange)="zoneName.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
        </label>

        <div class="form__row form__row--calle">
          <label class="field" for="cf-calle">
            <span class="field__label">CALLE Y NÚMERO<span class="field__req" aria-hidden="true">*</span></span>
            <input id="cf-calle" name="street" type="text" [ngModel]="street()" (ngModelChange)="street.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          </label>
          <label class="field" for="cf-cp">
            <span class="field__label">CÓDIGO POSTAL<span class="field__req" aria-hidden="true">*</span></span>
            <input id="cf-cp" name="postalCode" type="text" inputmode="numeric" maxlength="5" [ngModel]="direccion.postalCode()" (ngModelChange)="direccion.onPostalCode($event)" [ngModelOptions]="sueltos" autocomplete="off" />
            @if (direccion.buscando()) {
              <small class="field__nota">Buscando…</small>
            } @else if (direccion.sinPadron()) {
              <small class="field__nota" role="status">No está en el padrón. Elige el estado y el municipio abajo.</small>
            }
          </label>
        </div>

        <div class="form__row form__row--three">
          <label class="field" for="cf-colonia">
            <span class="field__label">COLONIA</span>
            @if (direccion.coloniaEnLista()) {
              <gi-select
                id="cf-colonia"
                label="Colonia"
                placeholder="Selecciona la colonia"
                [openDown]="true"
                [options]="direccion.opcionesDeColonia()"
                [value]="direccion.neighborhood()"
                (valueChange)="direccion.onColonia($event)"
              />
            } @else {
              <input id="cf-colonia" name="neighborhood" type="text" [ngModel]="direccion.neighborhood()" (ngModelChange)="direccion.neighborhood.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
            }
          </label>
          <label class="field" for="cf-estado">
            <span class="field__label">ESTADO<span class="field__req" aria-hidden="true">*</span></span>
            <app-catalog-select
              id="cf-estado"
              type="State"
              label="Estado"
              [country]="direccion.countryCode()"
              [organizationId]="organizationId()"
              [ngModel]="direccion.state()"
              (ngModelChange)="direccion.onState($event)"
              [ngModelOptions]="sueltos"
            />
          </label>
          <label class="field" for="cf-municipio">
            <span class="field__label">MUNICIPIO<span class="field__req" aria-hidden="true">*</span></span>
            <app-catalog-select
              id="cf-municipio"
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
      </section>

      <section class="form__block">
        <p class="form__paso"><span class="form__num">3</span> Contacto</p>
        <div class="form__row form__row--two">
          <label class="field" for="cf-cnombre">
            <span class="field__label">NOMBRE</span>
            <input id="cf-cnombre" name="contactName" type="text" [ngModel]="contactName()" (ngModelChange)="contactName.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          </label>
          <label class="field" for="cf-cpuesto">
            <!--
              El puesto del contacto NO es texto libre: el servidor lo valida contra el catálogo de
              puestos y devuelve 409 con cualquier cosa escrita a mano. Cuando eso pasaba, el alta
              guardaba el cliente y la zona, se tragaba el rechazo del contacto y la zona acababa
              diciendo «sin contacto» sin que nadie supiera por qué.
            -->
            <gi-catalog-picker
              label="PUESTO"
              catalogLabel="el catálogo de puestos"
              inputId="cf-cpuesto"
              [showInvitation]="false"
              [options]="jobPositions()"
              [value]="idContactJobPosition()"
              [canWrite]="canWrite()"
              (valueChange)="idContactJobPosition.set($event)"
              (create)="createJobPosition.emit($event)"
            />
          </label>
          <label class="field" for="cf-ctel">
            <span class="field__label">TELÉFONO</span>
            <input id="cf-ctel" name="contactPhone" type="text" [ngModel]="contactPhone()" (ngModelChange)="contactPhone.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          </label>
          <label class="field" for="cf-ccorreo">
            <span class="field__label">CORREO</span>
            <input id="cf-ccorreo" name="contactEmail" type="text" [ngModel]="contactEmail()" (ngModelChange)="contactEmail.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          </label>
        </div>
      </section>

      @if (problem(); as problema) {
        <p class="form__problem" role="alert">{{ problema.message }}</p>
      }
    </form>

    <div class="form__footer">
      <button class="button" type="button" (click)="cancel.emit()">Cancelar</button>
      <span class="form__exits">
        <button
          class="button"
          type="button"
          [disabled]="saving() || !clientReady()"
          [attr.aria-describedby]="clientReady() ? null : 'cf-razon-falta'"
          (click)="submit(false)"
        >Guardar sin zona</button>
        <button
          class="button button--primary"
          type="button"
          [disabled]="saving() || !zoneReady()"
          [attr.aria-describedby]="zoneReady() ? null : 'cf-zona-falta'"
          (click)="submit(true)"
        >Guardar cliente y zona</button>
      </span>
    </div>

    <!--
      Las dos razones salen de la vista pero NO del documento. El botón desactivado las sigue
      nombrando por aria-describedby, así que quien usa lector de pantalla sigue oyendo por qué no
      puede guardar; lo que se retira es el texto permanente que ocupaba sitio en una ventana que ya
      no cabía de una vez.
    -->
    <p class="form__reason form__reason--oculta" id="cf-razon-falta">
      Falta la razón social o el RFC del cliente.
    </p>
    <p class="form__reason form__reason--oculta" id="cf-zona-falta">
      Para guardar con zona hacen falta su nombre, calle, municipio, estado y código postal.
    </p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 0; }

    .form { display: flex; flex-direction: column; gap: 1.1rem; padding: var(--gestia-card-padding); }

    .form__block { display: flex; flex-direction: column; gap: 0.7rem; }

    .form__block + .form__block { border-top: 1px solid var(--gestia-border); padding-top: 1.1rem; }

    .form__paso {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      color: var(--gestia-navy);
      font-size: 13px;
      font-weight: 700;
    }

    .form__num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.35rem;
      height: 1.35rem;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
      font-size: 11px;
    }

    .form__reason--oculta {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /* El aviso de la maqueta, con tokens de la pantalla. No se agrega una variante nueva al
       sistema de diseño por un solo banner: eso sale de las tres pantallas de esta tanda. */

    .form__kicker {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.6rem;
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .form__warning { color: var(--gestia-warning); font-size: 11.5px; letter-spacing: 0; }

    .form__row { display: grid; gap: 0.7rem; }
    .form__row--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .form__row--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .form__row--calle { grid-template-columns: 2fr 1fr; }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

    /* Rojo y sólo en lo obligatorio. Lo que no lo lleva no dice nada: poner «opcional» al lado de
       cada campo suelto llenaba la ventana de una palabra que no hacía falta leer. */
    .field__req { margin-left: 0.2rem; color: var(--gestia-danger); font-weight: 700; }

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

    .form__problem {
      margin: 0;
      color: var(--gestia-danger);
      font-size: 12px;
      font-weight: 600;
    }

    .field input.is-invalid { border-color: var(--gestia-danger); }

    .field__error { color: var(--gestia-danger); font-size: 11px; }

    .form__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.7rem;
      margin-top: auto;
      padding: var(--gestia-card-padding);
      border-top: 1px solid var(--gestia-border);
    }

    .form__exits { display: flex; align-items: center; gap: 0.55rem; }

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

    .button--primary:disabled { border-color: var(--gestia-border); background: var(--gestia-surface-soft); }

    .form__reason { margin: 0; padding: 0 var(--gestia-card-padding) 0.7rem; color: var(--gestia-muted); font-size: 11.5px; }

    @media (width < 45rem) {
      .form__row--two, .form__row--three, .form__row--calle { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class ClientForm {
  /**
   * Las opciones de `ngModel`, en una sola instancia.
   *
   * <p>Escritas en la plantilla como `{ standalone: true }` se construía un objeto nuevo en
   * <b>cada ciclo de detección</b>, y `NgModel` se reconfiguraba con cada uno: la vista no
   * llegaba a estabilizarse y el proceso terminaba sin memoria. Sólo se ve con la pantalla
   * montada, porque en prueba de componente el ciclo se detiene solo.</p>
   */
  protected readonly sueltos = { standalone: true };

  readonly saving = input(false);
  /**
   * Lo que el servidor dijo del último intento.
   *
   * <p>Ya no es una cadena. Antes llegaba sólo el texto de arriba, que en una validación era
   * siempre el mismo genérico y no decía qué corregir; el detalle por campo salía del servidor y
   * se tiraba en el camino. Ahora llega entero y cada campo dice lo suyo.</p>
   */
  readonly problem = input<ServerProblem | null>(null);

  protected errorDe(campo: string): string {
    const problema = this.problem();
    return problema ? fieldError(problema, campo) : '';
  }
  /** El catálogo geográfico es por organización. */
  readonly organizationId = input('');
  readonly canWrite = input(true);
  readonly jobPositions = input<readonly GiCatalogOption[]>([]);
  readonly createJobPosition = output<GiCatalogCreation>();

  readonly cancel = output<void>();
  readonly save = output<{ value: ClientFormValue; withZone: boolean }>();

  protected readonly legalName = signal('');
  protected readonly tradeName = signal('');
  protected readonly rfc = signal('');
  protected readonly zoneName = signal('');
  protected readonly street = signal('');
  /**
   * El domicilio de la zona, con el código postal al mando.
   *
   * <p>La misma pieza compartida que usan las zonas de un cliente y el domicilio de una persona:
   * cinco dígitos resuelven país, estado, municipio y colonias, los desplegables se quedan de
   * respaldo, y un código fuera del padrón <b>no borra lo ya escrito</b>. Eso último costó pensarlo
   * en la tanda de zonas y es lo que se pierde al reimplementar, así que aquí se reusa.</p>
   */
  protected readonly direccion = inject(DireccionPorCodigoPostal);
  protected readonly contactName = signal('');
  /** El puesto del contacto, por identificador de catálogo. */
  protected readonly idContactJobPosition = signal('');
  protected readonly contactPhone = signal('');
  protected readonly contactEmail = signal('');

  /** Lo mínimo para que exista el expediente. La zona no entra: puede no ir. */
  protected readonly clientReady = computed(() => !!this.legalName().trim() && !!this.rfc().trim());

  /** Lo mínimo para que la zona sea una dirección y no un nombre suelto. */
  protected readonly zoneReady = computed(
    () =>
      this.clientReady() &&
      !!this.zoneName().trim() &&
      !!this.street().trim() &&
      !!this.direccion.municipality().trim() &&
      !!this.direccion.state().trim() &&
      !!this.direccion.postalCode().trim(),
  );


  protected submit(withZone: boolean): void {
    this.save.emit({
      withZone,
      value: {
        legalName: this.legalName().trim(),
        tradeName: this.tradeName().trim(),
        rfc: this.rfc().trim().toUpperCase(),
        zone: {
          name: this.zoneName().trim(),
          street: this.street().trim(),
          neighborhood: this.direccion.neighborhood().trim(),
          municipality: this.direccion.municipality().trim(),
          state: this.direccion.state().trim(),
          postalCode: this.direccion.postalCode().trim(),
        },
        contact: {
          fullName: this.contactName().trim(),
          jobTitle: this.jobPositions().find((p) => p.idCatalogItem === this.idContactJobPosition())?.name ?? '',
          phone: this.contactPhone().trim(),
          email: this.contactEmail().trim(),
        },
      },
    });
  }
}
