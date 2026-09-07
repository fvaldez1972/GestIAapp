import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  OverviewSetupCounts,
  OverviewSetupStep,
  setupStepAction,
  setupStepBlockedBy,
  setupStepDetail,
  setupStepTitle,
} from '../data-access/overview.models';

/**
 * En qué situación está un paso.
 *
 * <p>Son cuatro y no dos porque «pendiente» esconde la diferencia que le importa a quien entra:
 * el paso que puede hacer <b>ahora</b>, el que puede hacer cuando quiera, y el que no puede hacer
 * todavía. Pintarlos igual obliga a leer los siete para encontrar por dónde empezar.</p>
 */
export type SetupStepState = 'done' | 'current' | 'available' | 'blocked';

/**
 * Una fila del camino de configuración.
 *
 * <p>Lleva su propia evidencia: un paso hecho dice con qué se cerró, y uno bloqueado dice de qué
 * depende <b>antes</b> de que el usuario entre al módulo y se encuentre la pared.</p>
 */
@Component({
  selector: 'app-setup-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <li class="step" [class]="'step--' + state()">
      <span class="step__badge" aria-hidden="true">
        @if (state() === 'done') {
          ✓
        } @else {
          {{ step().order }}
        }
      </span>

      <span class="step__body">
        <span class="step__title">
          <span class="step__name">{{ title() }}</span>
          @if (state() === 'done') {
            <span class="step__done">Hecho</span>
          }
        </span>
        <span class="step__detail">{{ detail() }}</span>
        @if (blocked()) {
          <span class="step__blocked">{{ blocked() }}</span>
        }
      </span>

      @if (step().route) {
        <a
          class="step__action"
          [class.step__action--primary]="state() === 'current'"
          [routerLink]="step().route"
          [attr.aria-label]="actionLabel() + ': ' + title()"
        >{{ actionLabel() }}</a>
      } @else {
        <!-- Sin permiso no se ofrece la puerta, pero el paso se sigue viendo: describe a la
             organización, no a quien mira. -->
        <span class="step__no-access">Lo resuelve quien administra ese módulo</span>
      }
    </li>
  `,
  styles: `
    :host { display: contents; }

    .step {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 0.8rem var(--gestia-card-padding);
      border-bottom: 1px solid var(--gestia-border);
    }

    .step:last-child { border-bottom: 0; }

    /* El paso accionable se distingue por el fondo y por el badge lleno, no sólo por el botón. */
    .step--current { background: var(--gestia-surface-soft); }

    .step__badge {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      color: var(--gestia-muted);
      font-size: 12px;
      font-weight: 600;
    }

    .step--done .step__badge { border-color: var(--gestia-success); color: var(--gestia-success); }
    .step--current .step__badge { border-color: var(--gestia-navy); background: var(--gestia-navy); color: var(--gestia-surface); }
    .step--available .step__badge { border-color: var(--gestia-navy); color: var(--gestia-navy); }

    .step__body { display: flex; flex: 1; flex-direction: column; gap: 0.2rem; min-width: 0; }

    .step__title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--gestia-text);
      font-size: 13px;
      font-weight: 600;
    }

    .step__name { overflow-wrap: anywhere; }

    .step__done {
      padding: 0.05rem 0.3rem;
      border: 1px solid var(--gestia-success);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-success);
      font-size: 10.5px;
    }

    .step__detail { color: var(--gestia-muted); font-size: 11.5px; }

    /* La dependencia va en su propia línea y con la palabra, no como un color apagado. */
    .step__blocked { color: var(--gestia-warning); font-size: 11.5px; font-weight: 600; }

    .step__action {
      flex: none;
      color: var(--gestia-cyan-dark);
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
    }

    .step__action:hover { text-decoration: underline; }

    .step__action:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .step__action--primary {
      display: flex;
      align-items: center;
      height: var(--gestia-control-height);
      padding: 0 1rem;
      border-radius: var(--gestia-radius);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
      font-size: 13px;
    }

    .step__action--primary:hover { background: var(--gestia-navy-soft); text-decoration: none; }

    .step__no-access { flex: none; color: var(--gestia-muted); font-size: 11.5px; }
  `,
})
export class SetupStep {
  readonly step = input.required<OverviewSetupStep>();
  readonly counts = input.required<OverviewSetupCounts>();
  readonly state = input.required<SetupStepState>();

  protected readonly title = computed(() => setupStepTitle(this.step().key));
  protected readonly detail = computed(() => setupStepDetail(this.step(), this.counts()));
  protected readonly blocked = computed(() => setupStepBlockedBy(this.step()));
  protected readonly actionLabel = computed(() => setupStepAction(this.step()));
}
