import { ChangeDetectionStrategy, Component, OnInit, computed, input, output } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { PositionWeekRow } from './position-week-row';
import { devAssert } from '../../../shared/ui/dev-assert';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { PlanningCell, PlanningRow, serverDayOfWeek } from '../data-access/planning.models';

const ABREVIATURA: Record<string, string> = {
  Monday: 'LUN',
  Tuesday: 'MAR',
  Wednesday: 'MIÉ',
  Thursday: 'JUE',
  Friday: 'VIE',
  Saturday: 'SÁB',
  Sunday: 'DOM',
};

/** Cada estado con la palabra que lo nombra. El color va con la palabra, nunca solo. */
const LEYENDA = [
  { kind: 'covered', texto: 'Turno cubierto', nota: '' },
  { kind: 'short', texto: 'Falta gente', nota: 'asignados < requeridos' },
  { kind: 'noShift', texto: 'Sin turno', nota: 'el patrón no declara segmento ese día' },
  { kind: 'undeclared', texto: 'Sin declarar', nota: 'la posición no tiene ningún segmento' },
] as const;

/**
 * La proyección de la semana: posiciones por días.
 *
 * <p><b>La rejilla es de siete días fijos y no de un rango cualquiera.</b> Fase 1 proyecta patrones
 * semanales porque un segmento guarda día de la semana, así que la semana no es una preferencia de
 * la vista: es lo que el modelo puede expresar. Cuando exista el patrón con ancla, un ciclo de tres
 * o seis días necesitará otra rejilla, y este componente no la va a fingir mientras tanto.</p>
 *
 * <p>La leyenda no es decorativa: es lo que hace que los cuatro estados se distingan sin color, y
 * por eso va dentro de la rejilla y no en un anexo que nadie abre.</p>
 */
@Component({
  selector: 'app-week-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState, PositionWeekRow],
  template: `
    <section class="rejilla">
      <header class="rejilla__head">
        <span class="rejilla__title">PROYECCIÓN DE LA SEMANA</span>
        <span class="rejilla__range">{{ rangeLabel() }}</span>
      </header>

      @if (rows().length === 0) {
        <gi-empty-state
          variant="missing-prerequisite"
          title="Este servicio no tiene posiciones"
          [description]="vacioCuerpo"
          [actionLabel]="emptyActionLabel()"
          (action)="createPosition.emit()"
        />
      } @else {
        <div class="rejilla__dias" [style.--dias]="days().length">
          <span class="rejilla__hueco"></span>
          @for (day of days(); track day) {
            <span class="rejilla__dia" [class.rejilla__dia--marcado]="day === highlightDate()">
              {{ diaCorto(day) }}
            </span>
          }
        </div>

        @for (row of rows(); track row.idPosition) {
          <app-position-week-row
            [row]="row"
            [highlightDate]="highlightDate()"
            (cellSelect)="cellSelect.emit($event)"
          />
        }

        <div class="rejilla__leyenda">
          <span class="rejilla__title">LEYENDA</span>
          @for (item of leyenda; track item.kind) {
            <span class="rejilla__item">
              <span class="rejilla__muestra" [class]="'rejilla__muestra--' + item.kind"></span>
              <span class="rejilla__texto">{{ item.texto }}</span>
              @if (item.nota) {
                <span class="rejilla__nota">{{ item.nota }}</span>
              }
            </span>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .rejilla {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .rejilla__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .rejilla__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }
    .rejilla__range { color: var(--gestia-muted); font-size: 11.5px; }

    .rejilla__dias {
      display: grid;
      grid-template-columns: 14.5rem repeat(var(--dias), minmax(0, 1fr));
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .rejilla__hueco { border-right: 1px solid var(--gestia-border); }

    .rejilla__dia {
      padding: 0.55rem 0.5rem;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.07em;
      text-align: center;
    }

    .rejilla__dia--marcado { color: var(--gestia-cyan-dark); background: var(--gestia-cyan-soft); }

    .rejilla__leyenda {
      display: flex;
      align-items: center;
      gap: 1.1rem;
      flex-wrap: wrap;
      padding: 0.75rem 0.85rem;
    }

    .rejilla__item { display: flex; align-items: center; gap: 0.4rem; }

    .rejilla__muestra {
      width: 0.9rem;
      height: 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-surface);
    }

    .rejilla__muestra--short { border-color: var(--gestia-danger); }
    .rejilla__muestra--undeclared { border-color: var(--gestia-warning); }
    .rejilla__muestra--noShift { background: var(--gestia-surface-soft); }

    .rejilla__texto { color: var(--gestia-text); font-size: 11.5px; font-weight: 500; }
    .rejilla__nota { color: var(--gestia-muted); font-size: 11.5px; }
  `,
})
export class WeekGrid implements OnInit {
  readonly rows = input.required<readonly PlanningRow[]>();
  readonly days = input.required<readonly string[]>();
  readonly highlightDate = input('');
  readonly emptyActionLabel = input('Crear la primera posición');

  readonly createPosition = output<void>();
  readonly cellSelect = output<PlanningCell>();

  protected readonly leyenda = LEYENDA;

  protected readonly vacioCuerpo =
    'Una posición es el puesto que hay que cubrir, y existe con independencia de quién lo ocupe. ' +
    'Sin posiciones no hay nada que proyectar, así que la semana no puede empezar aquí.';

  protected readonly rangeLabel = computed(() => {
    const days = this.days();

    if (days.length === 0) {
      return '';
    }

    const posiciones = this.rows().length;

    return `${posiciones} ${posiciones === 1 ? 'posición' : 'posiciones'} · ${formatOperationalDate(days[0])} – ${formatOperationalDate(days[days.length - 1])}`;
  });

  protected diaCorto(isoDate: string): string {
    const abreviatura = ABREVIATURA[serverDayOfWeek(isoDate)] ?? '';

    return `${abreviatura} ${isoDate.slice(8)}`.trim();
  }

  ngOnInit(): void {
    devAssert(
      this.days().length === 7,
      'app-week-grid: la rejilla es de siete días. Fase 1 proyecta patrones semanales porque un ' +
        'segmento guarda día de la semana; un rango de otro largo no se puede proyectar con este ' +
        'modelo, y fingirlo daría una semana con días que nadie declaró.',
    );

    devAssert(
      this.rows().every((row) => row.cells.length === this.days().length),
      'app-week-grid: toda fila tiene tantas celdas como días la cabecera. Si no, la rejilla se ' +
        'desalinea en silencio y se lee el día equivocado.',
    );
  }
}
