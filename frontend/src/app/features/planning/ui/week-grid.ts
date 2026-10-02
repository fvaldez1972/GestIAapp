import { ChangeDetectionStrategy, Component, OnInit, computed, input, output } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { PositionWeekRow } from './position-week-row';
import { devAssert } from '../../../shared/ui/dev-assert';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { PlanningCell, PlanningRow, serverDayOfWeek } from '../data-access/planning.models';

/**
 * Qué celda se eligió, y de qué posición.
 *
 * <p>Las dos cosas viajan juntas a propósito. Emitir sólo la celda obliga a quien escucha a
 * recordar en qué fila estaba, y ese recuerdo se desincroniza en cuanto la pantalla marca otra
 * posición por su cuenta: se abriría el cajón de candidatos de una posición y se asignaría gente a
 * otra, sin que nada falle.</p>
 */
export type PlanningCellPick = {
  readonly idPosition: string;
  readonly cell: PlanningCell;
};

const ABREVIATURA: Record<string, string> = {
  Monday: 'LUN',
  Tuesday: 'MAR',
  Wednesday: 'MIÉ',
  Thursday: 'JUE',
  Friday: 'VIE',
  Saturday: 'SÁB',
  Sunday: 'DOM',
};

/**
 * Cada estado con la palabra que lo nombra. El color va con la palabra, nunca solo.
 *
 * <p><b>Las notas dicen qué significa el estado, no cómo se calcula.</b> «Falta gente» llevaba
 * «asignados &lt; requeridos», que es la fórmula de adentro y no le dice nada a quien planea; sin
 * nota, la palabra se explica sola. «Sin turno» llevaba «el patrón no declara segmento ese día»,
 * que nombra la causa técnica; ahora dice <b>No requiere cobertura</b>, que es la consecuencia y es
 * lo que hay que saber para decidir.</p>
 *
 * <p><b>«Sin declarar» salió de la leyenda el 24 de septiembre de 2026, por petición.</b> La celda
 * sigue diciéndolo y sigue teniendo su color: lo que se retiró es el renglón que lo explicaba
 * abajo. Si vuelve a hacer falta, es una línea.</p>
 */
const LEYENDA = [
  { kind: 'covered', texto: 'Turno cubierto', nota: '' },
  { kind: 'short', texto: 'Falta gente', nota: '' },
  { kind: 'noShift', texto: 'Sin turno', nota: 'No requiere cobertura' },
] as const;

/**
 * La proyección de la semana: posiciones por días.
 *
 * <p><b>La rejilla es de siete días fijos y no de un rango cualquiera.</b> Fase 1 proyecta patrones
 * semanales porque un segmento guarda día de la semana, así que la semana no es una preferencia de
 * la vista: es lo que el modelo puede expresar. Cuando exista el patrón con ancla, un ciclo de tres
 * o seis días necesitará otra rejilla, y este componente no la va a fingir mientras tanto.</p>
 *
 * <p><b>La cabecera dice cómo está la semana antes de que nadie lea una celda.</b> Con tres
 * posiciones son veintiuna celdas, y saber si hay algo que resolver exigía recorrerlas una por
 * una. El vistazo cuenta cada estado y sólo nombra los que existen: una semana sin huecos no
 * enseña un cero, porque un cero también ocupa sitio y no dice nada.</p>
 *
 * <p><b>La acción de proyectar vive aquí</b>, en la cabecera de lo que modifica, y no en un aviso
 * suelto debajo de la rejilla. Quedó huérfana el 24 de septiembre de 2026 al retirarse el texto
 * que la presentaba: un enlace subrayado dentro de un recuadro vacío.</p>
 *
 * <p>La leyenda no es decorativa: es lo que hace que los estados se distingan sin color. Sus
 * muestras eran cuadrados con borde, que a ese tamaño se leen como <b>casillas sin marcar</b>;
 * ahora cada estado se enseña con su propia palabra pintada como la celda, que es lo que hay que
 * reconocer en la rejilla.</p>
 */
