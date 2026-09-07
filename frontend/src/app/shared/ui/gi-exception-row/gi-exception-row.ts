import { ChangeDetectionStrategy, Component, OnInit, computed, input, output } from '@angular/core';
import { devAssert } from '../dev-assert';

/**
 * Los tres tipos de excepción de un día operativo.
 *
 * <p><b>No son tres colores del mismo hecho: son tres hechos distintos y siguen caminos distintos.</b>
 * La falta y el retardo son <i>de persona</i> y continúan en una incidencia. El hueco es <i>de la
 * posición</i>: no hay a quién registrarle nada, porque nadie está asignado, y se resuelve en
 * Cobertura.</p>
 */
export type GiExceptionType = 'absence' | 'late' | 'gap';

const PILDORA: Record<GiExceptionType, string> = {
  absence: 'FALTA',
  late: 'RETARDO',
  gap: 'HUECO',
};

/**
 * Una fila de lo que se salió de lo planeado.
 *
 * <p><b>El tipo nunca se lee sólo por el color.</b> La píldora lleva la palabra dentro, porque un
 * borde rojo y uno ámbar son el mismo borde en escala de grises, y aquí la diferencia decide si la
 * acción es registrar una incidencia o ir a cobertura.</p>
 *
 * <p><b>La acción del hueco es secundaria, y no es un detalle visual.</b> En una falta o un retardo
 * hay una persona y hay asistencia que registrar, así que la acción es la continuación natural del
 * renglón. En un hueco no hay nadie: la posición pide cuatro elementos y tiene tres. Ofrecerla con
 * el mismo peso invitaría a registrar una asistencia que no existe.</p>
 *
 * <p><b>Planeado y real van uno al lado del otro.</b> Una excepción es precisamente la distancia
 * entre los dos, y enseñar sólo el real obliga a recordar contra qué se compara.</p>
 */
