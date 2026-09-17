import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export type GiSelectOption = {
  readonly value: string;
  readonly label: string;
  /** Segunda línea opcional: un código, un identificador corto, lo que desempate dos nombres. */
  readonly hint?: string;
};

/** Contador de instancias: los identificadores que enlazan `aria-controls` y
 *  `aria-activedescendant` tienen que ser únicos en el documento. */
let instances = 0;

/**
 * Selector propio de GestIA.
 *
 * Existe porque el `<select>` nativo no se puede vestir: en Windows y en Android el sistema dibuja
 * la lista con su propia tipografía y sus propios colores, y la aplicación pierde la identidad
 * justo en el control que más se usa. El requisito es explícito: selectores con estilo propio,
 * nunca el nativo del sistema.
 *
 * Reemplazar un control nativo obliga a reponer a mano lo que traía gratis, así que aquí está todo
 * lo que el navegador ya no pone: rol `combobox` con `aria-expanded` y `aria-controls`, lista con
 * rol `listbox` y opción activa anunciada por `aria-activedescendant`, teclado completo (flechas,
 * Inicio, Fin, Enter, Espacio, Escape, Tab), foco visible y cierre al hacer clic fuera.
 *
 * Portado de INSPINIA 5 (patrón de menú desplegable de la topbar), adaptado a Angular 22 con
 * señales y sin Preline: la plantilla comercial resuelve el desplegable con esa librería, que no
 * entra al repositorio. Registrado en `docs/integrations/inspinia-5.md`.
 */
@Component({
  selector: 'gi-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown)': 'onKeydown($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="gi-select__trigger"
      role="combobox"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="listId"
      [attr.aria-activedescendant]="open() ? optionId(activeIndex()) : null"
      aria-haspopup="listbox"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <span class="gi-select__value" [class.is-empty]="!selected()">{{ selected()?.label ?? placeholder() }}</span>
      <span class="gi-select__caret" aria-hidden="true"></span>
    </button>

    @if (open()) {
      <ul class="gi-select__list" [id]="listId" role="listbox" [attr.aria-label]="label()">
        @if (!options().length) {
          <li class="gi-select__empty" role="presentation">Sin opciones disponibles</li>
        }
        @for (option of options(); track option.value; let i = $index) {
          <li
            class="gi-select__option"
            [id]="optionId(i)"
            role="option"
            [class.is-active]="i === activeIndex()"
            [attr.aria-selected]="option.value === value()"
            (mousedown)="$event.preventDefault()"
            (click)="choose(option)"
            (mouseenter)="activeIndex.set(i)"
          >
            <span class="gi-select__option-label">{{ option.label }}</span>
            @if (option.hint) { <span class="gi-select__option-hint">{{ option.hint }}</span> }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
      min-width: 0;
    }

    .gi-select__trigger {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      min-height: var(--gestia-control-height);
      padding: 0 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .gi-select__trigger:hover:not(:disabled) { border-color: var(--gestia-cyan-dark); }
    .gi-select__trigger:disabled { cursor: not-allowed; opacity: 0.6; }

    /* Foco visible en cian, como pide el sistema. Va con :focus-visible para no marcar el clic
       del ratón, y con outline en vez de borde para no mover la caja al enfocar. */
    .gi-select__trigger:focus-visible {
      outline: 2px solid var(--gestia-cyan);
      outline-offset: 2px;
    }

    .gi-select__value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gi-select__value.is-empty { color: var(--gestia-muted); }

    .gi-select__caret {
      flex: none;
      width: 0.5rem;
      height: 0.5rem;
      border-right: 1.5px solid var(--gestia-muted);
      border-bottom: 1.5px solid var(--gestia-muted);
      transform: translateY(-2px) rotate(45deg);
    }

    .gi-select__list {
      position: absolute;
      z-index: 40;
      top: calc(100% + 0.25rem);
      left: 0;
      right: 0;
      min-width: 100%;
      max-height: 16rem;
      overflow-y: auto;
      margin: 0;
      padding: 0.25rem;
      list-style: none;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-select__option {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.45rem 0.6rem;
      border-radius: var(--gestia-radius);
      cursor: pointer;
    }

    .gi-select__option.is-active { background: var(--gestia-cyan-soft); }
    .gi-select__option[aria-selected='true'] .gi-select__option-label { font-weight: 600; }
    .gi-select__option-hint { color: var(--gestia-muted); font-size: 12px; }

    .gi-select__empty {
      padding: 0.45rem 0.6rem;
      color: var(--gestia-muted);
    }
  `,
})
export class GiSelect {
  /**
   * Nombre accesible del control. Es obligatorio: sin `<label>` nativo que lo nombre, un
   * desplegable propio no tiene de dónde sacarlo, y quien navega con lector de pantalla oye
   * "botón" sin más.
   */
  readonly label = input.required<string>();
  readonly options = input.required<readonly GiSelectOption[]>();
  readonly value = input('');
  readonly placeholder = input('Selecciona una opción');
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  /**
   * Se emite al desplegar la lista, no al elegir.
   *
   * <p>Existe para que quien pinta las opciones pueda refrescarlas en ese momento. Una lista que se
   * carga una sola vez, al arrancar, queda vieja en cuanto alguien da de alta algo nuevo —desde
   * otra pantalla, desde otra sesion— y el usuario no tiene forma de saber que lo que ve ya no es
   * lo que hay. Abrir el desplegable es justo el instante en que se va a leer.</p>
   */
  readonly opened = output<void>();

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly listId = `gi-select-list-${++instances}`;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly selected = computed(() =>
    this.options().find((option) => option.value === this.value()) ?? null,
  );

  protected optionId(index: number) {
    return `${this.listId}-option-${index}`;
  }

  protected toggle() {
    if (this.open()) {
      this.close();
      return;
    }

    const current = this.options().findIndex((option) => option.value === this.value());
    this.activeIndex.set(current >= 0 ? current : 0);
    this.open.set(true);
    this.opened.emit();
  }

  protected choose(option: GiSelectOption) {
    this.valueChange.emit(option.value);
    this.close();
  }

  protected close() {
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  /**
   * El teclado completo. Un `<select>` nativo trae esto de fábrica; al sustituirlo hay que
   * reponerlo, porque para quien no usa ratón es la única forma de operar el control.
   */
  protected onKeydown(event: KeyboardEvent) {
    if (this.disabled()) {
      return;
    }

    const total = this.options().length;

    if (!this.open()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggle();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (total) this.activeIndex.set((this.activeIndex() + 1) % total);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (total) this.activeIndex.set((this.activeIndex() - 1 + total) % total);
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex.set(0);
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex.set(Math.max(0, total - 1));
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = this.options()[this.activeIndex()];
        if (option) this.choose(option);
        break;
      }
      case 'Tab':
        // Tab sale del control: se cierra sin elegir y sin robarle el foco al siguiente campo.
        this.open.set(false);
        break;
      default:
        break;
    }
  }

  /** Cerrar al salir del componente cubre el clic fuera y el salto con Tab con un solo camino. */
  protected onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    const host = this.trigger().nativeElement.parentElement;

    if (!next || !host?.contains(next)) {
      this.open.set(false);
    }
  }
}
