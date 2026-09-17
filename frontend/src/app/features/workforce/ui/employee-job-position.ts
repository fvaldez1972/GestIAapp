import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { GiCatalogCreation, GiCatalogPicker } from '../../../shared/ui/gi-ui';
import { EmployeeJobPositionOption } from '../data-access/employee-list.models';

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
  imports: [GiCatalogPicker],
  template: `
    <section class="editor">
      <!--
        El catálogo vacío deja de mandar a otra pantalla: se escribe el puesto y se ofrece agregarlo.
        Salir de aquí a Catálogos era abandonar la ficha a medias, y quien la abandona casi siempre
        la deja incompleta, que es lo que este editor viene a evitar.
      -->
      <gi-catalog-picker
        label="Puesto del catálogo"
        catalogLabel="el catálogo de puestos"
        inputId="ejp-puesto"
        [options]="jobPositions()"
        [value]="chosen()"
        [canWrite]="canWrite()"
        [disabled]="saving()"
        (valueChange)="chosen.set($event)"
        (create)="createJobPosition.emit($event)"
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
  readonly canWrite = input(false);

  readonly cancel = output<void>();
  readonly save = output<string>();
  readonly createJobPosition = output<GiCatalogCreation>();

  protected readonly chosen = signal('');

  constructor() {
    // Al abrirlo para otra persona, el control parte de lo que esa persona tiene, no de lo que
    // quedó elegido para la anterior.
    effect(() => this.chosen.set(this.current()));
  }
}