@Component({
  selector: 'app-week-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState, PositionWeekRow],
  template: `
    <section class="rejilla">
      <header class="rejilla__head">
        <span class="rejilla__id">
          <h2 class="rejilla__title">Proyección de la semana</h2>
          <span class="rejilla__range">{{ rangeLabel() }}</span>
        </span>

        <span class="rejilla__vistazo">
          @for (conteo of vistazo(); track conteo.kind) {
            <span class="rejilla__conteo" [attr.data-kind]="conteo.kind">{{ conteo.texto }}</span>
          }
        </span>

        @if (canProject()) {
          <button
            class="rejilla__accion"
            type="button"
            [disabled]="busy()"
            (click)="project.emit()"
          >
            Proyectar desde los patrones
          </button>
        }
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
              <span class="rejilla__diaNombre">{{ diaNombre(day) }}</span>
              <span class="rejilla__diaNumero">{{ diaNumero(day) }}</span>
            </span>
          }
        </div>

        @for (row of rows(); track row.idPosition) {
          <app-position-week-row
            [row]="row"
            [highlightDate]="highlightDate()"
            (cellSelect)="cellSelect.emit({ idPosition: row.idPosition, cell: $event })"
          />
        }

        <div class="rejilla__leyenda">
          @for (item of leyenda; track item.kind) {
            <span class="rejilla__item" [attr.data-kind]="item.kind">
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
      border-radius: var(--gestia-radius-lg);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    /* Sin banda gris ni versalitas de 10 px: un encabezado de tarjeta con su nombre legible y el
       rango debajo. El rótulo en versalitas diminutas era lo que hacía que la tarjeta se leyera
       como la cabecera de una tabla y no como una sección de la pantalla. */
    .rejilla__head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.7rem 1rem;
    }

    .rejilla__id { display: flex; flex-direction: column; gap: 0.1rem; margin-right: auto; }

    .rejilla__title { margin: 0; color: var(--gestia-navy); font-size: 16px; font-weight: 600; }
    .rejilla__range { color: var(--gestia-muted); font-size: 12px; }

    .rejilla__vistazo { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }

    .rejilla__conteo {
      border-radius: var(--gestia-radius-chip);
      padding: 0.15rem 0.55rem;
      font-size: 11px;
      font-weight: 600;
    }

    .rejilla__conteo[data-kind='covered'] { background: var(--gestia-success-soft); color: var(--gestia-success); }
    .rejilla__conteo[data-kind='short'] { background: var(--gestia-danger-soft); color: var(--gestia-danger); }
    .rejilla__conteo[data-kind='undeclared'] { background: var(--gestia-warning-soft); color: var(--gestia-warning); }

    .rejilla__accion {
      flex: none;
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-navy);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .rejilla__accion:hover { border-color: var(--gestia-cyan-dark); }
    .rejilla__accion[disabled] { opacity: 0.5; cursor: not-allowed; }
    .rejilla__accion:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    /* Sin líneas verticales entre columnas. Las catorce rayas de la rejilla eran la mitad de lo
       que la hacía parecer una hoja de cálculo; el relleno de cada celda ya separa los días. */
    .rejilla__dias {
      display: grid;
      grid-template-columns: 14rem repeat(var(--dias), minmax(0, 1fr));
      padding-bottom: 0.3rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .rejilla__dia {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      padding: 0.35rem 0.5rem;
    }

    .rejilla__diaNombre {
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .rejilla__diaNumero { color: var(--gestia-text); font-size: 16px; font-weight: 600; line-height: 1.2; }

    /* El día que se está mirando, marcado como lo marca un calendario: el número dentro de un
       círculo. Antes era un fondo cian que teñía la columna entera de la cabecera. */
    .rejilla__dia--marcado .rejilla__diaNombre { color: var(--gestia-cyan-dark); }

    .rejilla__dia--marcado .rejilla__diaNumero {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 50%;
      background: var(--gestia-cyan-dark);
      color: var(--gestia-surface);
    }

    .rejilla__leyenda {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      padding: 0.55rem 1rem;
    }

    .rejilla__item { display: flex; align-items: center; gap: 0.35rem; }

    /* Cada palabra pintada como su celda: la muestra es el propio nombre del estado, y no un
       cuadrito al lado que a este tamaño se leía como una casilla de formulario. */
    .rejilla__texto {
      border-radius: var(--gestia-radius-chip);
      padding: 0.15rem 0.55rem;
      font-size: 11px;
      font-weight: 600;
    }

    .rejilla__item[data-kind='covered'] .rejilla__texto {
      background: var(--gestia-success-soft);
      color: var(--gestia-success);
    }

    .rejilla__item[data-kind='short'] .rejilla__texto {
      background: var(--gestia-danger-soft);
      color: var(--gestia-danger);
    }

    /* «Sin turno» tenía la muestra en texto pelado sobre el fondo de la tarjeta, así que no se
       distinguía de la nota que lleva al lado: la leyenda enseñaba tres estados y sólo dos se
       veían. Lleva el mismo relleno neutro que su celda, que es lo que hay que reconocer. */
    .rejilla__item[data-kind='noShift'] .rejilla__texto {
      border: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
      color: var(--gestia-muted);
      font-weight: 400;
    }

    .rejilla__nota { color: var(--gestia-muted); font-size: 11px; }
  `,
})
export class WeekGrid implements OnInit {
  readonly rows = input.required<readonly PlanningRow[]>();
  readonly days = input.required<readonly string[]>();
  readonly highlightDate = input('');
  readonly emptyActionLabel = input('Crear la primera posición');

  /** Si se ofrece proyectar la semana desde los patrones de las posiciones. */
  readonly canProject = input(false);
  /** Hay una escritura en vuelo: la acción se apaga para no mandarla dos veces. */
  readonly busy = input(false);

  readonly createPosition = output<void>();
  readonly cellSelect = output<PlanningCellPick>();
  readonly project = output<void>();

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

  /**
   * Cómo está la semana, contando celdas.
   *
   * <p><b>Un estado con cero celdas no se nombra.</b> Un «0 con falta» ocupa el mismo sitio que un
   * «2 con falta» y obliga a leer el número para saber que no hay nada que hacer; callarlo deja
   * que lo que sí existe se vea de lejos.</p>
   *
   * <p><b>«Sin turno» no se cuenta.</b> Es el estado que no pide nada de nadie, y en una semana
   * normal es la mayoría de las celdas: contarlo pondría el número más grande junto a los dos que
   * de verdad hay que mirar.</p>
   */
  protected readonly vistazo = computed(() => {
    const celdas = this.rows().flatMap((row) => row.cells);

    const cuenta = (kind: PlanningCell['kind']) => celdas.filter((cell) => cell.kind === kind).length;

    const cubiertos = cuenta('covered');
    const conFalta = cuenta('short');
    const sinDeclarar = cuenta('undeclared');

    return [
      { kind: 'covered', n: cubiertos, texto: `${cubiertos} ${cubiertos === 1 ? 'cubierto' : 'cubiertos'}` },
      { kind: 'short', n: conFalta, texto: `${conFalta} con falta` },
      { kind: 'undeclared', n: sinDeclarar, texto: `${sinDeclarar} sin declarar` },
    ].filter((conteo) => conteo.n > 0);
  });

  protected diaNombre(isoDate: string): string {
    return ABREVIATURA[serverDayOfWeek(isoDate)] ?? '';
  }

  protected diaNumero(isoDate: string): string {
    return isoDate.slice(8);
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
