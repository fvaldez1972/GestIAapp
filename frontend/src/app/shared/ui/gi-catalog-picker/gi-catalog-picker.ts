import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { catalogNameDistance, normalizeCatalogName } from '../../util/catalog-name';

/**
 * Lo mínimo que la pieza necesita de un valor de catálogo.
 *
 * <p>Deliberadamente más estrecho que `CatalogItem`: así cada pantalla pasa la forma que ya tiene
 * cargada —Personal tiene sus puestos, Incidencias sus motivos— sin traducirla a otra cosa.</p>
 */
export type GiCatalogOption = {
  readonly idCatalogItem: string;
  readonly name: string;
};

/** Lo que el usuario acaba de pedir crear. La pantalla decide cómo guardarlo. */
export type GiCatalogCreation = {
  readonly name: string;
};

/**
 * Elegir un valor de catálogo, o crearlo sin salir del formulario.
 *
 * <p><b>Es el punto de la tanda: que el administrador no tenga que ir a Catálogos antes de
 * trabajar.</b> Si el catálogo está vacío o no tiene lo que busca, lo escribe aquí y el sistema le
 * ofrece guardarlo para reutilizarlo. Antes esta pieza decía «Sin opciones activas» y ahí se
 * acababa: había que salir, ir a Catálogos, crearlo y volver a empezar el alta.</p>
 *
 * <p><b>Una sola llave: el identificador.</b> La pieza anterior tenía tres modos —por identificador,
 * por código y por nombre— y el mismo tipo de catálogo se elegía de una forma en una pantalla y de
 * otra en la siguiente. Un valor renombrado rompía a quien lo guardaba por nombre, y el código ya no
 * existe.</p>
 *
 * <h4>Lo casi igual</h4>
 *
 * <p>Crear «Guardia» y «guardia» como dos entradas sería peor que no tener esta función, así que hay
 * tres franjas, decididas sobre el nombre plegado:</p>
 *
 * <list type="number">
 * <item><b>Colapsa exacto</b> con uno que ya existe: no se ofrece crear. Se selecciona el que hay y
 * se dice. Sin error: el usuario pidió algo que ya está.</item>
 * <item><b>Se parece mucho</b>: se ofrecen las dos salidas, y <b>la de usar el existente va
 * primero</b>. El error que hay que evitar no es no poder crear, es crear un duplicado sin darse
 * cuenta; poner las dos opciones al mismo peso convierte la decisión en un volado. Sugiere, no
 * bloquea: dos puestos parecidos pueden ser legítimamente dos puestos.</item>
 * <item><b>No se parece a nada</b>: se ofrece crear directamente.</item>
 * </list>
 *
 * <p><b>La comprobación de verdad está en la base</b>, en el índice único sobre el nombre plegado.
 * Esto es cortesía para no mandar al usuario contra un 409.</p>
 *
 * <p>Sin permiso de escritura la acción de crear <b>no se dibuja</b> —no se dibuja gris—, y en su
 * lugar se dice qué falta. Es la misma forma de decir que no que usan las demás pantallas rehechas.</p>
 */
