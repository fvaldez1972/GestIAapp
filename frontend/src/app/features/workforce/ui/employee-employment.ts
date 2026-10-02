import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmploymentPeriod } from '../data-access/workforce.models';
import { formatOperationalDate } from '../../../shared/util/operational-date';

@Component({
  selector: 'app-employee-employment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hist">
      <p class="hist__antiguedad">
        <span class="hist__antiguedad-valor">{{ antiguedad() }}</span>
        <span class="hist__antiguedad-nota">{{ notaAntiguedad() }}</span>
      </p>

      @if (periods().length === 0) {
        <p class="hist__vacio">
          Sin historial laboral. El periodo se abre al contratar a la persona.
        </p>
      } @else {
        <ol class="hist__lista">
          @for (periodo of periods(); track periodo.idEmploymentPeriod) {
            <li class="hist__fila" [class.hist__fila--abierto]="periodo.isOpen">
              <span class="hist__rango">
                {{ fecha(periodo.startDate) }} — {{ periodo.endDate ? fecha(periodo.endDate) : 'a la fecha' }}
              </span>
              @if (periodo.isOpen) {
                <span class="hist__estado hist__estado--abierto">Vigente</span>
              } @else {
                <span class="hist__estado">Baja</span>
                <span class="hist__motivo">{{ periodo.terminationReason }}</span>
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: `
    .hist { display: grid; gap: 0.6rem; }

    .hist__antiguedad { display: flex; align-items: baseline; gap: 0.5rem; margin: 0; }
    .hist__antiguedad-valor { color: var(--gestia-text); font-size: 14px; font-weight: 600; }
    .hist__antiguedad-nota { color: var(--gestia-muted); font-size: 11.5px; }

    .hist__vacio { margin: 0; color: var(--gestia-muted); font-size: 12px; }

    .hist__lista { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }

    .hist__fila {
      display: grid;
      grid-template-columns: auto auto 1fr;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.4rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .hist__fila--abierto { background: var(--gestia-success-soft); border-color: var(--gestia-border); }

    .hist__rango { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

    .hist__estado {
      padding: 0.05rem 0.4rem;
      border-radius: var(--gestia-radius-chip);
      background: var(--gestia-surface);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .hist__estado--abierto { color: var(--gestia-text); }

    .hist__motivo { color: var(--gestia-muted); font-size: 11.5px; min-width: 0; }

    @media (width < 45rem) {
      .hist__fila { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class EmployeeEmployment {
  readonly periods = input<readonly EmploymentPeriod[]>([]);
  readonly today = input('');

  protected fecha(valor: string): string {
    return formatOperationalDate(valor);
  }

  private readonly vigente = computed(() => this.periods().find((periodo) => periodo.isOpen) ?? null);

  /** La antigüedad cuenta desde el último ingreso; los periodos anteriores no suman. */
  protected readonly antiguedad = computed(() => {
    const abierto = this.vigente();

    if (!abierto) {
      return this.periods().length === 0 ? 'Sin antigüedad' : 'Sin relación vigente';
    }

    const desde = new Date(`${abierto.startDate}T00:00:00`);
    const hasta = new Date(`${this.today() || abierto.startDate}T00:00:00`);
    const meses = Math.max(
      0,
      (hasta.getFullYear() - desde.getFullYear()) * 12 +
        (hasta.getMonth() - desde.getMonth()) -
        (hasta.getDate() < desde.getDate() ? 1 : 0),
    );
    const anios = Math.floor(meses / 12);
    const resto = meses % 12;

    if (anios === 0) {
      return resto === 1 ? '1 mes' : `${resto} meses`;
    }

    const parteAnios = anios === 1 ? '1 año' : `${anios} años`;
    return resto === 0 ? parteAnios : `${parteAnios} y ${resto === 1 ? '1 mes' : `${resto} meses`}`;
  });

  protected readonly notaAntiguedad = computed(() => {
    const abierto = this.vigente();

    if (!abierto) {
      return this.periods().length === 0 ? 'todavía no ha sido contratada' : 'dada de baja';
    }

    return this.periods().length > 1
      ? `desde el último ingreso, ${this.fecha(abierto.startDate)}`
      : `desde el ${this.fecha(abierto.startDate)}`;
  });
}
