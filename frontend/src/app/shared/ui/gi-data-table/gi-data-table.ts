import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { GiEmptyState } from '../gi-empty-state/gi-empty-state';

/**
 * Una columna. El `kind` no es decoración: elige el tamaño y el peso dentro de la escala cerrada,
 * y por eso son tres y no un estilo libre.
 */
export type GiColumn = {
  readonly key: string;
  readonly label: string;
  /** `220px` nombre de entidad · `190px` cliente o sede · `150px` vigencia · `130px` conteos. */
  readonly width?: string;
  readonly align?: 'start' | 'end';
  /** `name` 13/600 · `data` 12.5/400 · `meta` 11.5/400. Por omisión, `data`. */
  readonly kind?: 'name' | 'data' | 'meta';
};

/**
 * Los cinco estados obligatorios. **Vacío por filtro y vacío sin datos son distintos**: el primero
 * se resuelve quitando filtros y el segundo creando el primer registro.
 */
export type GiTableState = 'loading' | 'ready' | 'empty-filtered' | 'empty' | 'error';

/** Celda a medida: `<ng-template giCell="clave" let-row>`. Sin plantilla se pinta `row[clave]`. */
@Directive({ selector: '[giCell]' })
export class GiCell {
  readonly giCell = input.required<string>();
  readonly template = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}

/**
 * Tabla de datos.
 *
 * <b>Los cinco estados son del componente y no de quien lo usa.</b> Antes cada pantalla resolvía
 * a su manera qué mostrar mientras carga, qué decir cuando no hay nada y qué hacer si la consulta
 * falla; el resultado eran cinco maneras distintas de decir lo mismo, y en algunas pantallas
 * faltaba alguno.
 *
 * <p>La carga se dibuja con <b>esqueleto y no con un girador</b>: el esqueleto conserva la forma de
 * la tabla, así que la pantalla no salta cuando llegan los datos y quien mira ya sabe cuántas
 * columnas va a leer.</p>
 *
 * <p>La fila seleccionada se marca con <c>aria-selected</c> <b>y</b> con fondo
 * <c>--gestia-cyan-soft</c>. Nunca sólo con el color: quien no distingue ese cian no vería nada.</p>
 */
