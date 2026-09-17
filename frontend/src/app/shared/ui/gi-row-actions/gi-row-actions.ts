import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { devAssert } from '../dev-assert';

export type GiRowAction = {
  readonly id: string;
  readonly label: string;
  /** Va separada del resto y en `--gestia-danger`. Sólo una por menú. */
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  /** Por qué no se puede. **Obligatoria cuando está inhabilitada.** */
  readonly disabledReason?: string;
};

let instancias = 0;

/**
 * Acciones de una fila.
 *
 * <b>Un menú al final de la fila, nunca enlaces sueltos.</b> Tres o cuatro verbos repartidos por
 * la fila compiten con los datos y crecen sin control en cuanto un módulo suma una acción más; un
 * menú ocupa siempre lo mismo y ordena lo que hay dentro.
 *
 * <p><b>La destructiva va separada</b> por una línea, y en <c>--gestia-danger</c>: desactivar algo
 * no puede quedar a un píxel de editarlo.</p>
 *
 * <p>Una acción inhabilitada <b>lleva escrita la razón</b>. Es la misma regla del botón primario
 * apagado: un menú con una opción gris y sin explicación deja al usuario adivinando qué le falta.</p>
 */
@Component({
  selector: 'gi-row-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown)': 'alTeclado($event)',
    '(focusout)': 'alSalirElFoco($event)',
  },
  template: `
    <button
      #disparador
      class="gi-actions__trigger"
      type="button"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="abierto()"
      [attr.aria-controls]="menuId"
      aria-haspopup="menu"
      (click)="alternar()"
    >
      <span aria-hidden="true">⋯</span>
    </button>

    <!--
      El menú va en la capa superior del navegador, con «popover», y no dentro del flujo de la
      fila. La razón es concreta: la tabla vive en un contenedor con «overflow-x: auto», y en CSS
      eso obliga al eje vertical a «auto» también, así que el menú quedaba **recortado** por el
      borde de la tabla. No era el z-index —el menú ya iba por encima—, era el recorte.
    -->
    @if (abierto()) {
      <ul
        #menu
        class="gi-actions__menu"
        popover="manual"
        [id]="menuId"
        role="menu"
        [attr.aria-label]="label()"
      >
        @for (accion of normales(); track accion.id; let i = $index) {
          <li role="none">
            <button
              class="gi-actions__item"
              type="button"
              role="menuitem"
              [id]="opcionId(i)"
              [disabled]="!!accion.disabled"
              (mousedown)="$event.preventDefault()"
              (click)="ejecutar(accion)"
              (mouseenter)="activa.set(i)"
              [class.is-active]="i === activa()"
            >
              <span>{{ accion.label }}</span>
              @if (accion.disabled && accion.disabledReason) {
                <small class="gi-actions__reason">{{ accion.disabledReason }}</small>
              }
            </button>
          </li>
        }

        @if (destructiva(); as ultima) {
          <li role="separator" class="gi-actions__separator"></li>
          <li role="none">
            <button
              class="gi-actions__item is-destructive"
              type="button"
              role="menuitem"
              [id]="opcionId(normales().length)"
              [disabled]="!!ultima.disabled"
              (mousedown)="$event.preventDefault()"
              (click)="ejecutar(ultima)"
              (mouseenter)="activa.set(normales().length)"
              [class.is-active]="normales().length === activa()"
            >
              <span>{{ ultima.label }}</span>
              @if (ultima.disabled && ultima.disabledReason) {
                <small class="gi-actions__reason">{{ ultima.disabledReason }}</small>
              }
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; }

    .gi-actions__trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--gestia-control-height);
      height: var(--gestia-control-height);
      border: 1px solid transparent;
      border-radius: var(--gestia-radius);
      background: transparent;
      color: var(--gestia-muted);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .gi-actions__trigger:hover { border-color: var(--gestia-border); color: var(--gestia-text); }
    .gi-actions__trigger:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .gi-actions__menu {
      /* Colocado a mano al abrir, en coordenadas de ventana: ver «mostrar». */
      position: fixed;
      z-index: 30;
      min-width: 12rem;
      margin: 0;
      padding: 0.25rem;
      overflow: visible;
      list-style: none;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-actions__item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.1rem;
      width: 100%;
      padding: 0.45rem 0.6rem;
      border: 0;
      border-radius: var(--gestia-radius);
      background: transparent;
      color: var(--gestia-text);
      font: inherit;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
    }

    .gi-actions__item.is-active:not(:disabled) { background: var(--gestia-cyan-soft); }
    .gi-actions__item:disabled { color: var(--gestia-muted); cursor: not-allowed; }
    .gi-actions__item.is-destructive { color: var(--gestia-danger); }
    .gi-actions__item.is-destructive:disabled { color: var(--gestia-muted); }

    .gi-actions__reason { color: var(--gestia-muted); font-size: 11px; font-weight: 400; }

    .gi-actions__separator {
      height: 1px;
      margin: 0.25rem 0;
      background: var(--gestia-border);
    }
  `,
})
export class GiRowActions implements OnInit {
  readonly actions = input.required<readonly GiRowAction[]>();
  /** Nombre accesible del menú. Un botón de sólo icono no tiene de dónde sacarlo. */
  readonly label = input('Acciones de la fila');
  readonly select = output<GiRowAction>();

