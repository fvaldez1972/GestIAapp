import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { GiMetricCard, GiMetricState, GiMetricTone } from '../../../shared/ui/gi-ui';
import {
  OverviewMetric,
  metricHint,
  metricLabel,
  metricPendingAction,
  metricPendingLabel,
  metricPill,
} from '../data-access/overview.models';

type Tarjeta = {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  readonly state: GiMetricState;
  readonly tone: GiMetricTone;
  readonly pill: string;
  readonly pendingLabel: string;
  readonly pendingAction: string;
  readonly route: string | null;
};

const TONOS: Record<string, GiMetricTone> = {
  Neutral: 'neutral',
  Success: 'success',
  Warning: 'warning',
  Danger: 'danger',
};

/**
 * La franja de indicadores.
 *
 * <p>No aparece cuando no hay ninguno que mostrar, y ésa es la decisión que evita el problema de
 * la pantalla vieja: <b>cuatro indicadores en cero enseñan a ignorar el tablero</b>. Cuando sí
 * aparece, cada tarjeta distingue el cero real del «sin datos aún», y el que falta dice qué falta
 * y cómo obtenerlo.</p>
 *
 * <p>La distinción llega decidida por el servidor. Aquí sólo se redacta.</p>
 */
@Component({
  selector: 'app-overview-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiMetricCard],
  template: `
    @if (cards().length) {
      <section class="metrics" aria-label="Indicadores de la operación">
        <p class="metrics__intro">
          <span class="metrics__kicker">TABLERO</span>
          <span class="metrics__note">{{ note() }}</span>
        </p>
        <div class="metrics__grid">
          @for (card of cards(); track card.key) {
            <gi-metric-card
              [label]="card.label"
              [value]="card.value"
              [hint]="card.hint"
              [state]="card.state"
              [tone]="card.tone"
              [pillLabel]="card.pill"
              [pendingLabel]="card.pendingLabel"
              [pendingActionLabel]="card.pendingAction"
              (pendingAction)="go(card.route)"
            />
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: block; }

    .metrics { display: flex; flex-direction: column; gap: 0.6rem; }

    .metrics__intro { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.6rem; margin: 0; }

    .metrics__kicker {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .metrics__note { color: var(--gestia-muted); font-size: 12px; }

    /* Se comprime a menos columnas antes que estrechar una tarjeta hasta cortar su línea de
       apoyo, que es lo que le da sentido al número. */
    .metrics__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      gap: 1rem;
    }
  `,
})
export class OverviewMetrics {
  private readonly router = inject(Router);

  readonly metrics = input.required<readonly OverviewMetric[]>();

  protected readonly cards = computed<readonly Tarjeta[]>(() =>
    this.metrics().map((metric) => ({
      key: metric.key,
      label: metricLabel(metric.key),
      value: metric.value,
      hint: metric.state === 'Pending' ? '' : metricHint(metric),
      state: metric.state === 'Pending' ? 'pending' : 'ready',
      tone: TONOS[metric.tone] ?? 'neutral',
      pill: metricPill(metric),
      pendingLabel: metricPendingLabel(metric.key),
      pendingAction: metricPendingAction(metric.key),
      route: metric.route,
    })),
  );

  /** Cuántos todavía no se pueden calcular, dicho una vez arriba en lugar de cuatro veces. */
  protected readonly note = computed(() => {
    const pendientes = this.cards().filter((card) => card.state === 'pending').length;

    if (pendientes === 0) {
      return 'Los cuatro indicadores están calculados.';
    }

    return pendientes === this.cards().length
      ? 'Ninguno tiene información todavía. Cada uno dice qué falta para tenerla.'
      : `${pendientes} de ${this.cards().length} todavía no se pueden calcular. Cada uno dice qué falta.`;
  });

  protected go(route: string | null): void {
    if (route) {
      void this.router.navigateByUrl(route);
    }
  }
}
