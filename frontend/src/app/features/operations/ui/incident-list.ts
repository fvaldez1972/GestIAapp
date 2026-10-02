import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IncidentSeverity, IncidentStatus } from '../../clients/data-access/client.models';
import { IncidentRow } from '../data-access/incident-day';

const SEVERIDAD: Record<IncidentSeverity, string> = {
  Low: 'Baja',
  Medium: 'Media',
  High: 'Alta',
  Critical: 'Crítica',
};

const ESTADO: Record<IncidentStatus, string> = {
  Open: 'Abierta',
  InReview: 'En revisión',
  Resolved: 'Resuelta',
  Cancelled: 'Cancelada',
};

/**
 * Las incidencias del día.
 *
 * <p><b>Las abiertas van primero.</b> Una incidencia resuelta es historia; una abierta es trabajo,
 * y el cierre del día la cuenta. Ordenar por hora mezclaría las dos y obligaría a recorrer la lista
 * entera para saber qué queda pendiente.</p>
 *
 * <p><b>El motivo que se enseña es el del hecho, no el de ninguna corrección.</b> Es lo que explica
 * qué pasó —un robo, una falta, un incidente médico— y sale del catálogo de la organización. El
 * motivo de una corrección posterior vive en la bitácora del registro y no en esta lista: son dos
 * cosas distintas y confundirlas haría que la lista contara la edición en lugar del hecho.</p>
 */
@Component({
  selector: 'app-incident-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="inc">
      <header class="inc__head">
        <span class="inc__title">INCIDENCIAS DEL DÍA</span>
        <span class="inc__cuenta">{{ resumen() }}</span>
        <span class="inc__nota">Las abiertas primero: son las que el cierre cuenta</span>
      </header>

      @if (rows().length === 0) {
        <p class="inc__limpio">
          <span class="inc__pill inc__pill--ok">Sin incidencias</span>
          No se registró ninguna en este día. Es información: el día transcurrió sin hechos que
          documentar.
        </p>
      } @else {
        <ul class="inc__lista">
          @for (row of ordenadas(); track row.idIncident) {
            <li class="inc__fila" [class.inc__fila--abierta]="esAbierta(row)">
              <span class="inc__cabeza">
                <span class="inc__pill" [class]="'inc__pill--' + row.severity.toLowerCase()">
                  {{ severidad(row) }}
                </span>
                <span class="inc__estado">{{ estado(row) }}</span>
                @if (row.afterClosure) {
                  <span class="inc__marca">Posterior al cierre</span>
                }
                <span class="inc__motivo">{{ row.factReasonLabel }}</span>
                @if (canWrite()) {
                  <button class="inc__accion" type="button" (click)="edit.emit(row)">Corregir</button>
                }
              </span>

              <span class="inc__quien">{{ row.positionLabel }}</span>
              <p class="inc__desc">{{ row.description }}</p>

              @if (row.resolutionNotes) {
                <p class="inc__resolucion">{{ row.resolutionNotes }}</p>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .inc {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .inc__head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .inc__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }

    .inc__cuenta {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.45rem;
      background: var(--gestia-surface);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .inc__nota { margin-left: auto; color: var(--gestia-muted); font-size: 11.5px; }

    .inc__lista { margin: 0; padding: 0; list-style: none; }

    .inc__fila {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .inc__fila:last-child { border-bottom: none; }
    .inc__fila--abierta { border-left: 3px solid var(--gestia-danger); }

    .inc__cabeza { display: flex; align-items: center; gap: 0.5rem; }

    .inc__pill,
    .inc__marca {
      border: 1px solid currentcolor;
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.45rem;
      font-size: 10.5px;
      font-weight: 600;
      flex: none;
    }

    .inc__pill--low { color: var(--gestia-muted); }
    .inc__pill--medium { color: var(--gestia-info); }
    .inc__pill--high { color: var(--gestia-warning); }
    .inc__pill--critical { color: var(--gestia-danger); }
    .inc__pill--ok { color: var(--gestia-success); }

    .inc__marca { color: var(--gestia-muted); }

    .inc__estado { color: var(--gestia-muted); font-size: 11.5px; }
    .inc__motivo { color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .inc__quien { color: var(--gestia-muted); font-size: 11.5px; }
    .inc__desc { margin: 0; color: var(--gestia-text); font-size: 12px; line-height: 1.5; }

    .inc__resolucion {
      margin: 0;
      padding-left: 0.6rem;
      border-left: 2px solid var(--gestia-border);
      color: var(--gestia-muted);
      font-size: 11.5px;
      line-height: 1.5;
    }

    .inc__accion {
      margin-left: auto;
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

    .inc__accion:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .inc__limpio {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin: 0;
      padding: 0.85rem;
      color: var(--gestia-muted);
      font-size: 12px;
      line-height: 1.5;
    }
  `,
})
export class IncidentList {
  readonly rows = input.required<readonly IncidentRow[]>();
  readonly canWrite = input(false);

  readonly edit = output<IncidentRow>();

  /** Abiertas primero: una resuelta es historia, una abierta es trabajo y el cierre la cuenta. */
  protected readonly ordenadas = computed(() =>
    [...this.rows()].sort((a, b) => Number(this.esAbierta(b)) - Number(this.esAbierta(a))),
  );

  protected readonly resumen = computed(() => {
    const abiertas = this.rows().filter((row) => this.esAbierta(row)).length;

    if (this.rows().length === 0) {
      return 'ninguna';
    }

    return abiertas === 0
      ? `${this.rows().length}, todas resueltas`
      : `${abiertas} ${abiertas === 1 ? 'abierta' : 'abiertas'} de ${this.rows().length}`;
  });

  protected esAbierta(row: IncidentRow): boolean {
    return row.status === 'Open' || row.status === 'InReview';
  }

  protected severidad(row: IncidentRow): string {
    return SEVERIDAD[row.severity];
  }

  protected estado(row: IncidentRow): string {
    return ESTADO[row.status];
  }
}
