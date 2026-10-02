import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { GiEmptyState } from '../../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../../shared/util/operational-date';
import { OverviewApiService } from '../../data-access/overview-api.service';
import { Overview } from '../../data-access/overview.models';
import { AttentionList } from '../../ui/attention-list';
import { OverviewMetrics } from '../../ui/overview-metrics';

/**
 * Inicio.
 *
 * <p><b>Inicio es el tablero del administrador de la organización, y sólo eso.</b> Cuando todavía
 * no hay información se ve sin información; no se convierte en otra pantalla mientras tanto. Una
 * pantalla que cambia de propósito según cuántos datos haya son dos pantallas con un nombre.</p>
 *
 * <p>Por eso el tablero y la lista de atención se dibujan <b>siempre</b>. Lo que cambia con los
 * datos no es qué pantalla es, sino qué puede afirmar: cada indicador distingue el cero real del
 * «sin datos aún», y la lista de atención distingue «no hay nada pendiente» de «todavía no hay con
 * qué saberlo».</p>
 *
 * <p>Esta clase sólo compone y carga: pide una vez, reparte a las dos piezas y decide qué mostrar
 * cuando no hay organización o cuando la petición falla. Ningún cuerpo vive aquí.</p>
 */
@Component({
  selector: 'app-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AttentionList, GiEmptyState, OverviewMetrics],
  template: `
    <div class="overview">
      <header class="overview__heading">
        <p class="overview__eyebrow">INICIO</p>
        <h1 class="overview__title">{{ title() }}</h1>
        <p class="overview__subtitle">{{ subtitle() }}</p>
      </header>

      @if (!organizationId()) {
        <!--
          El super admin antes de entrar a una organización. No es un tablero en ceros: es que
          falta un prerrequisito, y el prerrequisito es elegir la organización arriba.
        -->
        <gi-empty-state
          variant="missing-prerequisite"
          title="Elige una organización para ver su inicio"
          description="Inicio describe la operación de una organización concreta. Elígela en la barra de contexto, arriba, o entra desde la lista de organizaciones."
          actionLabel="Ver organizaciones"
          link="/plataforma/organizaciones"
        />
      } @else if (error()) {
        <p class="overview__error" role="alert">{{ error() }}</p>
        <button class="overview__retry" type="button" (click)="reload()">Volver a intentar</button>
      } @else if (loading()) {
        <p class="overview__loading" role="status">Cargando el estado de la organización…</p>
      } @else if (overview(); as data) {
        <!--
          Los dos se dibujan siempre, con datos y sin ellos. Esconderlos al principio convertiría
          Inicio en una pantalla distinta durante la configuración, que es justo lo que no debe
          pasar; cada pieza dice por sí misma qué puede y qué no puede afirmar.
        -->
        <app-overview-metrics [metrics]="data.metrics" />
        <app-attention-list [items]="data.attention" [hasData]="hasData()" />
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .overview { display: flex; flex-direction: column; gap: var(--gestia-page-gap); min-width: 0; }

    .overview__heading { display: flex; flex-direction: column; gap: 0.25rem; }

    .overview__eyebrow {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
    }

    .overview__title { margin: 0; color: var(--gestia-navy); font-size: 22px; font-weight: 600; }

    .overview__subtitle { margin: 0; color: var(--gestia-muted); font-size: 13px; }

    .overview__error {
      margin: 0;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-danger);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-danger);
      font-size: 12.5px;
    }

    .overview__loading {
      margin: 0;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-muted);
      font-size: 12.5px;
    }

    .overview__retry {
      align-self: flex-start;
      height: var(--gestia-control-height);
      padding: 0 1rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .overview__retry:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
  `,
})
export class OverviewPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(OverviewApiService);

  /**
   * La organización se hereda de la barra de contexto. Esta pantalla no tiene selector propio ni
   * copia del identificador: hay una sola fuente y es la de arriba.
   */
  protected readonly organizationId = this.auth.operationalOrganizationId;

  protected readonly overview = signal<Overview | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly organizationName = computed(
    () => this.auth.activeOrganization()?.legalName ?? '',
  );

  /**
   * El título nombra la organización, y nada más.
   *
   * <p>Antes decía «Configuración inicial de X» mientras el camino ocupaba el cuerpo. Sin el
   * camino ese encabezado nombraría algo que ya no está debajo, y con él se iba la última pieza
   * que hacía que la pantalla cambiara de propósito con el avance.</p>
   */
  protected readonly title = computed(() => this.organizationName() || 'Inicio');

  protected readonly subtitle = computed(() => {
    const data = this.overview();

    if (!this.organizationId()) {
      return 'Estás en la vista de plataforma.';
    }

    if (!data) {
      return 'La organización se hereda de la barra de contexto.';
    }

    return `Semana del ${formatOperationalDate(data.weekStartDate)} al ` +
      `${formatOperationalDate(data.weekEndDate)}. Fecha operativa: ` +
      `${formatOperationalDate(data.operationDate)}.`;
  });

  /**
   * Si el sistema tiene con qué afirmar algo.
   *
   * <p>Sale de los indicadores y no de un conteo de configuración: un indicador en <c>Ready</c> es
   * exactamente el servidor diciendo «esto sí lo pude calcular». Con los cuatro pendientes, la
   * lista de atención vacía no significa que no haya nada pendiente, sino que no hay de dónde
   * saberlo.</p>
   */
  protected readonly hasData = computed(
    () => this.overview()?.metrics.some((metric) => metric.state === 'Ready') ?? false,
  );

  constructor() {
    // Cambiar de organización recarga el estado, sin que la pantalla tenga que enterarse por otro
    // camino: la barra de contexto es la única que lo escribe.
    effect(() => {
      const organizationId = this.organizationId();

      if (organizationId) {
        this.load(organizationId);
      } else {
        this.overview.set(null);
      }
    });
  }

  protected reload(): void {
    const organizationId = this.organizationId();

    if (organizationId) {
      this.load(organizationId);
    }
  }

  private load(organizationId: string): void {
    this.loading.set(true);
    this.error.set('');

    this.api.getOverview(organizationId).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
      },
      error: () => {
        this.overview.set(null);
        this.error.set(
          'No se pudo leer el estado de la organización. Los módulos del menú siguen disponibles.',
        );
        this.loading.set(false);
      },
    });
  }
}
