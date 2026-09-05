import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Lo que el formulario devuelve. La sede y el contacto van aparte porque pueden no ir. */
export type ClientFormValue = {
  readonly legalName: string;
  readonly tradeName: string;
  readonly rfc: string;
  readonly site: {
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
 * El alta de un cliente, con su sede y su contacto.
 *
 * <p><b>Aquí se dice que la sede es obligatoria para crear servicios</b>, antes de guardar y no al
 * fallar el paso siguiente. El bloque lleva el motivo en su propio rótulo, y las dos salidas dicen
 * exactamente qué hace cada una: «Guardar cliente y sede» deja el paso completo, «Guardar sin
 * sede» deja un expediente válido que todavía no permite servicios.</p>
 *
 * <p>No hay campo de código ni de fecha de alta: los pone el servidor. Pedirle al usuario que
 * invente un identificador es pedirle que resuelva un problema del sistema.</p>
 */
@Component({
  selector: 'app-client-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <form class="form" (ngSubmit)="$event.preventDefault()">
      <section class="form__block">
        <h3 class="form__kicker">DATOS DEL CLIENTE</h3>

        <label class="field field--wide" for="cf-razon">
          <span class="field__label">RAZÓN SOCIAL</span>
          <input id="cf-razon" name="legalName" type="text" [ngModel]="legalName()" (ngModelChange)="legalName.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
        </label>

        <div class="form__row form__row--two">
          <label class="field" for="cf-corto">
            <span class="field__label">NOMBRE CORTO</span>
            <input id="cf-corto" name="tradeName" type="text" [ngModel]="tradeName()" (ngModelChange)="tradeName.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
          <label class="field" for="cf-rfc">
            <!-- El bosquejo lo marcaba opcional. No lo es: el servidor lo usa para la unicidad
                 del cliente junto con el código. -->
            <span class="field__label">RFC</span>
            <input id="cf-rfc" name="rfc" type="text" [ngModel]="rfc()" (ngModelChange)="rfc.set($event)" [ngModelOptions]="{ standalone: true }" placeholder="Trece caracteres" autocomplete="off" />
          </label>
        </div>
      </section>

      <section class="form__block">
        <h3 class="form__kicker">
          SEDE · OBLIGATORIA PARA CREAR SERVICIOS
          <span class="form__warning">Sin sede el cliente queda como expediente</span>
        </h3>

        <label class="field field--wide" for="cf-sede">
          <span class="field__label">NOMBRE DE LA SEDE</span>
          <input id="cf-sede" name="siteName" type="text" [ngModel]="siteName()" (ngModelChange)="siteName.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
        </label>

        <div class="form__row form__row--calle">
          <label class="field" for="cf-calle">
            <span class="field__label">CALLE Y NÚMERO</span>
            <input id="cf-calle" name="street" type="text" [ngModel]="street()" (ngModelChange)="street.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
          <label class="field" for="cf-cp">
            <span class="field__label">CÓDIGO POSTAL</span>
            <input id="cf-cp" name="postalCode" type="text" [ngModel]="postalCode()" (ngModelChange)="postalCode.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
        </div>

        <div class="form__row form__row--three">
          <label class="field" for="cf-colonia">
            <span class="field__label">COLONIA</span>
            <input id="cf-colonia" name="neighborhood" type="text" [ngModel]="neighborhood()" (ngModelChange)="neighborhood.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
          <label class="field" for="cf-estado">
            <span class="field__label">ESTADO</span>
            <input id="cf-estado" name="state" type="text" [ngModel]="state()" (ngModelChange)="state.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
          <label class="field" for="cf-municipio">
            <span class="field__label">MUNICIPIO</span>
            <input id="cf-municipio" name="municipality" type="text" [ngModel]="municipality()" (ngModelChange)="municipality.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
        </div>
      </section>

      <section class="form__block">
        <h3 class="form__kicker">CONTACTO DE LA SEDE</h3>
        <div class="form__row form__row--two">
          <label class="field" for="cf-cnombre">
            <span class="field__label">NOMBRE</span>
            <input id="cf-cnombre" name="contactName" type="text" [ngModel]="contactName()" (ngModelChange)="contactName.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
          <label class="field" for="cf-cpuesto">
            <span class="field__label">PUESTO</span>
            <input id="cf-cpuesto" name="contactRole" type="text" [ngModel]="contactRole()" (ngModelChange)="contactRole.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
          <label class="field" for="cf-ctel">
            <span class="field__label">TELÉFONO</span>
            <input id="cf-ctel" name="contactPhone" type="text" [ngModel]="contactPhone()" (ngModelChange)="contactPhone.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
          <label class="field" for="cf-ccorreo">
            <span class="field__label">CORREO · OPCIONAL</span>
            <input id="cf-ccorreo" name="contactEmail" type="text" [ngModel]="contactEmail()" (ngModelChange)="contactEmail.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
          </label>
        </div>
      </section>

      @if (problem()) {
        <p class="form__problem" role="alert">{{ problem() }}</p>
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
        >Guardar sin sede</button>
        <button
          class="button button--primary"
          type="button"
          [disabled]="saving() || !siteReady()"
          [attr.aria-describedby]="siteReady() ? null : 'cf-sede-falta'"
          (click)="submit(true)"
        >Guardar cliente y sede</button>
      </span>
    </div>

    <!-- La razón del bloqueo se escribe, no sólo se pinta en gris. -->
    <p class="form__reason" id="cf-razon-falta" [hidden]="clientReady()">
      Falta la razón social o el RFC del cliente.
    </p>
    <p class="form__reason" id="cf-sede-falta" [hidden]="siteReady()">
      Para guardar con sede hacen falta su nombre, calle, municipio, estado y código postal.
    </p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 0; }

    .form { display: flex; flex-direction: column; gap: 1.1rem; padding: var(--gestia-card-padding); }

    .form__block { display: flex; flex-direction: column; gap: 0.7rem; }

    .form__block + .form__block { border-top: 1px solid var(--gestia-border); padding-top: 1.1rem; }

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
  readonly saving = input(false);
  readonly problem = input('');

  readonly cancel = output<void>();
  readonly save = output<{ value: ClientFormValue; withSite: boolean }>();

  protected readonly legalName = signal('');
  protected readonly tradeName = signal('');
  protected readonly rfc = signal('');
  protected readonly siteName = signal('');
  protected readonly street = signal('');
  protected readonly neighborhood = signal('');
  protected readonly municipality = signal('');
  protected readonly state = signal('');
  protected readonly postalCode = signal('');
  protected readonly contactName = signal('');
  protected readonly contactRole = signal('');
  protected readonly contactPhone = signal('');
  protected readonly contactEmail = signal('');

  /** Lo mínimo para que exista el expediente. La sede no entra: puede no ir. */
  protected readonly clientReady = computed(() => !!this.legalName().trim() && !!this.rfc().trim());

  /** Lo mínimo para que la sede sea una dirección y no un nombre suelto. */
  protected readonly siteReady = computed(
    () =>
      this.clientReady() &&
      !!this.siteName().trim() &&
      !!this.street().trim() &&
      !!this.municipality().trim() &&
      !!this.state().trim() &&
      !!this.postalCode().trim(),
  );

  protected submit(withSite: boolean): void {
    this.save.emit({
      withSite,
      value: {
        legalName: this.legalName().trim(),
        tradeName: this.tradeName().trim(),
        rfc: this.rfc().trim().toUpperCase(),
        site: {
          name: this.siteName().trim(),
          street: this.street().trim(),
          neighborhood: this.neighborhood().trim(),
          municipality: this.municipality().trim(),
          state: this.state().trim(),
          postalCode: this.postalCode().trim(),
        },
        contact: {
          fullName: this.contactName().trim(),
          jobTitle: this.contactRole().trim(),
          phone: this.contactPhone().trim(),
          email: this.contactEmail().trim(),
        },
      },
    });
  }
}