@Component({
  selector: 'gi-catalog-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Cerrar al salir del componente cubre el clic fuera y el salto con Tab con un solo camino.
    // Es lo mismo que hace `gi-select`; esta pieza no lo copió al nacer y quedaba abierta para
    // siempre, obligando a elegir algo aunque uno se hubiera arrepentido.
    '(focusout)': 'alSalirElFoco($event)',
    '(keydown.escape)': 'abierto.set(false)',
  },
  template: `
    <div class="pick">
      <label class="pick__label" [attr.for]="inputId()">{{ label() }}</label>

      <input
        class="pick__input"
        type="text"
        role="combobox"
        autocomplete="off"
        [id]="inputId()"
        [value]="texto()"
        [disabled]="disabled()"
        [attr.aria-expanded]="abierto()"
        [attr.aria-describedby]="inputId() + '-ayuda'"
        [placeholder]="placeholder()"
        (input)="escribir($any($event.target).value)"
        (focus)="abierto.set(true)"
      />

      @if (abierto()) {
        <ul class="pick__lista" role="listbox">
          @for (option of coincidencias(); track option.idCatalogItem) {
            <li class="pick__opcion" role="option" [attr.aria-selected]="option.idCatalogItem === value()">
              <button class="pick__elegir" type="button" (click)="elegir(option)">{{ option.name }}</button>
            </li>
          }

          @if (yaExiste(); as existente) {
            <li class="pick__aviso">
              <span>«{{ existente.name }}» ya está en el catálogo.</span>
              <button class="pick__elegir pick__elegir--sugerido" type="button" (click)="elegir(existente)">
                Seleccionarlo
              </button>
            </li>
          } @else if (parecido(); as similar) {
            <li class="pick__aviso">
              <span>¿Querías «{{ similar.name }}»?</span>
              <button class="pick__elegir pick__elegir--sugerido" type="button" (click)="elegir(similar)">
                Usar el que existe
              </button>
              @if (canWrite()) {
                <button class="pick__crear pick__crear--discreto" type="button" (click)="crear()">
                  Crear «{{ escrito() }}» como valor nuevo
                </button>
              }
            </li>
          } @else if (puedeCrear()) {
            <li class="pick__aviso">
              <span>No tienes «{{ escrito() }}» en {{ catalogLabel() }}.</span>
              @if (canWrite()) {
                <button class="pick__crear" type="button" (click)="crear()">
                  Agregarlo para poder reutilizarlo
                </button>
              } @else {
                <span class="pick__sinpermiso">
                  Pídelo a quien administre los catálogos: aquí sólo puedes elegir de lo que ya hay.
                </span>
              }
            </li>
          } @else if (coincidencias().length === 0) {
            <li class="pick__aviso">
              <span>{{ catalogLabel() }} está vacío. Escribe el valor que necesitas.</span>
            </li>
          }
        </ul>
      }

      <small class="pick__ayuda" [id]="inputId() + '-ayuda'">{{ ayuda() }}</small>
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .pick { position: relative; display: flex; flex-direction: column; gap: 0.25rem; }

    .pick__label { color: var(--gestia-muted); font-size: 11.5px; font-weight: 600; }

    .pick__input {
      width: 100%;
      height: var(--gestia-control-height);
      padding: 0 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .pick__input:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
    .pick__input:disabled { background: var(--gestia-surface-soft); color: var(--gestia-muted); }

    .pick__lista {
      position: absolute;
      top: 100%;
      z-index: 20;
      width: 100%;
      max-height: 16rem;
      margin: 0.15rem 0 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      box-shadow: var(--gestia-shadow);
    }

    .pick__opcion { border-bottom: 1px solid var(--gestia-border); }
    .pick__opcion:last-child { border-bottom: none; }

    .pick__elegir {
      width: 100%;
      padding: 0.5rem 0.6rem;
      border: none;
      background: none;
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      text-align: left;
      cursor: pointer;
    }

    .pick__elegir:hover { background: var(--gestia-surface-soft); }
    .pick__elegir:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: -2px; }

    /* La salida recomendada se lee primero y pesa más que la de crear. */
    .pick__elegir--sugerido { font-weight: 600; }

    .pick__aviso {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.6rem;
      border-top: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
      color: var(--gestia-muted);
      font-size: 11.5px;
      line-height: 1.45;
    }

    .pick__crear {
      align-self: flex-start;
      height: 2.25rem;
      padding: 0 0.7rem;
      border: 1px solid var(--gestia-cyan);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    /* Crear un valor nuevo habiendo uno parecido es la salida menos probable: se ofrece sin peso. */
    .pick__crear--discreto {
      border-color: var(--gestia-border);
      color: var(--gestia-muted);
      font-weight: 400;
    }

    .pick__crear:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .pick__sinpermiso { color: var(--gestia-muted); }

    .pick__ayuda { color: var(--gestia-muted); font-size: 11px; }
  `,
})
export class GiCatalogPicker {
  /** Los valores activos del catálogo, ya cargados por la pantalla. */
  readonly options = input.required<readonly GiCatalogOption[]>();

