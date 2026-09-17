import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServerProblem, fieldError } from '../../../shared/util/server-problem';
import { Client, ClientInput } from '../data-access/client.models';

/**
 * Editar la ficha de un cliente.
 *
 * <p><b>Están los doce campos, no los tres visibles.</b> El <c>PUT</c> del servidor reemplaza el
 * perfil entero, así que un formulario con razón social, nombre corto y RFC mandaría vacíos los
 * otros nueve y los borraría sin decir nada: nacionalidad, actividad y domicilio fiscal, fecha y
 * folio del registro público, registro patronal, fecha y número de escritura, e instrumento del
 * representante legal. Enseñarlos todos no es «más formulario»: es la única forma de que guardar no
 * pierda datos.</p>
 *
 * <p><b>El código no se toca.</b> Lo pone el servidor al dar de alta y no es un dato que se decida;
 * se enseña como referencia, junto al recordatorio de quién lo pone.</p>
 */
@Component({
  selector: 'app-client-edit-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <form class="edit" (ngSubmit)="guardar()">
      <p class="edit__ref">
        <span>{{ client().codeClient }}</span>
        <small>El código y la fecha de alta los pone el sistema.</small>
      </p>

      <fieldset class="edit__grupo">
        <legend>Identificación</legend>

        <label class="field" for="ce-razon">
          <span class="field__label">RAZÓN SOCIAL</span>
          <input
            id="ce-razon" name="legalName" type="text" autocomplete="off"
            [ngModel]="legalName()" (ngModelChange)="legalName.set($event)" [ngModelOptions]="sueltos"
            [class.is-invalid]="!!error('legalName')"
          />
          @if (error('legalName'); as falla) { <small class="campo-error" role="alert">{{ falla }}</small> }
        </label>

        <div class="edit__dos">
          <label class="field" for="ce-corto">
            <span class="field__label">NOMBRE CORTO</span>
            <input
              id="ce-corto" name="tradeName" type="text" autocomplete="off"
              [ngModel]="tradeName()" (ngModelChange)="tradeName.set($event)" [ngModelOptions]="sueltos"
            />
          </label>
          <label class="field" for="ce-rfc">
            <span class="field__label">RFC</span>
            <input
              id="ce-rfc" name="rfc" type="text" autocomplete="off" maxlength="13"
              [ngModel]="rfc()" (ngModelChange)="rfc.set($event)" [ngModelOptions]="sueltos"
              [class.is-invalid]="!!error('rfc')"
            />
            @if (error('rfc'); as falla) { <small class="campo-error" role="alert">{{ falla }}</small> }
          </label>
        </div>
      </fieldset>

      <fieldset class="edit__grupo">
        <legend>Datos fiscales</legend>

        <div class="edit__dos">
          <label class="field" for="ce-nac">
            <span class="field__label">NACIONALIDAD</span>
            <input id="ce-nac" name="nationality" type="text" autocomplete="off"
              [ngModel]="nationality()" (ngModelChange)="nationality.set($event)" [ngModelOptions]="sueltos" />
          </label>
          <label class="field" for="ce-act">
            <span class="field__label">ACTIVIDAD FISCAL</span>
            <input id="ce-act" name="taxActivity" type="text" autocomplete="off"
              [ngModel]="taxActivity()" (ngModelChange)="taxActivity.set($event)" [ngModelOptions]="sueltos" />
          </label>
        </div>

        <label class="field" for="ce-dom">
          <span class="field__label">DOMICILIO FISCAL</span>
          <input id="ce-dom" name="taxAddress" type="text" autocomplete="off"
            [ngModel]="taxAddress()" (ngModelChange)="taxAddress.set($event)" [ngModelOptions]="sueltos" />
        </label>

        <label class="field" for="ce-patronal">
          <span class="field__label">REGISTRO PATRONAL</span>
          <input id="ce-patronal" name="employerRegistrationNumber" type="text" autocomplete="off"
            [ngModel]="employerRegistrationNumber()" (ngModelChange)="employerRegistrationNumber.set($event)" [ngModelOptions]="sueltos" />
        </label>
      </fieldset>

      <fieldset class="edit__grupo">
        <legend>Constitución y registro</legend>

        <div class="edit__dos">
          <label class="field" for="ce-fconst">
            <span class="field__label">FECHA DE CONSTITUCIÓN</span>
            <input id="ce-fconst" name="incorporationDate" type="date"
              [ngModel]="incorporationDate()" (ngModelChange)="incorporationDate.set($event)" [ngModelOptions]="sueltos" />
          </label>
          <label class="field" for="ce-escritura">
            <span class="field__label">NÚMERO DE ESCRITURA</span>
            <input id="ce-escritura" name="incorporationDeedNumber" type="text" autocomplete="off"
              [ngModel]="incorporationDeedNumber()" (ngModelChange)="incorporationDeedNumber.set($event)" [ngModelOptions]="sueltos" />
          </label>
        </div>

        <div class="edit__dos">
          <label class="field" for="ce-fregistro">
            <span class="field__label">FECHA DEL REGISTRO PÚBLICO</span>
            <input id="ce-fregistro" name="publicRegistryDate" type="date"
              [ngModel]="publicRegistryDate()" (ngModelChange)="publicRegistryDate.set($event)" [ngModelOptions]="sueltos" />
          </label>
          <label class="field" for="ce-folio">
            <span class="field__label">FOLIO MERCANTIL</span>
            <input id="ce-folio" name="commercialRegistryFolio" type="text" autocomplete="off"
              [ngModel]="commercialRegistryFolio()" (ngModelChange)="commercialRegistryFolio.set($event)" [ngModelOptions]="sueltos" />
          </label>
        </div>

        <label class="field" for="ce-instrumento">
          <span class="field__label">INSTRUMENTO DEL REPRESENTANTE LEGAL</span>
          <input id="ce-instrumento" name="legalRepresentativeInstrumentNumber" type="text" autocomplete="off"
            [ngModel]="legalRepresentativeInstrumentNumber()" (ngModelChange)="legalRepresentativeInstrumentNumber.set($event)" [ngModelOptions]="sueltos" />
        </label>
      </fieldset>

      @if (problem()?.message; as aviso) {
        <p class="edit__problema" role="alert">{{ aviso }}</p>
      }

      <div class="edit__acciones">
        <button class="button" type="button" [disabled]="saving()" (click)="cancel.emit()">Cancelar</button>
        <button class="button button--primary" type="submit" [disabled]="saving() || !puedeGuardar()">
          {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>

      @if (!puedeGuardar()) {
        <p class="edit__falta">Falta la razón social o el RFC.</p>
      }
    </form>
  `,
  styles: `
    :host { display: block; }

    .edit { display: grid; gap: 1rem; }

    .edit__ref {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin: 0;
    }

    .edit__ref span {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.5rem;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
    }

    .edit__ref small { color: var(--gestia-muted); font-size: 11px; }

    .edit__grupo {
      display: grid;
      gap: 0.7rem;
      margin: 0;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.9rem;
    }

    .edit__grupo legend {
      padding: 0 0.35rem;
      color: var(--gestia-navy);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .edit__dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; }

    .field { display: grid; gap: 0.2rem; min-width: 0; }
    .field__label { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em; }

    .field input {
      height: var(--gestia-control-height);
      min-width: 0;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0 0.55rem;
      font: inherit;
      font-size: 12.5px;
    }

    .field input:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: -1px; }
    .field input.is-invalid { border-color: var(--gestia-danger); }

    .campo-error { color: var(--gestia-danger); font-size: 11px; }
    .edit__problema { margin: 0; color: var(--gestia-danger); font-size: 12px; }
    .edit__falta { margin: 0; color: var(--gestia-muted); font-size: 11px; }

    .edit__acciones { display: flex; justify-content: flex-end; gap: 0.5rem; }

    .button {
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .button--primary { border-color: var(--gestia-navy); background: var(--gestia-navy); color: var(--gestia-surface); }
    .button[disabled] { opacity: 0.5; cursor: not-allowed; }

    @media (max-width: 40rem) {
      .edit__dos { grid-template-columns: 1fr; }
    }
  `,
})
export class ClientEditForm {
  protected readonly sueltos = { standalone: true };

  readonly client = input.required<Client>();
  readonly saving = input(false);
  readonly problem = input<ServerProblem | null>(null);

  readonly cancel = output<void>();
  readonly save = output<ClientInput>();

  protected readonly legalName = signal('');
  protected readonly tradeName = signal('');
  protected readonly rfc = signal('');
  protected readonly nationality = signal('');
  protected readonly taxActivity = signal('');
  protected readonly taxAddress = signal('');
  protected readonly publicRegistryDate = signal('');
  protected readonly commercialRegistryFolio = signal('');
  protected readonly employerRegistrationNumber = signal('');
  protected readonly incorporationDate = signal('');
  protected readonly incorporationDeedNumber = signal('');
  protected readonly legalRepresentativeInstrumentNumber = signal('');

  constructor() {
    /**
     * Prellena al abrir, y sólo cuando cambia el cliente.
     *
     * <p>Va en un efecto y no en un <c>computed</c>: Angular prohíbe escribir señales dentro de uno,
     * y con razón —un cálculo que además cambia el estado se vuelve a ejecutar cuando menos se
     * espera—. El <c>untracked</c> deja que dependa del cliente y de nada más: sin él, escribir en
     * un campo volvería a disparar el prellenado y devolvería lo tecleado al valor del servidor a
     * mitad de la captura.</p>
     */
    effect(() => {
      const client = this.client();

      untracked(() => {
        this.legalName.set(client.legalName);
        this.tradeName.set(client.tradeName ?? '');
        this.rfc.set(client.rfc);
        this.nationality.set(client.nationality ?? '');
        this.taxActivity.set(client.taxActivity ?? '');
        this.taxAddress.set(client.taxAddress ?? '');
        this.publicRegistryDate.set((client.publicRegistryDate ?? '').slice(0, 10));
        this.commercialRegistryFolio.set(client.commercialRegistryFolio ?? '');
        this.employerRegistrationNumber.set(client.employerRegistrationNumber ?? '');
        this.incorporationDate.set((client.incorporationDate ?? '').slice(0, 10));
        this.incorporationDeedNumber.set(client.incorporationDeedNumber ?? '');
        this.legalRepresentativeInstrumentNumber.set(
          client.legalRepresentativeInstrumentNumber ?? '',
        );
      });
    });
  }

  protected readonly puedeGuardar = computed(
    () => !!this.legalName().trim() && !!this.rfc().trim(),
  );

  protected error(campo: string) {
    const problema = this.problem();
    return problema ? fieldError(problema, campo) : '';
  }

  protected guardar(): void {
    if (!this.puedeGuardar()) {
      return;
    }

    const client = this.client();

    this.save.emit({
      idOrganization: client.idOrganization,
      legalName: this.legalName().trim(),
      tradeName: this.opcional(this.tradeName()),
      rfc: this.rfc().trim().toUpperCase(),
      nationality: this.opcional(this.nationality()),
      taxActivity: this.opcional(this.taxActivity()),
      taxAddress: this.opcional(this.taxAddress()),
      publicRegistryDate: this.opcional(this.publicRegistryDate()),
      commercialRegistryFolio: this.opcional(this.commercialRegistryFolio()),
      employerRegistrationNumber: this.opcional(this.employerRegistrationNumber()),
      incorporationDate: this.opcional(this.incorporationDate()),
      incorporationDeedNumber: this.opcional(this.incorporationDeedNumber()),
      legalRepresentativeInstrumentNumber: this.opcional(this.legalRepresentativeInstrumentNumber()),
    });
  }

  private opcional(valor: string) {
    const limpio = valor.trim();
    return limpio ? limpio : null;
  }
}