  protected readonly abierto = signal(false);
  protected readonly activa = signal(0);
  protected readonly menuId = `gi-row-actions-${++instancias}`;
  private readonly disparador = viewChild.required<ElementRef<HTMLButtonElement>>('disparador');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  constructor() {
    // El menú sólo existe mientras está abierto, así que se coloca en cuanto aparece.
    effect(() => {
      const elemento = this.menu()?.nativeElement;
      if (elemento) {
        this.mostrar(elemento);
      }
    });
  }

  /**
   * Coloca el menú bajo el disparador, en coordenadas de ventana.
   *
   * <p>Al estar en la capa superior ya no hereda la posición de la fila, así que hay que dársela.
   * Se alinea por la derecha con el disparador, y si no cabe hacia abajo se abre hacia arriba: un
   * menú que se sale de la pantalla es tan inútil como uno recortado.</p>
   */
  private mostrar(elemento: HTMLElement): void {
    // `showPopover` no existe en jsdom, donde corren las pruebas. Sin capa superior el menú sigue
    // funcionando; sólo vuelve a estar sujeto al recorte, que en una prueba no importa.
    if (typeof elemento.showPopover === 'function' && !elemento.matches(':popover-open')) {
      elemento.showPopover();
    }

    const ancla = this.disparador().nativeElement.getBoundingClientRect();
    const alto = elemento.offsetHeight;
    const cabeDebajo = ancla.bottom + alto + 8 <= window.innerHeight;

    elemento.style.left = `${Math.max(8, ancla.right - elemento.offsetWidth)}px`;
    elemento.style.top = cabeDebajo
      ? `${ancla.bottom + 4}px`
      : `${Math.max(8, ancla.top - alto - 4)}px`;
  }

  protected readonly normales = computed(() => this.actions().filter((accion) => !accion.destructive));
  protected readonly destructiva = computed(() => this.actions().find((accion) => accion.destructive) ?? null);
  /** El orden real del menú: las normales y, al final, la destructiva. */
  protected readonly ordenadas = computed(() => {
    const ultima = this.destructiva();
    return ultima ? [...this.normales(), ultima] : this.normales();
  });

  ngOnInit(): void {
    const inhabilitadaSinRazon = this.actions().find(
      (accion) => accion.disabled && !accion.disabledReason?.trim(),
    );
    devAssert(
      !inhabilitadaSinRazon,
      `gi-row-actions: la acción "${inhabilitadaSinRazon?.label}" está inhabilitada y no dice por ` +
        'qué. Una opción gris sin explicación deja al usuario adivinando qué le falta.',
    );

    devAssert(
      this.actions().filter((accion) => accion.destructive).length <= 1,
      'gi-row-actions: sólo puede haber una acción destructiva. Si hay dos, la separación deja de ' +
        'distinguir cuál es la peligrosa.',
    );
  }

  protected opcionId(indice: number) {
    return `${this.menuId}-opcion-${indice}`;
  }

  protected alternar() {
    if (this.abierto()) {
      this.cerrar();
      return;
    }

    this.activa.set(0);
    this.abierto.set(true);
  }

  protected ejecutar(accion: GiRowAction) {
    if (accion.disabled) {
      return;
    }

    this.select.emit(accion);
    this.cerrar();
  }

  protected cerrar() {
    const elemento = this.menu()?.nativeElement;
    if (elemento && typeof elemento.hidePopover === 'function' && elemento.matches(':popover-open')) {
      elemento.hidePopover();
    }

    this.abierto.set(false);
    this.disparador().nativeElement.focus();
  }

  protected alTeclado(event: KeyboardEvent) {
    const total = this.ordenadas().length;

    if (!this.abierto()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.alternar();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.cerrar();
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (total) this.activa.set((this.activa() + 1) % total);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (total) this.activa.set((this.activa() - 1 + total) % total);
        break;
      case 'Home':
        event.preventDefault();
        this.activa.set(0);
        break;
      case 'End':
        event.preventDefault();
        this.activa.set(Math.max(0, total - 1));
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const accion = this.ordenadas()[this.activa()];
        if (accion) this.ejecutar(accion);
        break;
      }
      case 'Tab':
        this.abierto.set(false);
        break;
      default:
        break;
    }
  }

  /** Salir del componente cubre el clic fuera y el salto con Tab por un solo camino. */
  protected alSalirElFoco(event: FocusEvent) {
    const siguiente = event.relatedTarget as Node | null;
    const anfitrion = this.disparador().nativeElement.parentElement;

    if (!siguiente || !anfitrion?.contains(siguiente)) {
      this.abierto.set(false);
    }
  }
}
