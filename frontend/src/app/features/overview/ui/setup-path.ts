import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import {
  Overview,
  OverviewSetupStep,
  SetupDensity,
  setupDensity,
} from '../data-access/overview.models';
import { SetupStep, SetupStepState } from './setup-step';

/**
 * El camino de configuración.
 *
 * <p><b>Las tres proporciones son una estructura, no tres pantallas.</b> Los siete pasos existen
 * siempre y con el mismo texto; lo que cambia es cuánto ocupan. Cuando la configuración se
 * completa, el camino <b>se cierra, no se borra</b>: queda en una línea que se vuelve a abrir.</p>
 *
 * <p>La densidad sale del conteo de pasos hechos, nunca de una preferencia. Si alguien desactiva
 * su único servicio, un paso deja de estar hecho y el camino vuelve a crecer solo. Lo único que se
 * recuerda —por organización, en <c>sessionStorage</c>, como la preferencia del menú— es si el
 * usuario abrió a mano la línea cerrada.</p>
 */
@Component({
  selector: 'app-setup-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupStep],
  template: `
    <section class="path" [class]="'path--' + density()" [attr.aria-label]="'Camino de configuración'">
      @if (density() === 'line') {
        <p class="path__line">
          <span class="path__check" aria-hidden="true">✓</span>
          <span class="path__complete">Configuración completa</span>
          <span class="path__summary">
            {{ setup().completedSteps }} de {{ setup().totalSteps }} pasos · la operación diaria ya
            está en marcha
          </span>
          <button
            class="path__toggle"
            type="button"
            [attr.aria-expanded]="opened()"
            aria-controls="camino-pasos"
            (click)="toggle()"
          >{{ opened() ? 'Ocultar configuración' : 'Revisar configuración' }}</button>
        </p>
      } @else {
        <p class="path__header">
          <span class="path__kicker">CAMINO DE CONFIGURACIÓN</span>
          <span class="path__progress">
            <span class="path__bars" aria-hidden="true">
              @for (step of steps(); track step.key) {
                <span class="path__bar" [class.path__bar--done]="step.done"></span>
              }
            </span>
            <span class="path__count">{{ setup().completedSteps }} de {{ setup().totalSteps }} pasos</span>
          </span>
        </p>
      }

      <!--
        Los siete van siempre en el marcado, también con el camino cerrado. Volver a construirlos
        al abrir sería tener tres listas distintas que se pueden desincronizar; aquí sólo se
        esconden.
      -->
      <ol class="path__steps" id="camino-pasos" [hidden]="density() === 'line' && !opened()">
        @for (step of steps(); track step.key) {
          <app-setup-step [step]="step" [counts]="setup().counts" [state]="stateOf(step)" />
        }
      </ol>
    </section>
  `,
  styles: `
    :host { display: block; }

    .path {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .path__header,
    .path__line {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0;
      padding: 0.7rem var(--gestia-card-padding);
      background: var(--gestia-surface-soft);
      border-bottom: 1px solid var(--gestia-border);
    }

    /* Con el camino cerrado la línea es toda la tarjeta: sin borde inferior que sugiera que hay
       algo debajo cuando no se ha abierto. */
    .path--line .path__line { background: var(--gestia-surface); border-bottom: 0; }
    .path--line .path__steps { border-top: 1px solid var(--gestia-border); }

    .path__kicker {
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.07em;
    }

    .path__progress { display: flex; align-items: center; gap: 0.6rem; margin-left: auto; }

    .path__bars { display: flex; gap: 3px; }

    .path__bar {
      width: 30px;
      height: 6px;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-border);
    }

    .path__bar--done { background: var(--gestia-cyan); }

    .path__count { color: var(--gestia-text); font-size: 12px; font-weight: 600; }

    .path__check {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border: 1px solid var(--gestia-success);
      border-radius: var(--gestia-radius);
      color: var(--gestia-success);
      font-size: 11px;
      font-weight: 600;
    }

    .path__complete { color: var(--gestia-text); font-size: 13px; font-weight: 600; }

    .path__summary { color: var(--gestia-muted); font-size: 12px; }

    .path__toggle {
      margin-left: auto;
      border: 0;
      background: transparent;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .path__toggle:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .path__steps { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
  `,
})
export class SetupPath {
  readonly overview = input.required<Overview>();
  readonly organizationId = input('');

  /**
   * Si la línea está abierta. Se reinicia al cambiar de organización, y su valor inicial es lo que
   * el usuario dejó la última vez en ésta.
   */
  protected readonly opened = linkedSignal<string, boolean>({
    source: () => this.organizationId(),
    computation: (organizationId) => this.remembered(organizationId),
  });

  protected readonly setup = computed(() => this.overview().setup);
  protected readonly steps = computed(() => this.setup().steps);

  protected readonly density = computed<SetupDensity>(() =>
    setupDensity(this.setup().completedSteps, this.setup().totalSteps),
  );

  /**
   * El primer paso pendiente y sin dependencias: el que se puede empezar ahora mismo. Sólo hay
   * uno destacado, porque destacar cuatro es no destacar ninguno.
   */
  private readonly currentKey = computed(
    () => this.steps().find((step) => !step.done && step.blockedBy.length === 0)?.key,
  );

  protected stateOf(step: OverviewSetupStep): SetupStepState {
    if (step.done) {
      return 'done';
    }

    if (step.key === this.currentKey()) {
      return 'current';
    }

    return step.blockedBy.length > 0 ? 'blocked' : 'available';
  }

  protected toggle(): void {
    const next = !this.opened();
    this.opened.set(next);
    this.remember(next);
  }

  private static storageKey(organizationId: string): string {
    return `gestia.overview.setupOpen.${organizationId}`;
  }

  /**
   * La preferencia sobrevive a una recarga pero no a cerrar el navegador, igual que la del menú.
   * Va envuelta porque una ventana privada o un navegador con datos de sitio bloqueados hace que
   * el simple acceso lance, y la portada no puede caerse por eso.
   */
  private remembered(organizationId: string): boolean {
    try {
      return sessionStorage.getItem(SetupPath.storageKey(organizationId)) === 'true';
    } catch {
      return false;
    }
  }

  private remember(value: boolean): void {
    try {
      sessionStorage.setItem(SetupPath.storageKey(this.organizationId()), String(value));
    } catch {
      // Sin almacenamiento la línea sigue abriéndose; sólo no se recuerda.
    }
  }
}
