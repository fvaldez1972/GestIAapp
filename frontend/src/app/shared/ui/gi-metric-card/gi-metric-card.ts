import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { devAssert } from '../dev-assert';

/**
 * Los estados del indicador. **`ready` con valor 0 y `pending` no son lo mismo**, y distinguirlos
 * es la razón de ser del componente.
 */
export type GiMetricState = 'ready' | 'loading' | 'pending';

/**
 * Cómo se lee el número.
 *
 * <p>Nunca es lo único que lo dice: el tono siempre viaja con una píldora que lleva la palabra
 * dentro, porque un color no se lee en escala de grises ni con daltonismo.</p>
 */
export type GiMetricTone = 'neutral' | 'success' | 'warning' | 'danger';

/**
 * Tarjeta de indicador.
 *
 * <p><b>Un cero real y un «sin datos aún» dicen cosas opuestas.</b> Cero significa que todo está
 * en orden: no hay incidencias abiertas, no hay coberturas pendientes. «Sin datos aún» significa
 * que el prerrequisito no existe —nadie ha publicado la planeación, no hay turnos que contar— y
 * que el número no se ha podido calcular.</p>
 *
 * <p>Mostrar el segundo como un cero es la peor confusión posible en un tablero: dice «todo bien»
 * cuando en realidad nadie ha hecho nada. Por eso `pending` pinta una raya en lugar del valor,
 * más una píldora con el texto y <b>la acción que lo resuelve</b>, y nunca depende sólo del
 * color.</p>
 */
@Component({
  selector: 'gi-metric-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="gi-metric" [attr.aria-busy]="state() === 'loading'">
      <p class="gi-metric__label">{{ label() }}</p>

      @switch (state()) {
        @case ('loading') {
          <span class="gi-metric__skeleton" aria-hidden="true"></span>
          <span class="gi-metric__announce" role="status">Cargando {{ label() }}…</span>
        }
        @case ('pending') {
          <p class="gi-metric__value gi-metric__value--pending" aria-hidden="true">—</p>
          <p class="gi-metric__pending">
            <span class="gi-metric__pill">{{ pendingLabel() }}</span>
            @if (pendingActionLabel()) {
              <button class="gi-metric__action" type="button" (click)="pendingAction.emit()">
                {{ pendingActionLabel() }}
              </button>
            }
          </p>
        }
        @default {
          <p class="gi-metric__ready">
            <span class="gi-metric__value" [class]="'gi-metric__value--' + tone()">{{ value() }}</span>
            @if (pillLabel()) {
              <span class="gi-metric__pill" [class]="'gi-metric__pill--' + tone()">
                @if (tone() === 'success') {
                  <span class="gi-metric__dot" aria-hidden="true"></span>
                }
                {{ pillLabel() }}
              </span>
            }
          </p>
        }
      }

      @if (hint() && state() !== 'pending') {
        <p class="gi-metric__hint">{{ hint() }}</p>
      }
    </article>
  `,
  styles: `
    :host { display: block; }

    .gi-metric {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.75rem 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-metric__label {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.07em;
    }

    /* El único 22 px de la aplicación junto al título de pantalla: un número que se lee como
       métrica y no como texto de tabla. */
    .gi-metric__value {
      margin: 0;
      color: var(--gestia-navy);
      font-size: 22px;
      font-weight: 600;
      line-height: 1.15;
    }

    .gi-metric__ready { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.45rem; margin: 0; }

    .gi-metric__value--pending,
    .gi-metric__value--neutral { color: var(--gestia-navy); }
    .gi-metric__value--success { color: var(--gestia-text); }
    .gi-metric__value--warning { color: var(--gestia-warning); }
    .gi-metric__value--danger { color: var(--gestia-danger); }

    .gi-metric__hint {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11.5px;
      font-weight: 400;
    }

    .gi-metric__pending { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin: 0.1rem 0 0; }

    /* Borde y texto en el token sobre la superficie: sin fondos derivados, y con la palabra
       dentro, para que el estado no dependa del color.

       Por omisión la píldora es neutra, que es la del «sin datos aún». Antes era ámbar, y decía
       algo falso: un dato que todavía no existe no es una advertencia, es un hueco. La advertencia
       la marca el tono, y sólo cuando el número existe. */
    .gi-metric__pill {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.1rem 0.35rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .gi-metric__pill--success { border-color: var(--gestia-success); color: var(--gestia-success); }
    .gi-metric__pill--warning { border-color: var(--gestia-warning); color: var(--gestia-warning); }
    .gi-metric__pill--danger { border-color: var(--gestia-danger); color: var(--gestia-danger); }

    .gi-metric__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentcolor;
    }

    .gi-metric__action {
      border: 0;
      background: transparent;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-metric__action:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .gi-metric__skeleton {
      display: block;
      width: 3.5rem;
      height: 22px;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-skeleton);
    }

    .gi-metric__announce {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class GiMetricCard implements OnInit {
  readonly label = input.required<string>();
  readonly value = input<number | string>(0);
  /** La línea que explica el número. Sin ella, un 12 no dice de qué. */
  readonly hint = input('');
  readonly state = input<GiMetricState>('ready');
  /** Cómo se lee el número. Sólo aplica cuando el número existe. */
  readonly tone = input<GiMetricTone>('neutral');
  /** La palabra que acompaña al número: «Vacante», «Todo cubierto». Va dentro, no al lado. */
  readonly pillLabel = input('');
  /** Qué falta. Se lee dentro de la píldora, no sólo por su color. */
  readonly pendingLabel = input('Sin datos aún');
  readonly pendingActionLabel = input('');
  readonly pendingAction = output<void>();

  ngOnInit(): void {
    devAssert(
      this.state() !== 'pending' || !!this.pendingActionLabel(),
      'gi-metric-card: el estado "pending" necesita la acción que lo resuelve. Decir que falta un ' +
        'dato sin decir cómo obtenerlo deja el tablero señalando un hueco que nadie sabe llenar.',
    );

    devAssert(
      !!this.hint() || this.state() === 'pending',
      `gi-metric-card: el indicador "${this.label()}" no lleva la línea que explica el número. Un ` +
        '22 px suelto es una cifra sin unidad ni alcance.',
    );
  }
}
