import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DireccionPorCodigoPostal } from '../../../shared/data-access/direccion-por-codigo-postal';
import { CatalogSelect } from '../../../shared/ui/catalog-select/catalog-select';
import { GiSelect } from '../../../shared/ui/gi-ui';
import { Employee } from '../data-access/workforce.models';

/** El domicilio que el expediente guarda. Todo opcional: vacío es «no se sabe», no un error. */
export type EmployeeAddressValue = {
  readonly street: string;
  readonly streetNumber: string;
  readonly neighborhood: string;
  readonly postalCode: string;
  readonly state: string;
  readonly municipality: string;
  readonly countryCode: string;
};

/**
 * El domicilio de una persona, capturado desde su expediente.
 *
 * <p><b>Por qué aquí y no en el alta.</b> El alta se queda mínima a propósito —nombre, ingreso y
 * poco más— y la captura del resto se hace después, sobre el expediente. Hasta el 22 de septiembre
 * de 2026 ese «después» no existía para el domicilio: las columnas estaban en la base, la ficha las
 * mostraba con «Sin colonia registrada», y no había ninguna pantalla donde escribirlas. Se veía lo
 * que faltaba y no había forma de completarlo.</p>
 *
 * <p><b>El código postal manda</b>, igual que en las zonas de un cliente, y con la misma pieza
 * compartida: cinco dígitos resuelven país, estado, municipio y la lista de colonias. Los
 * desplegables se quedan de respaldo, y un código fuera del padrón no borra lo que ya había.</p>
 */
@Component({
  selector: 'app-employee-address',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CatalogSelect, FormsModule, GiSelect],
  providers: [DireccionPorCodigoPostal],
  template: `
    <section class="dir">
      <div class="dir__row dir__row--calle">
        <label class="field" for="ea-calle">
          <span class="field__label">CALLE</span>
          <input id="ea-calle" name="street" type="text" [ngModel]="street()" (ngModelChange)="street.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
        </label>
        <label class="field" for="ea-numero">
          <span class="field__label">NÚMERO</span>
          <input id="ea-numero" name="streetNumber" type="text" [ngModel]="streetNumber()" (ngModelChange)="streetNumber.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
        </label>
        <label class="field" for="ea-cp">
          <span class="field__label">CÓDIGO POSTAL</span>
          <input id="ea-cp" name="postalCode" type="text" inputmode="numeric" maxlength="5" [ngModel]="direccion.postalCode()" (ngModelChange)="direccion.onPostalCode($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          @if (direccion.buscando()) {
            <small class="field__nota">Buscando…</small>
          } @else if (direccion.sinPadron()) {
            <small class="field__nota" role="status">No está en el padrón. Elige el estado y el municipio abajo.</small>
          }
        </label>
      </div>

      <div class="dir__row dir__row--cuatro">
        <label class="field" for="ea-pais">
          <span class="field__label">PAÍS</span>
          <app-catalog-select
            id="ea-pais"
            type="Country"
            label="País"
            [organizationId]="organizationId()"
            [ngModel]="direccion.countryCode()"
            (ngModelChange)="direccion.onCountry($event)"
            [ngModelOptions]="sueltos"
          />
        </label>
        <label class="field" for="ea-colonia">
          <span class="field__label">COLONIA</span>
          @if (direccion.coloniaEnLista()) {
            <gi-select
              id="ea-colonia"
              label="Colonia"
              placeholder="Selecciona la colonia"
              [options]="direccion.opcionesDeColonia()"
              [value]="direccion.neighborhood()"
              (valueChange)="direccion.onColonia($event)"
            />
          } @else {
            <input id="ea-colonia" name="neighborhood" type="text" [ngModel]="direccion.neighborhood()" (ngModelChange)="direccion.neighborhood.set($event)" [ngModelOptions]="sueltos" autocomplete="off" />
          }
        </label>
        <label class="field" for="ea-estado">
          <span class="field__label">ESTADO</span>
          <app-catalog-select
            id="ea-estado"
            type="State"
            label="Estado"
            [country]="direccion.countryCode()"
            [organizationId]="organizationId()"
            [ngModel]="direccion.state()"
            (ngModelChange)="direccion.onState($event)"
            [ngModelOptions]="sueltos"
          />
        </label>
        <label class="field" for="ea-municipio">
          <span class="field__label">MUNICIPIO</span>
          <app-catalog-select
            id="ea-municipio"
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

      @if (problem()) {
        <p class="dir__problem" role="alert">{{ problem() }}</p>
      }

      <p class="dir__actions">
        <button class="dir__button" type="button" [disabled]="saving()" (click)="cancelar.emit()">Cancelar</button>
        <button class="dir__button dir__button--primary" type="button" [disabled]="saving()" (click)="emitir()">
          {{ saving() ? 'Guardando…' : 'Guardar domicilio' }}
        </button>
      </p>
    </section>
  `,
  styles: `
    .dir { display: grid; gap: 0.7rem; }
    .dir__row { display: grid; gap: 0.7rem; }
    .dir__row--calle { grid-template-columns: 2fr 1fr 1fr; }
    .dir__row--cuatro { grid-template-columns: repeat(4, minmax(0, 1fr)); }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

    .field__label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .field__nota { color: var(--gestia-muted); font-size: 11px; }

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

    .dir__problem { margin: 0; color: var(--gestia-danger); font-size: 11.5px; }
    .dir__actions { display: flex; justify-content: flex-end; gap: 0.55rem; margin: 0; }

    .dir__button {
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      cursor: pointer;
    }

    .dir__button--primary {
      border-color: var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .dir__button:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    @media (width < 45rem) {
      .dir__row--calle, .dir__row--cuatro { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class EmployeeAddress {
  readonly organizationId = input('');
  readonly employee = input<Employee | null>(null);
  readonly saving = input(false);
  readonly problem = input('');

  readonly guardar = output<EmployeeAddressValue>();
  readonly cancelar = output<void>();

  protected readonly sueltos = { standalone: true };
  protected readonly street = signal('');
  protected readonly streetNumber = signal('');
  protected readonly direccion = inject(DireccionPorCodigoPostal);

  constructor() {
    // El expediente llega después de la ficha, así que el domicilio se carga cuando aparece y no
    // en el constructor. `cargar` no consulta el código postal a propósito.
    effect(() => {
      const expediente = this.employee();
      this.street.set(expediente?.street ?? '');
      this.streetNumber.set(expediente?.streetNumber ?? '');
      this.direccion.cargar(expediente ?? {});
    });
  }

  protected emitir(): void {
    this.guardar.emit({
      street: this.street().trim(),
      streetNumber: this.streetNumber().trim(),
      ...this.direccion.valor(),
    });
  }
}
