import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * Confirmación de una acción destructiva.
 *
 * <p><b>Nombra qué se va a desactivar y explica la consecuencia antes de preguntar.</b> Un
 * «¿Estás seguro?» no dice qué se pierde ni qué deja de funcionar, así que se contesta que sí sin
 * leerlo.</p>
 *
 * <p><b>Cancelar es la acción por omisión y recibe el foco al abrir</b>, y el botón destructivo no
 * queda junto al primario: quien confirma sin mirar acierta, y quien confirma de verdad tiene que
 * moverse a propósito.</p>
 *
 * <p>Usa el <c>&lt;dialog&gt;</c> nativo, que trae el foco atrapado, el orden de lectura y Escape
 * sin ninguna librería. El velo es <c>--gestia-dialog-veil</c>, el único valor derivado de un
 * token que el sistema autoriza.</p>
 */
@Component({
  selector: 'gi-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialogo class="gi-confirm" aria-labelledby="gi-confirm-title" (close)="cancel.emit()">
      <h2 class="gi-confirm__title" id="gi-confirm-title">{{ title() }}</h2>

      <p class="gi-confirm__subject">{{ subject() }}</p>
      <p class="gi-confirm__consequence">{{ consequence() }}</p>

      <div class="gi-confirm__actions">
        <button #cancelar class="gi-confirm__cancel" type="button" (click)="cancel.emit()">
          {{ cancelLabel() }}
        </button>
        <span class="gi-confirm__gap" aria-hidden="true"></span>
        <button class="gi-confirm__confirm" type="button" (click)="confirm.emit()">
          {{ confirmLabel() }}
        </button>
      </div>
    </dialog>
  `,
  styles: `
    .gi-confirm {
      width: min(28rem, calc(100vw - 2rem));
      padding: 1.1rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    /* El único valor derivado de un token en todo el sistema. Ni negro, ni gris, ni otra opacidad. */
    .gi-confirm::backdrop { background: var(--gestia-dialog-veil); }

    .gi-confirm__title {
      margin: 0 0 0.5rem;
      color: var(--gestia-navy);
      font-size: 13px;
      font-weight: 700;
    }

    .gi-confirm__subject {
      margin: 0 0 0.35rem;
      font-size: 12.5px;
      font-weight: 600;
    }

    .gi-confirm__consequence {
      margin: 0 0 1rem;
      color: var(--gestia-muted);
      font-size: 12px;
      font-weight: 400;
    }

    .gi-confirm__actions { display: flex; align-items: center; }

    /* La separación no es estética: el destructivo no puede quedar a un píxel del que se pulsa
       sin mirar. */
    .gi-confirm__gap { flex: 1; min-width: 3rem; }

    .gi-confirm__cancel,
    .gi-confirm__confirm {
      min-height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border-radius: var(--gestia-radius);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-confirm__cancel {
      border: 1px solid var(--gestia-border);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    .gi-confirm__confirm {
      border: 1px solid var(--gestia-danger);
      background: var(--gestia-surface);
      color: var(--gestia-danger);
    }

    .gi-confirm__confirm:hover { background: var(--gestia-danger); color: var(--gestia-surface); }

    .gi-confirm__cancel:focus-visible,
    .gi-confirm__confirm:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
  `,
})
export class GiConfirmDialog {
  readonly open = input(false);
  readonly title = input('Confirmar desactivación');
  /** Qué se desactiva, con su nombre. No «este registro». */
  readonly subject = input.required<string>();
  /** Qué deja de funcionar. Es lo que se lee antes de contestar. */
  readonly consequence = input.required<string>();
  readonly confirmLabel = input('Desactivar');
  readonly cancelLabel = input('Cancelar');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly cancelar = viewChild<ElementRef<HTMLButtonElement>>('cancelar');

  constructor() {
    effect(() => {
      const elemento = this.dialogo().nativeElement;

      if (this.open() && !elemento.open) {
        elemento.showModal();
        // Cancelar es la acción por omisión: quien pulsa Enter sin leer, cancela.
        this.cancelar()?.nativeElement.focus();
      } else if (!this.open() && elemento.open) {
        elemento.close();
      }
    });
  }
}
