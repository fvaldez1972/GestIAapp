import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';

/**
 * Selector de archivo.
 *
 * <p><b>Existe porque el control nativo no se puede traducir.</b> Un <c>&lt;input type="file"&gt;</c>
 * dibuja su botón y su leyenda —«Choose File», «No file chosen»— con texto del navegador, no del
 * documento: no hay atributo que lo cambie y el idioma lo decide el sistema operativo de quien
 * mira. En una aplicación en español eso aparecía en inglés en medio de un formulario.</p>
 *
 * <p>La solución es la de siempre con este control: el nativo sigue ahí, invisible y accesible, y
 * lo que se ve es una etiqueta propia. El nativo no se sustituye por un botón falso porque
 * entonces se pierde el teclado, el lector de pantalla y el diálogo del sistema.</p>
 */
@Component({
  selector: 'gi-file-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="gi-file" [class.is-disabled]="disabled()">
      <span class="gi-file__label">{{ label() }}</span>

      <span class="gi-file__control">
        <input
          #campo
          class="gi-file__native"
          type="file"
          [accept]="accept()"
          [disabled]="disabled()"
          [attr.aria-label]="label()"
          (change)="elegir($event)"
        />
        <span class="gi-file__button" aria-hidden="true">Elegir archivo</span>
        <span class="gi-file__name">{{ nombreVisible() }}</span>
      </span>

      @if (hint(); as ayuda) {
        <small class="gi-file__hint">{{ ayuda }}</small>
      }
    </label>
  `,
  styles: `
    :host { display: block; }

    .gi-file { display: flex; flex-direction: column; gap: 0.25rem; }

    .gi-file__label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .gi-file__control {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      min-height: var(--gestia-control-height);
      padding: 0 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    /*
      Invisible, no ausente: sigue recibiendo el foco, el teclado y el lector de pantalla, y es
      quien abre el diálogo del sistema al pulsar la etiqueta.
    */
    .gi-file__native {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .gi-file__native:disabled { cursor: not-allowed; }

    .gi-file__button {
      flex: 0 0 auto;
      padding: 0.2rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
      color: var(--gestia-text);
      font-size: 12px;
      font-weight: 600;
    }

    .gi-file__name {
      overflow: hidden;
      color: var(--gestia-muted);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gi-file__hint { color: var(--gestia-muted); font-size: 11px; }

    .gi-file.is-disabled .gi-file__control { background: var(--gestia-surface-soft); }

    .gi-file__native:focus-visible + .gi-file__button { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
  `,
})
export class GiFileInput {
  readonly label = input.required<string>();
  readonly accept = input('');
  readonly disabled = input(false);
  readonly hint = input('');

  /** Qué decir cuando no hay archivo. Cada pantalla sabe qué está pidiendo. */
  readonly emptyLabel = input('Ningún archivo seleccionado');

  readonly fileSelected = output<File | null>();

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private readonly nombre = signal('');

  protected readonly nombreVisible = computed(() => this.nombre() || this.emptyLabel());

  protected elegir(event: Event): void {
    const archivo = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.nombre.set(archivo?.name ?? '');
    this.fileSelected.emit(archivo);
  }

  /** Deja el control como recién abierto. La pantalla lo llama tras guardar. */
  reset(): void {
    this.nombre.set('');
    const elemento = this.campo()?.nativeElement;
    if (elemento) {
      elemento.value = '';
    }
  }
}
