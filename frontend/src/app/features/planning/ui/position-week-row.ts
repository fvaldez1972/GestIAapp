import { ChangeDetectionStrategy, Component, OnInit, computed, input, output } from '@angular/core';
import { devAssert } from '../../../shared/ui/dev-assert';
import { PlanningCell, PlanningRow } from '../data-access/planning.models';

/** Lo que dice cada celda, en palabras. El color acompaña; nunca sustituye. */
const TITULO: Record<PlanningCell['kind'], string> = {
  covered: '',
  short: '',
  noShift: 'Sin turno',
  undeclared: 'Sin declarar',
};

/**
 * La semana de una posición: siete celdas y lo que hay en cada una.
 *
 * <p><b>Ninguna celda dice «Descanso».</b> En el modelo el descanso es la ausencia de un segmento,
 * así que afirmarlo sería afirmar una decisión que nadie tomó. Un día sin segmento dice
 * <b>Sin turno</b>, y una posición de la que nadie declaró nada dice <b>Sin declarar</b> con la
 * duda encima: turno o descanso, no se sabe.</p>
 *
 * <p><b>La cuenta de gente se lee sin abrir nada.</b> Un hueco enseña «2 de 4», no un icono: el
 * número es lo que decide si hay que ir a Cobertura, y esconderlo detrás de un color obliga a
 * pasar el ratón por catorce celdas para saber cuál mirar.</p>
 */
@Component({
  selector: 'app-position-week-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fila" [style.--dias]="row().cells.length">
      <div class="fila__pos">
        <span class="fila__code">{{ row().codePosition }}</span>
        <span class="fila__name">{{ row().name }}</span>
        <span class="fila__meta">{{ meta() }}</span>
      </div>

      @for (cell of row().cells; track cell.date) {
        <button
          class="celda"
          type="button"
          [class]="'celda--' + cell.kind"
          [class.celda--marcada]="cell.date === highlightDate()"
          [attr.aria-label]="etiqueta(cell)"
          (click)="cellSelect.emit(cell)"
        >
          @switch (cell.kind) {
            @case ('covered') {
              <span class="celda__titulo">{{ personas(cell) }}</span>
              <span class="celda__pie">{{ cell.timeRange }}</span>
            }
            @case ('short') {
              <span class="celda__titulo">{{ cell.assignedWorkerCount }} de {{ cell.requiredWorkerCount }}</span>
              <span class="celda__pie">Falta gente · {{ cell.timeRange }}</span>
            }
            @case ('noShift') {
              <span class="celda__titulo">{{ titulo(cell) }}</span>
            }
            @default {
              <span class="celda__titulo">{{ titulo(cell) }}</span>
              <span class="celda__pie">Turno o descanso</span>
            }
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .fila {
      display: grid;
      grid-template-columns: 14.5rem repeat(var(--dias), minmax(0, 1fr));
      border-bottom: 1px solid var(--gestia-border);
    }

    .fila__pos {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.75rem 0.85rem;
      border-right: 1px solid var(--gestia-border);
    }

    .fila__code { color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .fila__name { color: var(--gestia-text); font-size: 12px; }
    .fila__meta { color: var(--gestia-muted); font-size: 11.5px; }

    .celda {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      align-items: center;
      justify-content: center;
      min-height: 3.5rem;
      margin: 0.35rem;
      padding: 0.4rem 0.3rem;
      border: 1px solid transparent;
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      text-align: center;
      cursor: pointer;
    }

    .celda:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .celda__titulo { font-size: 12px; font-weight: 600; }
    .celda__pie { color: var(--gestia-muted); font-size: 10.5px; }

    .celda--short { border-color: var(--gestia-danger); }
    .celda--short .celda__titulo { color: var(--gestia-danger); }
    .celda--short .celda__pie { color: var(--gestia-danger); }

    .celda--undeclared { border-color: var(--gestia-warning); }
    .celda--undeclared .celda__titulo,
    .celda--undeclared .celda__pie { color: var(--gestia-warning); }

    .celda--noShift { background: var(--gestia-surface-soft); }
    .celda--noShift .celda__titulo { color: var(--gestia-muted); font-weight: 400; }

    /* El día que la pantalla está mirando. Se marca con fondo Y con borde: sólo con fondo se
       pierde cuando la celda ya trae uno propio. */
    .celda--marcada { border-color: var(--gestia-cyan-dark); background: var(--gestia-cyan-soft); }
  `,
})
export class PositionWeekRow implements OnInit {
  readonly row = input.required<PlanningRow>();

  /** El día que la pantalla está mirando, para marcarlo en la columna. */
  readonly highlightDate = input('');

  readonly cellSelect = output<PlanningCell>();

  protected readonly meta = computed(() => {
    const { requiredWorkerCount } = this.row();
    const gente = `${requiredWorkerCount} ${requiredWorkerCount === 1 ? 'elemento' : 'elementos'}`;

    // Sólo semanal en fase 1. No se escribe «semanal» como si hubiera alternativa: cuando exista
    // el patrón con ancla, aquí entra el ciclo y la palabra empieza a distinguir algo.
    return gente;
  });

  protected titulo(cell: PlanningCell): string {
    return TITULO[cell.kind];
  }

  protected personas(cell: PlanningCell): string {
    if (cell.people.length === 1) {
      return cell.people[0];
    }

    return `${cell.people.length} ${cell.people.length === 1 ? 'elemento' : 'elementos'}`;
  }

  /**
   * Lo que oye quien no ve la rejilla.
   *
   * <p>Una celda de calendario sin nombre accesible es un botón que dice «botón»: sin la posición,
   * sin el día y sin el estado, recorrerla con lector de pantalla no dice nada.</p>
   */
  protected etiqueta(cell: PlanningCell): string {
    const donde = `${this.row().codePosition}, ${cell.date}`;

    switch (cell.kind) {
      case 'covered':
        return `${donde}: cubierto, ${this.personas(cell)}, ${cell.timeRange}`;
      case 'short':
        return `${donde}: falta gente, ${cell.assignedWorkerCount} de ${cell.requiredWorkerCount}, ${cell.timeRange}`;
      case 'noShift':
        return `${donde}: sin turno`;
      default:
        return `${donde}: sin declarar, no se sabe si es turno o descanso`;
    }
  }

  ngOnInit(): void {
    devAssert(
      this.row().cells.length === 7,
      'app-position-week-row: la fila lleva siete celdas, una por día. Con otra cantidad la ' +
        'rejilla se desalinea de la cabecera sin fallar, y quien la lee cree estar viendo el ' +
        'miércoles cuando está viendo el jueves.',
    );

    devAssert(
      this.row().cells.every((cell) => cell.kind !== 'covered' || cell.people.length > 0),
      'app-position-week-row: una celda cubierta sin nadie es una contradicción. Si no hay gente ' +
        'es un hueco, y pintarla como cubierta esconde justo lo que hay que resolver.',
    );
  }
}
