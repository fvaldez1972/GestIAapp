import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { GiDate } from '../../../shared/ui/gi-date/gi-date';
import { FormsModule } from '@angular/forms';

export type EmployeeTerminateValue = {
  readonly endDate: string;
  readonly terminationReason: string;
};

export const TERMINATION_REASON_MIN = 5;

@Component({
  selector: 'app-employee-terminate-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, GiDate],
  template: `
    @if (open()) {
      <div class="baja__fondo">
        <section class="baja" role="dialog" aria-modal="true" aria-labelledby="baja-titulo">
          <h2 class="baja__titulo" id="baja-titulo">Dar de baja</h2>
          <p class="baja__sujeto">{{ employeeName() }}</p>
          <p class="baja__consecuencia">
            Se cierra su periodo laboral y se cierran sus asignaciones vigentes con esta misma fecha.
            Su expediente se conserva completo, y podrá reingresar más adelante.
          </p>

          <label class="field" for="tb-fecha">
            <span class="field__label">FECHA DE BAJA</span>
            <gi-date inputId="tb-fecha" [max]="today()" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" [ngModelOptions]="sueltos" />
          </label>

          <label class="field" for="tb-motivo">
            <span class="field__label">MOTIVO DE BAJA</span>
            <textarea
              id="tb-motivo"
              name="terminationReason"
              rows="3"
              maxlength="500"
              placeholder="Por qué deja de trabajar"
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
              [ngModelOptions]="sueltos"
            ></textarea>
            <small class="field__nota">Obligatorio. Mínimo {{ minimo }} caracteres.</small>
          </label>

          @if (problem()) {
            <p class="baja__problema" role="alert">{{ problem() }}</p>
          }

          <p class="baja__acciones">
            <button class="baja__boton" type="button" [disabled]="saving()" (click)="cancel.emit()">
              Cancelar
            </button>
            <button
              class="baja__boton baja__boton--peligro"
              type="button"
              [disabled]="saving() || !listo()"
              (click)="emitir()"
            >
              {{ saving() ? 'Guardando…' : 'Dar de baja' }}
            </button>
          </p>
        </section>
      </div>
    }
  `,
  styles: `
    .baja__fondo {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgb(15 23 42 / 45%);
    }

    .baja {
      display: grid;
      gap: 0.7rem;
      width: min(30rem, 100%);
      padding: 1.1rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-lg);
      background: var(--gestia-surface);
    }

    .baja__titulo { margin: 0; color: var(--gestia-text); font-size: 16px; }
    .baja__sujeto { margin: 0; color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .baja__consecuencia { margin: 0; color: var(--gestia-muted); font-size: 12px; }
    .baja__problema { margin: 0; color: var(--gestia-danger); font-size: 11.5px; }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

    .field__label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .field__nota { color: var(--gestia-muted); font-size: 11px; }

    .field input,
    .field textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 0.4rem 0.7rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      resize: vertical;
    }

    .field input { height: var(--gestia-control-height); padding: 0 0.7rem; }

    .field input:focus-visible,
    .field textarea:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .baja__acciones { display: flex; justify-content: flex-end; gap: 0.55rem; margin: 0; }

    .baja__boton {
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

    .baja__boton--peligro {
      border-color: var(--gestia-danger);
      background: var(--gestia-danger);
      color: var(--gestia-surface);
    }

    .baja__boton:disabled { opacity: 0.55; cursor: not-allowed; }
    .baja__boton:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class EmployeeTerminateDialog {
  readonly open = input(false);
  readonly employeeName = input('');
  readonly today = input('');
  readonly saving = input(false);
  readonly problem = input('');

  readonly guardar = output<EmployeeTerminateValue>();
  readonly cancel = output<void>();

  protected readonly minimo = TERMINATION_REASON_MIN;
  protected readonly sueltos = { standalone: true };
  protected readonly endDate = signal('');
  protected readonly reason = signal('');

  protected readonly listo = computed(
    () => !!this.endDate() && this.reason().trim().length >= TERMINATION_REASON_MIN,
  );

  constructor() {
    // El motivo nunca se prellena ni se sugiere: se vacía cada vez que se abre el diálogo.
    effect(() => {
      if (this.open()) {
        this.reason.set('');
        this.endDate.set(this.today());
      }
    });
  }

  protected emitir(): void {
    if (!this.listo()) {
      return;
    }

    this.guardar.emit({ endDate: this.endDate(), terminationReason: this.reason().trim() });
  }
}
