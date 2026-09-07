import { ChangeDetectionStrategy, Component, OnInit, computed, input, output } from '@angular/core';
import { formatOperationalDate, shiftOperationalDate } from '../../util/operational-date';
import { GiSelect, GiSelectOption } from '../gi-select/gi-select';
import { devAssert } from '../dev-assert';

/** Los días de la semana, para que la barra diga «Jueves 10 sep 2026» y no sólo la fecha. */
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * La barra del día operativo: qué día, qué servicio, y contra qué se compara.
 *
 * <p><b>El día nunca sale del reloj del navegador.</b> Entra por `date` y el día de hoy entra por
 * `operationalToday`, los dos calculados por el servidor en el huso de la operación. No es una
 * precaución teórica: el defecto estuvo vivo en diez pantallas a la vez, y de las 18:00 en adelante
 * todas proponían el día siguiente. Por eso `operationalToday` es obligatorio aunque la barra
 * podría funcionar sin él: una pantalla que no lo pase rompe aquí en vez de correr el día en
 * silencio.</p>
 *
 * <p><b>Sin versión publicada no hay contra qué medir.</b> La barra lo dice y ofrece la salida, en
 * lugar de dejar el hueco en blanco. Un cero sin plan publicado diría «todo bien» cuando nadie ha
 * publicado nada, que es la peor confusión posible.</p>
 *
 * <p>El estado del cierre se proyecta desde fuera con <c>&lt;gi-day-closure&gt;</c>. La barra no
 * sabe nada del cierre a propósito: son dos piezas que cambian por razones distintas y las tres
 * pantallas las combinan de forma distinta.</p>
 */
@Component({
  selector: 'gi-operation-day-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiSelect],
  template: `
    <div class="gi-bar">
      <div class="gi-bar__dates">
        <button
          class="gi-bar__step"
          type="button"
          [attr.aria-label]="'Día anterior, ' + label(previousDate())"
          (click)="dateChange.emit(previousDate())"
        >
          ‹
        </button>

        <span class="gi-bar__current">{{ label(date()) }}</span>

        <button
          class="gi-bar__step"
          type="button"
          [disabled]="!canGoForward()"
          [attr.aria-label]="'Día siguiente, ' + label(nextDate())"
          (click)="dateChange.emit(nextDate())"
        >
          ›
        </button>

        @if (date() !== operationalToday()) {
          <button class="gi-bar__today" type="button" (click)="dateChange.emit(operationalToday())">
            Ir a hoy
          </button>
        }
      </div>

      <span class="gi-bar__divider" aria-hidden="true"></span>

      <gi-select
        label="Servicio"
        [options]="services()"
        [value]="idService()"
        (valueChange)="serviceChange.emit($event)"
      />

      @if (siteLabel()) {
        <span class="gi-bar__site">{{ siteLabel() }}</span>
      }

      <span class="gi-bar__spacer" aria-hidden="true"></span>

      @if (publishedVersionLabel()) {
        <span class="gi-bar__version">
          Se compara contra <strong>{{ publishedVersionLabel() }}</strong>
        </span>
      } @else {
        <span class="gi-bar__missing">
          <span class="gi-bar__pill">Sin planeación publicada</span>
          <button class="gi-bar__resolve" type="button" (click)="resolvePrerequisite.emit()">
            {{ prerequisiteActionLabel() }}
          </button>
        </span>
      }

      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; }

    .gi-bar {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex-wrap: wrap;
      padding: 0.75rem 0.85rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-bar__dates { display: flex; align-items: center; gap: 0.5rem; }

    .gi-bar__step {
      width: 2rem;
      height: 2rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-muted);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-bar__step[disabled] { opacity: 0.4; cursor: not-allowed; }
    .gi-bar__step:focus-visible,
    .gi-bar__today:focus-visible,
    .gi-bar__resolve:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .gi-bar__current { color: var(--gestia-text); font-size: 13px; font-weight: 600; }

    .gi-bar__today,
    .gi-bar__resolve {
      border: none;
      background: none;
      padding: 0;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .gi-bar__divider { width: 1px; height: 1.25rem; background: var(--gestia-border); }
    .gi-bar__site { color: var(--gestia-muted); font-size: 11.5px; }
    .gi-bar__spacer { flex: 1; }
    .gi-bar__version { color: var(--gestia-muted); font-size: 11.5px; }
    .gi-bar__version strong { color: var(--gestia-text); }

    .gi-bar__missing { display: flex; align-items: center; gap: 0.5rem; }

    .gi-bar__pill {
      border: 1px solid var(--gestia-warning);
      border-radius: var(--gestia-radius-pill);
      padding: 0.15rem 0.45rem;
      color: var(--gestia-warning);
      font-size: 10.5px;
      font-weight: 600;
    }
  `,
})
export class GiOperationDayBar implements OnInit {
  /** El día que se está viendo, como `yyyy-MM-dd`. */
  readonly date = input.required<string>();

