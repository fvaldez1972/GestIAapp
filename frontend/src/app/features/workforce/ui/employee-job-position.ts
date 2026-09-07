import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { GiSelect, GiSelectOption } from '../../../shared/ui/gi-ui';
import { EmployeeJobPositionOption } from '../data-access/employee-list.models';
import { JobPositionMissing } from './job-position-missing';

/**
 * El único cambio que se hace desde la ficha: el puesto del catálogo.
 *
 * <p>Está aquí porque es la salida de la franja de elegibilidad. Un aviso que dice «el expediente
 * está incompleto» y no ofrece cómo completarlo obliga a buscar dónde, y quien lo busca casi
 * siempre lo deja así.</p>
 */
@Component({
  selector: 'app-employee-job-position',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiSelect, JobPositionMissing],
  template: `
    <section class="editor">
      @if (jobPositions().length === 0) {
        <app-job-position-missing />
      } @else {
        <gi-select
          label="Puesto del catálogo"
          placeholder="Elige un puesto"
          [options]="options()"
          [value]="chosen()"
          [disabled]="saving()"
          (valueChange)="chosen.set($event)"
        />

        @if (problem()) {
          <p class="editor__problem" role="alert">{{ problem() }}</p>
        }

        <p class="editor__actions">
          <button class="editor__button" type="button" [disabled]="saving()" (click)="cancel.emit()">
            Cancelar
          </button>
          <button
            class="editor__button editor__button--primary"
            type="button"
            [disabled]="saving() || !chosen() || chosen() === current()"
            [attr.aria-describedby]="chosen() && chosen() !== current() ? null : 'ejp-motivo'"
            (click)="save.emit(chosen())"
          >
            {{ saving() ? 'Guardando…' : 'Guardar el puesto' }}
          </button>
        </p>

        <p class="editor__reason" id="ejp-motivo" [hidden]="!!chosen() && chosen() !== current()">
          {{ chosen() ? 'Es el puesto que ya tiene.' : 'Todavía no has elegido un puesto.' }}
        </p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .editor {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .editor__actions { display: flex; gap: 0.5rem; margin: 0; }

    .editor__button {
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

    .editor__button:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
    .editor__button:disabled { color: var(--gestia-muted); cursor: not-allowed; }

    .editor__button--primary {
      border-color: var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .editor__button--primary:disabled { border-color: var(--gestia-border); background: var(--gestia-surface); }

    .editor__problem { margin: 0; color: var(--gestia-danger); font-size: 12px; }

    .editor__reason { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }
  `,
})
export class EmployeeJobPosition {
  readonly jobPositions = input.required<readonly EmployeeJobPositionOption[]>();
  /** El puesto que la persona tiene hoy. Vacío cuando no tiene ninguno. */
  readonly current = input('');
  readonly saving = input(false);
  readonly problem = input('');

  readonly cancel = output<void>();
  readonly save = output<string>();

  protected readonly chosen = signal('');

  protected readonly options = computed<readonly GiSelectOption[]>(() =>
    this.jobPositions().map((option) => ({ value: option.idCatalogItem, label: option.name })),
  );

  constructor() {
    // Al abrirlo para otra persona, el control parte de lo que esa persona tiene, no de lo que
    // quedó elegido para la anterior.
    effect(() => this.chosen.set(this.current()));
  }
}