@Component({
  selector: 'gi-exception-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gi-exc">
      <div class="gi-exc__head">
        <span class="gi-exc__pill" [class]="'gi-exc__pill--' + type()">{{ pill() }}</span>

        <span class="gi-exc__who">
          <span class="gi-exc__name">{{ subject() }}</span>
          <span class="gi-exc__meta">{{ meta() }}</span>
        </span>

        <span class="gi-exc__slot">
          <span class="gi-exc__label">PLANEADO</span>
          <span class="gi-exc__value">{{ planned() }}</span>
        </span>

        <span class="gi-exc__slot">
          <span class="gi-exc__label">REAL</span>
          <span class="gi-exc__value" [class]="'gi-exc__value--' + type()">{{ actual() }}</span>
          @if (actualNote()) {
            <span class="gi-exc__meta">{{ actualNote() }}</span>
          }
        </span>

        <span class="gi-exc__action">
          @if (badge()) {
            <span class="gi-exc__badge">{{ badge() }}</span>
          }
          <button
            class="gi-exc__button"
            [class.gi-exc__button--primary]="isPrimary()"
            type="button"
            [disabled]="!!disabledReason()"
            [attr.aria-describedby]="disabledReason() ? helpId : null"
            (click)="act.emit()"
          >
            {{ actionLabel() }}
          </button>
        </span>
      </div>

      @if (disabledReason()) {
        <p class="gi-exc__why" [id]="helpId">{{ disabledReason() }}</p>
      }

      @if (consequence()) {
        <p class="gi-exc__consequence">{{ consequence() }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .gi-exc { border-bottom: 1px solid var(--gestia-border); }

    .gi-exc__head {
      display: grid;
      grid-template-columns: 6.5rem minmax(0, 1fr) 11rem 13rem auto;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem;
    }

    .gi-exc__pill {
      justify-self: start;
      border: 1px solid currentcolor;
      border-radius: var(--gestia-radius-pill);
      padding: 0.15rem 0.5rem;
      font-size: 10.5px;
      font-weight: 600;
    }

    /* El color acompaña a la palabra; nunca la sustituye. */
    .gi-exc__pill--absence { color: var(--gestia-danger); }
    .gi-exc__pill--late { color: var(--gestia-warning); }
    .gi-exc__pill--gap { color: var(--gestia-danger); }

    .gi-exc__who { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    .gi-exc__name { color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .gi-exc__meta { color: var(--gestia-muted); font-size: 11.5px; }

    .gi-exc__slot {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding-left: 0.75rem;
      border-left: 1px solid var(--gestia-border);
    }

    .gi-exc__label { color: var(--gestia-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.07em; }
    .gi-exc__value { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .gi-exc__value--absence, .gi-exc__value--gap { color: var(--gestia-danger); }
    .gi-exc__value--late { color: var(--gestia-warning); }

    .gi-exc__action { justify-self: end; display: flex; align-items: center; gap: 0.5rem; }

    .gi-exc__badge {
      border: 1px solid var(--gestia-muted);
      border-radius: var(--gestia-radius-pill);
      padding: 0.15rem 0.45rem;
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .gi-exc__button {
      height: var(--gestia-control-height);
      padding: 0 0.85rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-exc__button--primary {
      border-color: var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .gi-exc__button[disabled] { opacity: 0.5; cursor: not-allowed; }
    .gi-exc__button:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .gi-exc__why,
    .gi-exc__consequence {
      margin: 0;
      padding: 0.55rem 0.85rem;
      border-top: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
      color: var(--gestia-muted);
      font-size: 11.5px;
      line-height: 1.5;
    }
  `,
})
export class GiExceptionRow implements OnInit {
  readonly type = input.required<GiExceptionType>();

  /** A quién le pasó, o qué posición quedó corta cuando no hay nadie. */
  readonly subject = input.required<string>();
  readonly meta = input('');

  readonly planned = input.required<string>();
  readonly actual = input.required<string>();
  readonly actualNote = input('');

  readonly actionLabel = input.required<string>();

  /**
   * Por qué la acción no se puede usar. Vacío significa que sí se puede.
   *
   * <p>Una acción inhabilitada que no dice por qué está prohibida por el sistema: quien la ve
   * supone que la aplicación se rompió, y no tiene forma de saber qué le falta.</p>
   */
  readonly disabledReason = input('');

  /** Lo que la fila deja al descubierto, cuando conviene decirlo bajo el renglón. */
  readonly consequence = input('');

  /** Una marca extra, como «posterior al cierre». */
  readonly badge = input('');

  readonly act = output<void>();

  protected readonly helpId = `gi-exc-why-${++instances}`;
  protected readonly pill = computed(() => PILDORA[this.type()]);

  /**
   * El hueco es la excepción: no hay a quién registrarle una asistencia, así que su acción no
   * compite con las otras dos.
   */
  protected readonly isPrimary = computed(() => this.type() !== 'gap');

  ngOnInit(): void {
    devAssert(
      this.actionLabel().trim().length > 0,
      'gi-exception-row: toda excepción trae su acción. Una fila que dice que algo se salió de lo ' +
        'planeado y no ofrece qué hacer deja el trabajo a medias justo donde se necesita seguir.',
    );

    devAssert(
      this.type() !== 'gap' || !/incidencia/i.test(this.actionLabel()),
      'gi-exception-row: un hueco no continúa en incidencia. No hay persona a la que registrarle ' +
        'nada: la posición pide más elementos de los que tiene asignados, y eso se resuelve en ' +
        'Cobertura.',
    );

    devAssert(
      this.planned().trim().length > 0 && this.actual().trim().length > 0,
      'gi-exception-row: una excepción es la distancia entre lo planeado y lo real, así que los ' +
        'dos tienen que estar. Enseñar sólo uno obliga a recordar contra qué se compara.',
    );
  }
}

let instances = 0;
