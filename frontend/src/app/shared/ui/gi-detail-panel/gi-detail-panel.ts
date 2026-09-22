import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  OnInit,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  output,
} from '@angular/core';
import { devAssert } from '../dev-assert';

export type GiTab = {
  readonly id: string;
  readonly label: string;
  /** Cuántos registros tiene. Evita abrir una pestaña para descubrir que está vacía. */
  readonly count?: number;
};

let instancias = 0;

/** Contenido de una pestaña: `<ng-template giTab="datos">`. */
@Directive({ selector: '[giTab]' })
export class GiTabContent {
  readonly giTab = input.required<string>();
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * Panel de detalle lateral.
 *
 * <p><b>620 px, a la derecha, y es una columna del contenido, no una capa encima.</b> La tabla se
 * comprime; no se tapa. Es la diferencia entre seguir viendo dónde estabas y perder la lista al
 * abrir un registro. Tampoco se apila debajo de la tabla.</p>
 *
 * <p><b>Lleva pestañas cuando hay varios destinos independientes.</b> Cuando es un solo propósito
 * con una continuación —el registro de asistencia, que sigue a incidencia— va sin pestañas y el
 * pie lleva al siguiente paso: dos pestañas donde la segunda es la consecuencia de la primera
 * ponen a elegir entre cosas que en realidad son una secuencia.</p>
 */
@Component({
  selector: 'gi-detail-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: { '(keydown)': 'alTeclado($event)' },
  template: `
    <aside class="gi-panel" role="region" [attr.aria-label]="title()">
      <header class="gi-panel__head">
        <div class="gi-panel__titles">
          <p class="gi-panel__title">{{ title() }}</p>
          @if (subtitle()) {
            <p class="gi-panel__subtitle">{{ subtitle() }}</p>
          }
        </div>
        <!--
          Acciones sobre el registro abierto, junto al titulo. Antes solo estaba la cruz y ese
          espacio quedaba vacio: la accion principal de la ficha —editarla— vivia escondida en el
          menu de la fila del listado, que es otro sitio y hay que cerrarla para llegar.
        -->
        <div class="gi-panel__acciones">
          <ng-content select="[panelActions]" />
          <button class="gi-panel__close" type="button" aria-label="Cerrar el detalle" (click)="close.emit()">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      @if (tabs().length) {
        <div class="gi-panel__tabs" role="tablist" [attr.aria-label]="title()">
          @for (tab of tabs(); track tab.id; let i = $index) {
            <button
              class="gi-panel__tab"
              type="button"
              role="tab"
              [id]="tabId(tab.id)"
              [attr.aria-selected]="tab.id === activa()"
              [attr.aria-controls]="panelId(tab.id)"
              [attr.tabindex]="tab.id === activa() ? 0 : -1"
              [class.is-active]="tab.id === activa()"
              (click)="tabChange.emit(tab.id)"
            >
              <span>{{ tab.label }}</span>
              @if (tab.count !== undefined) {
                <span class="gi-panel__count">{{ tab.count }}</span>
              }
            </button>
          }
        </div>
      }

      <div
        class="gi-panel__body"
        [attr.role]="tabs().length ? 'tabpanel' : null"
        [attr.id]="tabs().length ? panelId(activa()) : null"
        [attr.aria-labelledby]="tabs().length ? tabId(activa()) : null"
      >
        @if (contenido(); as plantilla) {
          <ng-container *ngTemplateOutlet="plantilla" />
        }
      </div>

      <footer class="gi-panel__foot">
        <ng-content select="[panelFooter]" />
      </footer>
    </aside>
  `,
  styles: `
    :host {
      display: block;
      flex: none;
      width: var(--gestia-panel-width);
      align-self: stretch;
    }

    .gi-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-panel__head {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 0.9rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .gi-panel__titles { flex: 1; min-width: 0; }

    .gi-panel__title {
      margin: 0;
      color: var(--gestia-navy);
      font-size: 13px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gi-panel__subtitle {
      margin: 0.1rem 0 0;
      color: var(--gestia-muted);
      font-size: 11.5px;
      font-weight: 400;
    }

    .gi-panel__acciones { display: flex; align-items: center; gap: 0.5rem; }

    .gi-panel__close {
      flex: none;
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

    .gi-panel__close:hover { border-color: var(--gestia-border); color: var(--gestia-text); }
    .gi-panel__close:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .gi-panel__tabs {
      display: flex;
      gap: 0.15rem;
      padding: 0 0.9rem;
      border-bottom: 1px solid var(--gestia-border);
      overflow-x: auto;
    }

    .gi-panel__tab {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.55rem 0.5rem;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--gestia-muted);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }

    /* La activa se marca con el cian **y** con aria-selected. */
    .gi-panel__tab.is-active { border-bottom-color: var(--gestia-cyan); color: var(--gestia-text); }
    .gi-panel__tab:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: -2px; }

    .gi-panel__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.15rem;
      padding: 0 0.25rem;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-surface-soft);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .gi-panel__body { flex: 1; overflow-y: auto; padding: 0.9rem; font-size: 12.5px; }

    .gi-panel__foot {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 0.75rem 0.9rem;
      border-top: 1px solid var(--gestia-border);
    }

    .gi-panel__foot:empty { display: none; }
  `,
})
export class GiDetailPanel implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  /** Vacío significa **sin pestañas**: un solo propósito, y el pie lleva al siguiente paso. */
  readonly tabs = input<readonly GiTab[]>([]);
  readonly activeTab = input('');

