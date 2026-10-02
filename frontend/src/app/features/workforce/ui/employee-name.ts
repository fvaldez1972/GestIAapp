import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Employee } from '../data-access/workforce.models';

/** El nombre en sus tres partes. El materno puede quedar vacío. */
export type EmployeeNameValue = {
  readonly firstName: string;
  readonly lastNamePaternal: string;
  readonly lastNameMaternal: string;
};

/**
 * El nombre de una persona, editado desde su expediente.
 *
 * <p><b>Por qué existe esta pieza.</b> Desde RQ-06 el nombre se guarda en tres columnas y el nombre
 * completo se deriva. Si la ficha sólo mostrara el derivado, una persona mal repartida por la
 * migración —«Empleado con» · «perfil» · «ACENTO»— se vería correcta en pantalla y nadie podría
 * arreglarla. Se ven las tres partes y se pueden corregir.</p>
 *
 * <p><b>El nombre completo no se captura aquí ni en ningún sitio.</b> Lo compone el servidor al
 * guardar. Este formulario manda las tres partes y nada más; lo que la ficha muestre después viene
 * de vuelta del servidor.</p>
 *
 * <p><b>El apellido materno es opcional y el paterno no</b>, porque hay personas con un solo
 * apellido y exigir los dos las deja fuera.</p>
 */
@Component({
  selector: 'app-employee-name',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <section class="nom">
      <div class="nom__row">
        <label class="field" for="en-nombre">
          <span class="field__label">NOMBRE(S)<span class="field__req" aria-hidden="true">*</span></span>
          <input
            id="en-nombre"
            name="firstName"
            type="text"
            maxlength="80"
            [ngModel]="firstName()"
            (ngModelChange)="firstName.set($event)"
            [ngModelOptions]="sueltos"
            autocomplete="off"
          />
        </label>
        <label class="field" for="en-paterno">
          <span class="field__label">APELLIDO PATERNO<span class="field__req" aria-hidden="true">*</span></span>
          <input
            id="en-paterno"
            name="lastNamePaternal"
            type="text"
            maxlength="80"
            [ngModel]="lastNamePaternal()"
            (ngModelChange)="lastNamePaternal.set($event)"
            [ngModelOptions]="sueltos"
            autocomplete="off"
          />
        </label>
        <label class="field" for="en-materno">
          <span class="field__label">APELLIDO MATERNO</span>
          <input
            id="en-materno"
            name="lastNameMaternal"
            type="text"
            maxlength="80"
            [ngModel]="lastNameMaternal()"
            (ngModelChange)="lastNameMaternal.set($event)"
            [ngModelOptions]="sueltos"
            autocomplete="off"
          />
        </label>
      </div>

      @if (problem()) {
        <p class="nom__problem" role="alert">{{ problem() }}</p>
      }

      <p class="nom__reason" [hidden]="listo()">
        Hacen falta el nombre y el apellido paterno. El materno es opcional.
      </p>

      <p class="nom__actions">
        <button class="nom__button" type="button" [disabled]="saving()" (click)="cancelar.emit()">
          Cancelar
        </button>
        <button
          class="nom__button nom__button--primary"
          type="button"
          [disabled]="saving() || !listo()"
          (click)="emitir()"
        >
          {{ saving() ? 'Guardando…' : 'Guardar nombre' }}
        </button>
      </p>
    </section>
  `,
  styles: `
    .nom { display: grid; gap: 0.7rem; }
    .nom__row { display: grid; gap: 0.7rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
    .field__req { color: var(--gestia-danger); margin-left: 0.15rem; }

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

    .nom__problem { margin: 0; color: var(--gestia-danger); font-size: 11.5px; }
    .nom__reason { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }
    .nom__actions { display: flex; justify-content: flex-end; gap: 0.55rem; margin: 0; }

    .nom__button {
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

    .nom__button--primary {
      border-color: var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .nom__button:disabled { opacity: 0.55; cursor: not-allowed; }
    .nom__button:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    @media (width < 45rem) {
      .nom__row { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class EmployeeName {
  readonly employee = input<Employee | null>(null);
  readonly saving = input(false);
  readonly problem = input('');

  readonly guardar = output<EmployeeNameValue>();
  readonly cancelar = output<void>();

  protected readonly sueltos = { standalone: true };
  protected readonly firstName = signal('');
  protected readonly lastNamePaternal = signal('');
  protected readonly lastNameMaternal = signal('');

  /** El materno queda fuera: su ausencia es un nombre válido, no un campo pendiente. */
  protected readonly listo = computed(
    () => !!this.firstName().trim() && !!this.lastNamePaternal().trim(),
  );

  constructor() {
    // El expediente llega después de la ficha, así que el nombre se carga cuando aparece.
    effect(() => {
      const expediente = this.employee();
      this.firstName.set(expediente?.firstName ?? '');
      this.lastNamePaternal.set(expediente?.lastNamePaternal ?? '');
      this.lastNameMaternal.set(expediente?.lastNameMaternal ?? '');
    });
  }

  protected emitir(): void {
    if (!this.listo()) {
      return;
    }

    this.guardar.emit({
      firstName: this.firstName().trim(),
      lastNamePaternal: this.lastNamePaternal().trim(),
      lastNameMaternal: this.lastNameMaternal().trim(),
    });
  }
}