  /**
   * El día operativo de hoy, según el servidor. Obligatorio: es lo que impide que «hoy» salga del
   * reloj del navegador.
   */
  readonly operationalToday = input.required<string>();

  readonly services = input.required<readonly GiSelectOption[]>();
  readonly idService = input('');
  readonly siteLabel = input('');

  /**
   * Hasta qué día se puede avanzar. Vacío significa sin tope.
   *
   * <p>Planeación mira hacia adelante y Asistencia no: capturar la asistencia de pasado mañana no
   * quiere decir nada. El tope lo decide la pantalla, no la barra.</p>
   */
  readonly maxDate = input('');

  /** Contra qué se compara el día. Vacío significa que nadie ha publicado la semana. */
  readonly publishedVersionLabel = input('');
  readonly prerequisiteActionLabel = input('Publicar la semana');

  readonly dateChange = output<string>();
  readonly serviceChange = output<string>();
  readonly resolvePrerequisite = output<void>();

  protected readonly previousDate = computed(() => shiftOperationalDate(this.date(), -1));
  protected readonly nextDate = computed(() => shiftOperationalDate(this.date(), 1));

  protected readonly canGoForward = computed(() => !this.maxDate() || this.nextDate() <= this.maxDate());

  ngOnInit(): void {
    devAssert(
      /^\d{4}-\d{2}-\d{2}$/.test(this.operationalToday()),
      'gi-operation-day-bar: `operationalToday` tiene que venir del servidor como yyyy-MM-dd. ' +
        'Si se calcula con el reloj del navegador, de las 18:00 en adelante la pantalla propone el ' +
        'día siguiente. Ya pasó en diez pantallas a la vez; sale de /api/v1/system/info.',
    );

    devAssert(
      /^\d{4}-\d{2}-\d{2}$/.test(this.date()),
      'gi-operation-day-bar: `date` tiene que ser un día de negocio yyyy-MM-dd, sin hora y sin ' +
        'huso. Un instante aquí vuelve a meter el corrimiento de día que el servidor ya cerró.',
    );

    devAssert(
      this.services().length > 0,
      'gi-operation-day-bar: sin servicios no se dibuja la barra, se dibuja un vacío de ' +
        'prerrequisito con su enlace. Un desplegable vacío no dice qué falta ni cómo resolverlo.',
    );

    devAssert(
      this.publishedVersionLabel().length > 0 || this.prerequisiteActionLabel().length > 0,
      'gi-operation-day-bar: si no hay versión publicada hay que ofrecer cómo publicarla. Un ' +
        'hueco de prerrequisito sin salida deja al usuario sin saber qué hacer.',
    );
  }

  /** «Jueves 10 sep 2026». El día de la semana ayuda a ubicarse cuando se navega de uno en uno. */
  protected label(isoDate: string): string {
    const formateada = formatOperationalDate(isoDate);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return formateada;
    }

    // Se construye en UTC por la misma razón que `shiftOperationalDate`: leer un día de negocio
    // con la hora local puede devolver el día anterior en husos al oeste de Greenwich.
    const [year, month, day] = isoDate.split('-').map(Number);
    const weekday = DIAS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

    return `${weekday} ${formateada}`;
  }
}