@Component({
  selector: 'gi-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, GiEmptyState],
  template: `
    <div class="gi-table-shell">
      <table
        class="gi-table"
        [attr.role]="selectable() ? 'grid' : null"
        [attr.aria-busy]="state() === 'loading'"
        [attr.aria-label]="label()"
      >
        <colgroup>
          @for (column of columns(); track column.key) {
            <col [style.width]="column.width || null" />
          }
        </colgroup>

        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th scope="col" [class.is-end]="column.align === 'end'">{{ column.label }}</th>
            }
          </tr>
        </thead>

        <tbody>
          @switch (state()) {
            @case ('loading') {
              @for (fila of esqueleto(); track fila) {
                <tr class="gi-table__skeleton-row" aria-hidden="true">
                  @for (column of columns(); track column.key) {
                    <td><span class="gi-table__skeleton"></span></td>
                  }
                </tr>
              }
            }
            @case ('ready') {
              @for (row of rows(); track id(row); let i = $index) {
                <tr
                  [attr.tabindex]="selectable() ? (i === filaEnfocada() ? 0 : -1) : null"
                  [attr.aria-selected]="selectable() ? id(row) === selectedId() : null"
                  [class.is-selected]="id(row) === selectedId()"
                  [class.is-selectable]="selectable()"
                  (click)="elegir(row)"
                  (focus)="filaEnfocada.set(i)"
                  (keydown)="alTeclado($event, i)"
                >
                  @for (column of columns(); track column.key) {
                    <td [class]="'is-' + (column.kind || 'data')" [class.is-end]="column.align === 'end'">
                      @if (plantillas().get(column.key); as plantilla) {
                        <ng-container *ngTemplateOutlet="plantilla; context: { $implicit: row }" />
                      } @else {
                        {{ texto(row, column.key) }}
                      }
                    </td>
                  }
                </tr>
              }
            }
          }
        </tbody>
      </table>

      @if (state() === 'loading') {
        <p class="gi-table__announce" role="status">Cargando información…</p>
      }

      @if (state() === 'empty' || state() === 'empty-filtered') {
        <gi-empty-state
          [variant]="state() === 'empty-filtered' ? 'no-results' : 'no-data'"
          [title]="emptyTitle()"
          [description]="emptyDescription()"
          [actionLabel]="emptyActionLabel()"
          (action)="emptyAction.emit()"
        />
      }

      @if (state() === 'error') {
        <div class="gi-table__error" role="alert">
          <p class="gi-table__error-text">{{ errorMessage() || 'No se pudo cargar la información.' }}</p>
          <button class="gi-table__retry" type="button" (click)="retry.emit()">Reintentar</button>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .gi-table-shell {
      overflow-x: auto;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .gi-table th {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.07em;
      text-align: left;
      white-space: nowrap;
    }

    .gi-table td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--gestia-border);
      color: var(--gestia-text);
      text-align: left;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gi-table tbody tr:last-child td { border-bottom: 0; }

    .gi-table th.is-end,
    .gi-table td.is-end { text-align: right; }

    /* Los tres pesos de la escala. Ningún otro tamaño entra en una celda. */
    .gi-table td.is-name { font-size: 13px; font-weight: 600; }
    .gi-table td.is-data { font-size: 12.5px; font-weight: 400; }
    .gi-table td.is-meta { font-size: 11.5px; font-weight: 400; color: var(--gestia-muted); }

    .gi-table tr.is-selectable { cursor: pointer; }
    .gi-table tr.is-selectable:hover td { background: var(--gestia-surface-soft); }

    /* Selección: color **y** aria-selected. El color no va solo. */
    .gi-table tr.is-selected td { background: var(--gestia-cyan-soft); }

    .gi-table tr:focus-visible {
      outline: 2px solid var(--gestia-cyan);
      outline-offset: -2px;
    }

    .gi-table__skeleton {
      display: block;
      height: 12px;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-skeleton);
    }

    .gi-table__skeleton-row td { border-bottom: 1px solid var(--gestia-border); }

    /* El aviso de carga existe para quien no ve el esqueleto; no ocupa sitio en pantalla. */
    .gi-table__announce {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .gi-table__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      padding: 2.25rem 1.25rem;
    }

    .gi-table__error-text {
      margin: 0;
      color: var(--gestia-danger);
      font-size: 12.5px;
      font-weight: 600;
      text-align: center;
    }

    .gi-table__retry {
      min-height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-table__retry:hover { border-color: var(--gestia-cyan-dark); }
    .gi-table__retry:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
  `,
})
export class GiDataTable<TRow> {
  readonly columns = input.required<readonly GiColumn[]>();
  readonly rows = input<readonly TRow[]>([]);
  /** Cómo se identifica una fila. Sin esto no hay selección estable ni `track` fiable. */
  readonly rowId = input<(row: TRow) => string>((row) => String(row));
  readonly state = input<GiTableState>('ready');
  readonly selectedId = input<string | null>(null);
  readonly selectable = input(true);
  /** Cuántas filas dibuja el esqueleto. Se parece a lo que va a llegar, no a una barra girando. */
  readonly skeletonRows = input(5);
  readonly errorMessage = input('');
  readonly emptyTitle = input('');
  readonly emptyDescription = input('');
  readonly emptyActionLabel = input('');
  /** Nombre accesible de la tabla. Una tabla sin nombre se anuncia como «tabla». */
  readonly label = input('');

  readonly rowSelect = output<TRow>();
  readonly retry = output<void>();
  readonly emptyAction = output<void>();

  private readonly celdas = contentChildren(GiCell);

  protected readonly filaEnfocada = signal(0);
  protected readonly esqueleto = computed(() =>
    Array.from({ length: Math.max(1, this.skeletonRows()) }, (_, i) => i),
  );
  protected readonly plantillas = computed(
    () => new Map(this.celdas().map((celda) => [celda.giCell(), celda.template])),
  );

  protected id(row: TRow): string {
    return this.rowId()(row);
  }

  protected texto(row: TRow, key: string): string {
    const valor = (row as Record<string, unknown>)[key];
    return valor === null || valor === undefined ? '' : String(valor);
  }

  protected elegir(row: TRow): void {
    if (this.selectable()) {
      this.rowSelect.emit(row);
    }
  }

  /**
   * El teclado de una tabla seleccionable. Un `<select>` nativo lo traería de fábrica; aquí, como
   * con el desplegable propio, hay que reponerlo a mano o la tabla sólo sirve con ratón.
   */
  protected alTeclado(event: KeyboardEvent, indice: number): void {
    if (!this.selectable()) {
      return;
    }

    const total = this.rows().length;
    const mover = (destino: number) => {
      event.preventDefault();
      const siguiente = Math.max(0, Math.min(total - 1, destino));
      this.filaEnfocada.set(siguiente);
      const filas = (event.currentTarget as HTMLElement).parentElement?.children;
      (filas?.[siguiente] as HTMLElement | undefined)?.focus();
    };

    switch (event.key) {
      case 'ArrowDown':
        mover(indice + 1);
        break;
      case 'ArrowUp':
        mover(indice - 1);
        break;
      case 'Home':
        mover(0);
        break;
      case 'End':
        mover(total - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const fila = this.rows()[indice];
        if (fila !== undefined) this.elegir(fila);
        break;
      }
      default:
        break;
    }
  }
}