  /** El identificador elegido, o cadena vacía. **Nunca un nombre ni un código.** */
  readonly value = input('');

  readonly label = input('Valor');

  /** Cómo se llama el catálogo en la frase de crear: «No tienes X en el catálogo de puestos». */
  readonly catalogLabel = input('el catálogo');

  readonly canWrite = input(false);
  readonly disabled = input(false);
  readonly inputId = input('gi-catalog-picker');

  readonly valueChange = output<string>();
  readonly create = output<GiCatalogCreation>();

  protected readonly escrito = signal('');
  protected readonly abierto = signal(false);

  /**
   * Se cierra al salir del componente.
   *
   * <p>`relatedTarget` dice a dónde va el foco. Si sigue dentro —de la caja de texto a una opción,
   * por ejemplo— no hay que cerrar; si sale, o si no va a ninguna parte, sí.</p>
   */
  protected alSalirElFoco(event: FocusEvent): void {
    const destino = event.relatedTarget as Node | null;
    const anfitrion = (event.currentTarget as HTMLElement | null) ?? null;

    if (!destino || !anfitrion?.contains(destino)) {
      this.abierto.set(false);
    }
  }

  /** Lo que se ve en el campo: lo escrito manda; si no hay nada escrito, el nombre del elegido. */
  protected readonly texto = computed(() => {
    const escrito = this.escrito();

    if (escrito) {
      return escrito;
    }

    return this.options().find((item) => item.idCatalogItem === this.value())?.name ?? '';
  });

  protected readonly placeholder = computed(() =>
    this.options().length === 0 ? 'Escribe el primero' : 'Escribe para buscar',
  );

  protected readonly coincidencias = computed(() => {
    const buscado = normalizeCatalogName(this.escrito());

    if (!buscado) {
      return this.options();
    }

    return this.options().filter((item) => normalizeCatalogName(item.name).includes(buscado));
  });

  /** El que colapsa exacto con lo escrito. Si existe, no se ofrece crear nada. */
  protected readonly yaExiste = computed(() => {
    const buscado = normalizeCatalogName(this.escrito());

    if (!buscado) {
      return null;
    }

    return this.options().find((item) => normalizeCatalogName(item.name) === buscado) ?? null;
  });

  /** El más cercano dentro de la distancia que vale la pena preguntar. */
  protected readonly parecido = computed(() => {
    const buscado = normalizeCatalogName(this.escrito());

    if (!buscado || this.yaExiste()) {
      return null;
    }

    return (
      this.options().find((item) => {
        const otro = normalizeCatalogName(item.name);
        return catalogNameDistance(buscado, otro) <= 2 || otro.includes(buscado) || buscado.includes(otro);
      }) ?? null
    );
  });

  protected readonly puedeCrear = computed(() => !!normalizeCatalogName(this.escrito()) && !this.yaExiste());

  protected readonly ayuda = computed(() => {
    if (this.yaExiste()) {
      return 'Ya existe: selecciónalo en lugar de crear otro igual.';
    }

    if (!this.canWrite()) {
      return 'Sólo puedes elegir de lo que ya está en el catálogo.';
    }

    return 'Si no está, escríbelo y se agrega al catálogo para reutilizarlo.';
  });

  protected elegir(option: GiCatalogOption): void {
    this.escrito.set('');
    this.abierto.set(false);
    this.valueChange.emit(option.idCatalogItem);
  }

  protected crear(): void {
    const nombre = this.escrito().trim();

    if (!nombre || !this.canWrite()) {
      return;
    }

    this.abierto.set(false);
    this.create.emit({ name: nombre });
  }

  protected escribir(valor: string): void {
    this.escrito.set(valor);
    this.abierto.set(true);

    // Escribir deshace la selección: lo que se ve y lo que vale no pueden decir cosas distintas.
    if (this.value()) {
      this.valueChange.emit('');
    }
  }
}
