import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * Una sección plegable.
 *
 * <p><b>Existe porque una ficha larga no se arregla apretando márgenes.</b> El panel de Personal
 * tenía cuatro bloques abiertos a la vez —identificación, puesto, domicilio y relación laboral— y
 * lo que se venía a ver quedaba debajo del pliegue. Reducir el relleno habría acercado los campos
 * sin acercar el dato: el problema era cuántos bloques compiten por la pantalla, no cuánto aire
 * hay entre ellos.</p>
 *
 * <p><b>El rótulo lleva su resumen, y eso es lo que la hace usable plegada.</b> Una sección
 * cerrada que sólo dice «Domicilio» obliga a abrirla para saber si hay algo dentro. Diciendo
 * «Domicilio · Mérida, Yucatán» se contesta la pregunta sin abrir, que es justo lo que se gana al
 * plegar.</p>
 *
 * <p>Se abre y se cierra con el ratón y con el teclado, porque el rótulo es un <c>button</c> de
 * verdad y no un <c>div</c> con un manejador. El cuerpo se quita del árbol al cerrarse —no se
 * esconde con CSS— para que lo que hay dentro no siga en el orden de tabulación.</p>
 */
@Component({
  selector: 'gi-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="acc" [class.acc--open]="abierto()">
      <h3 class="acc__head">
        <button
          type="button"
          class="acc__toggle"
          [attr.aria-expanded]="abierto()"
          [attr.aria-controls]="cuerpoId"
          (click)="alternar()"
        >
          <span class="acc__chevron" aria-hidden="true"></span>

          <span class="acc__label">{{ label() }}</span>

          @if (count() !== null) {
            <span class="acc__count">{{ count() }}</span>
          }

          <!--
            El resumen sólo cuando está cerrada: abierta, repetiria lo que ya se ve debajo.
          -->
          @if (!abierto() && summary()) {
            <span class="acc__summary">{{ summary() }}</span>
          }

          @if (tone() !== 'neutral') {
            <span class="acc__pill" [class]="'acc__pill--' + tone()">{{ toneLabel() }}</span>
          }
        </button>
      </h3>

      @if (abierto()) {
        <div class="acc__body" [id]="cuerpoId">
          <ng-content />
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .acc {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      min-width: 0;
    }

    .acc__head { margin: 0; }

    .acc__toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.5rem 0.7rem;
      border: 0;
      border-radius: var(--gestia-radius);
      background: none;
      color: var(--gestia-text);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      min-width: 0;
    }

    .acc__toggle:hover { background: var(--gestia-surface-soft); }
    .acc__toggle:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: -2px; }

    /* El triangulo se dibuja con bordes: sin librerias de iconos, y gira al abrir. */
    .acc__chevron {
      flex: 0 0 auto;
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 5px solid var(--gestia-muted);
      transition: transform 120ms ease;
    }

    .acc--open .acc__chevron { transform: rotate(90deg); }

    .acc__label { flex: 0 0 auto; }

    .acc__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      min-width: 1.15rem;
      padding: 0 0.25rem;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-surface-soft);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    /* El resumen cede el ancho: es lo que se recorta cuando la fila no cabe, no el rotulo. */
    .acc__summary {
      flex: 1 1 auto;
      color: var(--gestia-muted);
      font-size: 11.5px;
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .acc__pill {
      flex: 0 0 auto;
      margin-left: auto;
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .acc__pill--danger { border-color: var(--gestia-danger); color: var(--gestia-danger); }
    .acc__pill--warning { border-color: var(--gestia-warning); color: var(--gestia-warning); }
    .acc__pill--success { border-color: var(--gestia-success); color: var(--gestia-success); }

    .acc__body {
      padding: 0.15rem 0.7rem 0.7rem;
      border-top: 1px solid var(--gestia-border);
      margin-top: 0.1rem;
      padding-top: 0.7rem;
      min-width: 0;
    }
  `,
})
export class GiAccordion {
  readonly label = input.required<string>();

  /** El contador del rótulo. Nulo cuando la sección no cuenta nada. */
  readonly count = input<number | null>(null);

  /** Lo que se lee sin abrir: «Mérida, Yucatán», «3 de 4 al día». */
  readonly summary = input('');

  /** Si arranca abierta. La identificación de un registro sí; el resto, no. */
  readonly open = input(false);

  readonly tone = input<'neutral' | 'success' | 'warning' | 'danger'>('neutral');

  /** La palabra de la píldora. El tono nunca es lo único que lo dice. */
  readonly toneLabel = input('');

  readonly openChange = output<boolean>();

  private readonly manual = signal<boolean | null>(null);

  /**
   * Lo que manda es la última decisión del usuario; si no ha tocado nada, lo que diga la pantalla.
   *
   * <p>Así una sección que se abre sola porque tiene algo urgente —un documento vencido— se puede
   * cerrar, y no vuelve a abrirse en el siguiente ciclo de detección de cambios.</p>
   */
  protected readonly abierto = computed(() => this.manual() ?? this.open());

  protected readonly cuerpoId = `acc-${Math.random().toString(36).slice(2, 10)}`;

  protected alternar(): void {
    const siguiente = !this.abierto();
    this.manual.set(siguiente);
    this.openChange.emit(siguiente);
  }
}
