import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { GiSelect, GiSelectOption } from '../gi-select/gi-select';
import { devAssert } from '../dev-assert';

export type GiFilterGroup = {
  readonly id: string;
  readonly label: string;
  /** Las opciones reales, **sin** la de «todos»: el componente la agrega. Mínimo dos. */
  readonly options: readonly GiSelectOption[];
  readonly value?: string;
  /** Texto de la opción que no filtra nada. Por omisión, «Todos». */
  readonly allLabel?: string;
};

let instancias = 0;

/**
 * Barra de filtros.
 *
 * <p>Buscador de ancho completo siempre visible con el contador al lado, y el resto detrás de un
 * botón, cerrado por omisión. Los chips de lo que está aplicado van debajo, porque un filtro
 * activo escondido dentro de un panel cerrado es la forma más rápida de que alguien jure que
 * faltan registros.</p>
 *
 * <p><b>No lleva botón «Filtrar»:</b> los filtros se aplican al cambiar. Tampoco un «Limpiar»
 * separado: los chips ya se quitan de uno en uno y «Quitar todos» aparece cuando hay alguno. Las
 * dos prohibiciones tienen su prueba, porque son la mitad de la definición del componente.</p>
 *
 * <p><b>Y rechaza en desarrollo un grupo con una sola opción real</b>, que es un control que no
 * puede cambiar nada y ocupa el mismo sitio que uno que sí.</p>
 */
@Component({
  selector: 'gi-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiSelect],
  template: `
    <section class="gi-filters" [attr.aria-label]="label()">
      <div class="gi-filters__row">
        <label class="gi-filters__search">
          <span class="gi-filters__search-label">{{ searchLabel() }}</span>
          <input
            class="gi-filters__input"
            type="search"
            [value]="search()"
            [attr.placeholder]="searchPlaceholder()"
            (input)="searchChange.emit($any($event.target).value)"
          />
        </label>

        <p class="gi-filters__count" role="status">{{ conteo() }}</p>

        @if (groups().length) {
          <button
            class="gi-filters__toggle"
            type="button"
            [attr.aria-expanded]="abierto()"
            [attr.aria-controls]="panelId"
            (click)="abierto.set(!abierto())"
          >
            Filtros
            @if (chips().length) {
              <span class="gi-filters__badge">{{ chips().length }}</span>
            }
          </button>
        }
      </div>

      @if (abierto()) {
        <div class="gi-filters__panel" [id]="panelId">
          @for (group of groups(); track group.id) {
            <div class="gi-filters__group">
              <span class="gi-filters__group-label">{{ group.label }}</span>
              <gi-select
                [label]="group.label"
                [options]="opcionesDe(group)"
                [value]="group.value || ''"
                [placeholder]="group.allLabel || 'Todos'"
                (valueChange)="filterChange.emit({ groupId: group.id, value: $event })"
              />
            </div>
          }
        </div>
      }

      @if (chips().length) {
        <div class="gi-filters__chips">
          @for (chip of chips(); track chip.groupId) {
            <span class="gi-filters__chip">
              <span>{{ chip.groupLabel }}: {{ chip.optionLabel }}</span>
              <button
                type="button"
                class="gi-filters__chip-remove"
                [attr.aria-label]="'Quitar filtro ' + chip.groupLabel"
                (click)="filterChange.emit({ groupId: chip.groupId, value: '' })"
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          }
          <button class="gi-filters__clear" type="button" (click)="clearAll.emit()">Quitar todos</button>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .gi-filters {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-filters__row {
      display: flex;
      align-items: flex-end;
      gap: 0.75rem;
    }

    .gi-filters__search { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }

    .gi-filters__search-label,
    .gi-filters__group-label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.07em;
    }

    .gi-filters__input {
      width: 100%;
      min-height: var(--gestia-control-height);
      padding: 0 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .gi-filters__input:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .gi-filters__count {
      flex: none;
      margin: 0 0 0.6rem;
      color: var(--gestia-muted);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    .gi-filters__toggle {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-filters__toggle:hover { border-color: var(--gestia-cyan-dark); }
    .gi-filters__toggle:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .gi-filters__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.15rem;
      padding: 0 0.25rem;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-cyan-soft);
      color: var(--gestia-cyan-dark);
      font-size: 10.5px;
      font-weight: 600;
    }

    .gi-filters__panel {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding-top: 0.15rem;
      border-top: 1px solid var(--gestia-border);
    }

    .gi-filters__group { display: flex; flex-direction: column; gap: 0.2rem; min-width: 12rem; }

    .gi-filters__chips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }

    .gi-filters__chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.2rem 0.2rem 0.5rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font-size: 10.5px;
      font-weight: 600;
    }

    .gi-filters__chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.05rem;
      height: 1.05rem;
      border: 0;
      border-radius: var(--gestia-radius-pill);
      background: transparent;
      color: var(--gestia-muted);
      font: inherit;
      cursor: pointer;
    }

    .gi-filters__chip-remove:hover { color: var(--gestia-danger); }
    .gi-filters__chip-remove:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .gi-filters__clear {
      border: 0;
      background: transparent;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-filters__clear:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
  `,
})
export class GiFilterBar implements OnInit {
  readonly search = input('');
  readonly searchLabel = input('Buscar');
  readonly searchPlaceholder = input('Nombre, código o contacto');
  readonly groups = input<readonly GiFilterGroup[]>([]);
  readonly resultCount = input<number | null>(null);
  readonly label = input('Filtros de la lista');

  readonly searchChange = output<string>();
  readonly filterChange = output<{ groupId: string; value: string }>();
  readonly clearAll = output<void>();

  /** Cerrado por omisión: lo que se usa siempre está fuera, lo demás detrás de un botón. */
  protected readonly abierto = signal(false);
  protected readonly panelId = `gi-filter-panel-${++instancias}`;

  protected readonly conteo = computed(() => {
    const total = this.resultCount();

    if (total === null) {
      return '';
    }

    return total === 1 ? '1 resultado' : `${total} resultados`;
  });

  protected readonly chips = computed(() =>
    this.groups()
      .filter((group) => !!group.value)
      .map((group) => ({
        groupId: group.id,
        groupLabel: group.label,
        optionLabel: group.options.find((option) => option.value === group.value)?.label ?? group.value!,
      })),
  );

  protected opcionesDe(group: GiFilterGroup): readonly GiSelectOption[] {
    return [{ value: '', label: group.allLabel || 'Todos' }, ...group.options];
  }

  ngOnInit(): void {
    const pobre = this.groups().find((group) => group.options.length < 2);

    devAssert(
      !pobre,
      `gi-filter-bar: el filtro "${pobre?.label}" tiene ${pobre?.options.length ?? 0} opción(es) ` +
        'reales. Un filtro que no puede cambiar el resultado ocupa el mismo sitio que uno que sí y ' +
        'hace creer que se está filtrando por algo.',
    );
  }
}
