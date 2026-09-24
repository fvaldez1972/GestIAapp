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
 * <b>Sin turno</b>, y una posición de la que nadie declaró nada dice <b>Sin declarar</b>.</p>
 *
 * <p><b>La duda se dice una vez, no siete.</b> Cada celda sin declarar repetía «Turno o descanso»
 * debajo de la palabra, así que una posición sin patrón gastaba siete renglones en decir lo mismo
 * siete veces. Ahora lo dice la insignia de la fila —<b>Sin patrón</b>—, que es donde se decide, y
 * quien recorre la rejilla con lector de pantalla lo sigue oyendo celda por celda en el nombre
 * accesible.</p>
 *
 * <p><b>La cuenta de gente se lee sin abrir nada.</b> Un hueco enseña «2 de 4», no un icono: el
 * número es lo que decide si hay que ir a Cobertura, y esconderlo detrás de un color obliga a
 * pasar el ratón por catorce celdas para saber cuál mirar.</p>
 *
 * <p><b>Los estados no pesan igual, y la rejilla lo dibuja.</b> «Sin turno» no pide nada de nadie:
 * va sin contorno y sin relleno, para que la vista pase de largo. «Falta gente» va con relleno,
 * porque es lo único que hay que resolver hoy. Dibujadas todas con el mismo contorno, la que
 * importa se perdía entre las que no.</p>
 */
@Component({
  selector: 'app-position-week-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fila" [style.--dias]="row().cells.length">
      <div class="fila__pos">
        <span class="fila__name">{{ row().name }}</span>
        <span class="fila__linea">
          <span class="fila__code">{{ row().codePosition }}</span>
          <span class="fila__meta">{{ meta() }}</span>
          <span class="fila__estado" [class]="'fila__estado--' + estado().kind">
            {{ estado().texto }}
          </span>
        </span>
      </div>

      @for (cell of row().cells; track cell.date) {
        <button
          class="celda"
          type="button"
          [class]="'celda--' + cell.kind"
          [class.celda--apagada]="sinPatron()"
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
            @default {
              <span class="celda__titulo">{{ titulo(cell) }}</span>
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
      grid-template-columns: 14rem repeat(var(--dias), minmax(0, 1fr));
      align-items: stretch;
      border-top: 1px solid var(--gestia-border);
    }

    .fila:hover { background: var(--gestia-surface-soft); }

    /* Sin línea vertical separando la posición de sus días: la rejilla se lee como una lista de
       posiciones, no como una tabla con marco. */
    .fila__pos {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      justify-content: center;
      padding: 0.6rem 1rem;
    }

    .fila__name { color: var(--gestia-text); font-size: 14px; font-weight: 600; }

    .fila__linea { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }

    .fila__code,
    .fila__meta { color: var(--gestia-muted); font-size: 11px; }

    /* Cómo está la fila, de un vistazo y en la columna donde se decide. */
    .fila__estado {
      border-radius: var(--gestia-radius-chip);
      padding: 0.1rem 0.5rem;
      font-size: 10.5px;
      font-weight: 600;
    }

    .fila__estado--sinPatron { background: var(--gestia-warning-soft); color: var(--gestia-warning); }
    .fila__estado--huecos { background: var(--gestia-danger-soft); color: var(--gestia-danger); }
    .fila__estado--ok { background: var(--gestia-success-soft); color: var(--gestia-success); }

    /* La celda es una ficha de color, no un rectángulo con borde. El contorno de un píxel en
       catorce celdas era la otra mitad del aspecto de hoja de cálculo: el relleno dice el estado
       con más claridad y deja de dibujar una cuadrícula. */
    .celda {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      align-items: center;
      justify-content: center;
      min-height: 3rem;
      margin: 0.3rem;
      padding: 0.35rem 0.3rem;
      border: 0;
      border-radius: var(--gestia-radius-lg);
      background: none;
      color: var(--gestia-text);
      font: inherit;
      text-align: center;
      cursor: pointer;
    }

    .celda:hover { box-shadow: inset 0 0 0 1px var(--gestia-cyan-dark); }
    .celda:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .celda__titulo { font-size: 13px; font-weight: 600; }
    .celda__pie { color: var(--gestia-muted); font-size: 10.5px; }

    .celda--covered { background: var(--gestia-success-soft); }

    .celda--short { background: var(--gestia-danger-soft); }

    .celda--short .celda__titulo,
    .celda--short .celda__pie { color: var(--gestia-danger); }

    .celda--undeclared { background: var(--gestia-warning-soft); }

    .celda--undeclared .celda__titulo { color: var(--gestia-warning); font-size: 12px; }

    /* «Sin turno» no pide nada: ni relleno ni peso. */
    .celda--noShift .celda__titulo { color: var(--gestia-muted); font-size: 11.5px; font-weight: 400; }

    /* Siete veces lo mismo no es siete veces la información.
       Cuando la fila entera está sin declarar, sus siete celdas dicen exactamente lo mismo y no
       hay nada que comparar entre un día y otro: rellenas de ámbar son catorce fichas gritando un
       dato que la insignia de la fila ya dio. Se apagan, y el aviso se queda donde se decide. Una
       celda sin declarar suelta, dentro de una fila que sí declara otros días, conserva su color:
       ahí el dato sí distingue un día del resto. */
    .celda--apagada { background: none; }
    .celda--apagada .celda__titulo { color: var(--gestia-muted); font-size: 11.5px; font-weight: 400; }

    /* El día que la pantalla está mirando, con un aro en vez de un fondo: el fondo tapaba el color
       del propio estado, así que el día marcado dejaba de decir si estaba cubierto o corto. */
    .celda--marcada { box-shadow: inset 0 0 0 1px var(--gestia-cyan); }
  `,
})
export class PositionWeekRow implements OnInit {
  readonly row = input.required<PlanningRow>();

  /** Toda la fila sin declarar: sus celdas se apagan porque la insignia ya lo dijo una vez. */
  protected readonly sinPatron = computed(() => this.estado().kind === 'sinPatron');

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

  /**
   * Cómo está la fila entera, en dos palabras.
   *
   * <p>El orden no es cosmético. <b>Sin patrón va primero</b> porque es el único de los tres que
   * impide publicar: una posición que no declara nada no proyecta turnos, así que contar sus
   * huecos no tendría sentido —no hay turno del que falte gente—. Después los huecos, que se
   * resuelven sin tocar el patrón. Y sólo si no hay ninguno de los dos, la fila está lista.</p>
   */
  protected readonly estado = computed(() => {
    const cells = this.row().cells;

    if (cells.every((cell) => cell.kind === 'undeclared')) {
      return { kind: 'sinPatron', texto: 'Sin patrón' } as const;
    }

    const huecos = cells.filter((cell) => cell.kind === 'short').length;

    if (huecos > 0) {
      return { kind: 'huecos', texto: `${huecos} ${huecos === 1 ? 'hueco' : 'huecos'}` } as const;
    }

    return { kind: 'ok', texto: 'Sin huecos' } as const;
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
   *
   * <p>Aquí sigue estando la duda completa de una celda sin declarar, aunque la celda ya no la
   * escriba debajo: quien recorre la rejilla con lector no ve la insignia de la fila.</p>
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
