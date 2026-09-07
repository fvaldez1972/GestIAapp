import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CoverageRecord, CoverageStatus } from '../../clients/data-access/client.models';

const ESTADO: Record<CoverageStatus, string> = {
  Requested: 'Solicitada',
  Confirmed: 'Confirmada',
  Completed: 'Completada',
  Cancelled: 'Cancelada',
};

/**
 * Las coberturas del día.
 *
 * <p><b>Una cobertura cancelada no cubre nada, y la lista lo dice sin rodeos.</b> Es la misma regla
 * con la que el servidor cuenta los turnos al descubierto: <i>cancelarla es justamente dejar el
 * turno sin cubrir</i>. Pintarla igual que una confirmada haría que la lista pareciera resolver algo
 * que sigue abierto.</p>
 *
 * <p>Se nombra a las dos personas: quién dejó el turno y quién lo tomó. Enseñar sólo al suplente
 * obligaría a recordar a quién está sustituyendo, que es justo lo que hay que conciliar después.</p>
 */
@Component({
  selector: 'app-coverage-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cov">
      <header class="cov__head">
        <span class="cov__title">COBERTURAS DEL DÍA</span>
        <span class="cov__cuenta">{{ resumen() }}</span>
      </header>

      @if (rows().length === 0) {
        <p class="cov__limpio">
          Ninguna. Si hubo faltas, sus turnos siguen al descubierto hasta que alguien los tome o se
          declaren sin cubrir al cerrar la incidencia.
        </p>
      } @else {
        <ul class="cov__lista">
          @for (row of rows(); track row.idCoverageRecord) {
            <li class="cov__fila" [class.cov__fila--nula]="esCancelada(row)">
              <span class="cov__estado" [class]="'cov__estado--' + row.status.toLowerCase()">
                {{ estado(row) }}
              </span>

              <span class="cov__quien">
                <strong>{{ row.replacementEmployeeName }}</strong>
                <span>cubre a {{ row.originalEmployeeName }}</span>
              </span>

              <span class="cov__horario">
                {{ row.coverageStartTime.slice(0, 5) }} – {{ row.coverageEndTime.slice(0, 5) }}
                @if (row.isOvernight) {
                  <em>cruza la medianoche</em>
                }
              </span>

              @if (esCancelada(row)) {
                <span class="cov__aviso">El turno sigue al descubierto</span>
              }

              @if (canWrite()) {
                <button class="cov__accion" type="button" (click)="edit.emit(row)">Corregir</button>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .cov {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .cov__head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .cov__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }
    .cov__cuenta { color: var(--gestia-muted); font-size: 11.5px; }

    .cov__lista { margin: 0; padding: 0; list-style: none; }

    .cov__fila {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.7rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .cov__fila:last-child { border-bottom: none; }
    .cov__fila--nula { background: var(--gestia-surface-soft); }

    .cov__estado {
      border: 1px solid currentcolor;
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.45rem;
      font-size: 10.5px;
      font-weight: 600;
      flex: none;
    }

    .cov__estado--requested { color: var(--gestia-info); }
    .cov__estado--confirmed { color: var(--gestia-success); }
    .cov__estado--completed { color: var(--gestia-muted); }
    .cov__estado--cancelled { color: var(--gestia-danger); }

    .cov__quien { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0; }
    .cov__quien strong { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .cov__quien span { color: var(--gestia-muted); font-size: 11.5px; }

    .cov__horario { color: var(--gestia-text); font-size: 12px; font-weight: 600; }
    .cov__horario em { color: var(--gestia-muted); font-size: 11px; font-style: normal; font-weight: 400; }

    .cov__aviso {
      border: 1px solid var(--gestia-danger);
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.45rem;
      color: var(--gestia-danger);
      font-size: 10.5px;
      font-weight: 600;
    }

    .cov__accion {
      height: 2.25rem;
      padding: 0 0.7rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .cov__accion:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .cov__limpio {
      margin: 0;
      padding: 0.85rem;
      color: var(--gestia-muted);
      font-size: 12px;
      line-height: 1.5;
    }
  `,
})
export class CoverageList {
  readonly rows = input.required<readonly CoverageRecord[]>();
  readonly canWrite = input(false);

  readonly edit = output<CoverageRecord>();

  protected readonly resumen = computed(() => {
    const total = this.rows().length;

    if (total === 0) {
      return 'ninguna';
    }

    const cubren = this.rows().filter((row) => !this.esCancelada(row)).length;

    return cubren === total ? `${total}` : `${cubren} de ${total} cubren de verdad`;
  });

  /** Cancelarla es justamente dejar el turno sin cubrir, así que no cuenta como cobertura. */
  protected esCancelada(row: CoverageRecord): boolean {
    return row.status === 'Cancelled';
  }

  protected estado(row: CoverageRecord): string {
    return ESTADO[row.status];
  }
}