  readonly close = output<void>();
  readonly tabChange = output<string>();

  private readonly contenidos = contentChildren(GiTabContent);
  private readonly instancia = ++instancias;

  protected readonly activa = computed(() => this.activeTab() || this.tabs()[0]?.id || '');

  protected readonly contenido = computed(() => {
    const porId = new Map(this.contenidos().map((c) => [c.giTab(), c.template]));
    return porId.get(this.activa()) ?? porId.get('') ?? this.contenidos()[0]?.template ?? null;
  });

  protected tabId(id: string) {
    return `gi-panel-${this.instancia}-tab-${id}`;
  }

  protected panelId(id: string) {
    return `gi-panel-${this.instancia}-body-${id}`;
  }

  ngOnInit(): void {
    const primera = this.tabs()[0];

    // Un panel sin contenido es un panel roto, y hasta hoy se dibujaba en silencio.
    //
    // `<ng-template giTab="…">` sólo es una plantilla del panel si la pantalla importa
    // `GiTabContent`. Sin ese import el atributo queda inerte, `contentChildren` no encuentra
    // nada, y el panel se pinta con su cabecera y su «×» y **nada dentro**. Angular no protesta:
    // un `ng-template` con un atributo desconocido es legal.
    //
    // Pasó en Asistencia y en Incidencias: tres paneles —registrar asistencia, registrar
    // incidencia y cubrir un turno— abrían vacíos, y con ellos toda la captura del día operativo
    // era imposible. No lo delató ningún error: sólo una caja de 96 px de alto.
    devAssert(
      this.contenidos().length > 0,
      'gi-detail-panel: el panel no tiene contenido. Cada `<ng-template giTab="…">` necesita que ' +
        'la pantalla importe `GiTabContent`; sin eso el atributo no hace nada y el panel se dibuja ' +
        'vacío sin que Angular avise.',
    );

    devAssert(
      !primera || primera.label === 'Datos',
      `gi-detail-panel: la primera pestaña se llama "${primera?.label}" y debe llamarse "Datos". ` +
        'Es una decisión cerrada del sistema, para que el mismo sitio se llame igual en todos los ' +
        'módulos.',
    );

    devAssert(
      this.tabs().length !== 1,
      'gi-detail-panel: una sola pestaña no es una elección. Si el panel tiene un solo propósito, ' +
        'va sin pestañas y el pie lleva al siguiente paso.',
    );
  }

  /** Teclado del `tablist`: flechas con vuelta, Inicio y Fin. */
  protected alTeclado(event: KeyboardEvent) {
    const pestanas = this.tabs();

    if (!pestanas.length || (event.target as HTMLElement)?.getAttribute('role') !== 'tab') {
      return;
    }

    const actual = pestanas.findIndex((tab) => tab.id === this.activa());
    const ir = (indice: number) => {
      event.preventDefault();
      const destino = pestanas[(indice + pestanas.length) % pestanas.length];
      this.tabChange.emit(destino.id);
      queueMicrotask(() => document.getElementById(this.tabId(destino.id))?.focus());
    };

    switch (event.key) {
      case 'ArrowRight':
        ir(actual + 1);
        break;
      case 'ArrowLeft':
        ir(actual - 1);
        break;
      case 'Home':
        ir(0);
        break;
      case 'End':
        ir(pestanas.length - 1);
        break;
      default:
        break;
    }
  }
}
