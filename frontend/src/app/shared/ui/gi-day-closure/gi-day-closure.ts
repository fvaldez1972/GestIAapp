import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { devAssert } from '../dev-assert';

/**
 * El estado del día operativo.
 *
 * <p><b>`open` no es un valor guardado.</b> En la base hay dos estados —cerrado y reabierto— y la
 * ausencia de fila. Se nombra aquí como un tercer valor porque la pantalla sí tiene que dibujar
 * tres cosas distintas, pero conviene no olvidarlo al leer el servidor: preguntar por el cierre de
 * un día abierto devuelve nada, no devuelve «abierto».</p>
 */
export type GiDayState = 'open' | 'closed' | 'reopened';

/**
 * La foto que el cierre congela.
 *
 * <p>Se enseña <b>antes</b> de confirmar, no después. Estos cinco números son lo que queda fijo
 * para conciliar con el cliente, así que verlos cuando ya no se pueden cambiar no sirve de nada.</p>
 */
export type GiDaySnapshot = {
  readonly expectedShifts: number;
  readonly attendanceRecords: number;
  readonly pendingAttendance: number;
  readonly openIncidents: number;
  readonly coverageRecords: number;
};

/** Mínimo del motivo. Es el mismo de `CorrectionReasonPolicy.MinimumLength` en el servidor. */
export const GI_REASON_MIN_LENGTH = 10;

/**
 * El estado del día operativo, con sus dos acciones.
 *
 * <p><b>Cerrar no congela el día: cambia lo que cuesta cambiarlo.</b> Después del cierre se sigue
 * pudiendo corregir una asistencia, una incidencia o una cobertura; lo que cambia es que cada
 * corrección exige motivo y queda en la bitácora. Lo que sí queda fijo es la foto de los conteos,
 * que es contra lo que se concilia con el cliente.</p>
 *
 * <p><b>Cerrar con asistencias pendientes está permitido, y el diálogo dice cuántas son.</b> No se
 * bloquea por la misma razón que no se bloquea una incidencia sobre un día cerrado: el día
 * terminó, y si el sistema no deja cerrarlo, el corte se hace fuera del sistema. Se permite y se
 * nombra la consecuencia, que es distinto de permitirlo en silencio.</p>
 *
 * <p><b>El motivo de la reapertura va vacío y sin sugerencia</b>, con un mínimo de
 * {@link GI_REASON_MIN_LENGTH} caracteres. Prellenarlo o proponer un texto lo convertiría en un
 * trámite que se acepta sin leer, y entonces la bitácora guardaría la sugerencia del sistema en
 * lugar de la razón de la persona.</p>
 */
@Component({
  selector: 'gi-day-closure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gi-day">
      <span class="gi-day__chip" [class]="'gi-day__chip--' + state()">{{ chipLabel() }}</span>

      @if (state() !== 'open') {
        <span class="gi-day__trail">{{ trail() }}</span>
      }

      @if (canWrite()) {
        @if (state() === 'open') {
          <button class="gi-day__action" type="button" (click)="openCloseDialog()">Cerrar el día</button>
        } @else if (state() === 'closed') {
          <button class="gi-day__action" type="button" (click)="openReopenDialog()">Reabrir el día</button>
        }
      }
    </div>

    <dialog #cerrar class="gi-day__dialog" aria-labelledby="gi-day-close-title" (close)="resetClose()">
      <h2 class="gi-day__title" id="gi-day-close-title">Cerrar el día operativo</h2>
      <p class="gi-day__lead">
        Se guarda la foto de cómo quedó el día. Después se puede seguir corrigiendo, pero cada
        corrección va a pedir motivo y va a quedar en la bitácora.
      </p>

      <dl class="gi-day__snapshot">
        <div><dt>Turnos esperados</dt><dd>{{ snapshot().expectedShifts }}</dd></div>
        <div><dt>Asistencias capturadas</dt><dd>{{ snapshot().attendanceRecords }}</dd></div>
        <div [class.gi-day__warn]="snapshot().pendingAttendance > 0">
          <dt>Pendientes de capturar</dt><dd>{{ snapshot().pendingAttendance }}</dd>
        </div>
        <div [class.gi-day__warn]="snapshot().openIncidents > 0">
          <dt>Incidencias abiertas</dt><dd>{{ snapshot().openIncidents }}</dd>
        </div>
        <div><dt>Coberturas</dt><dd>{{ snapshot().coverageRecords }}</dd></div>
      </dl>

      @if (pendingWarning(); as aviso) {
        <p class="gi-day__consequence">{{ aviso }}</p>
      }

      <label class="gi-day__field">
        <span>Nota del cierre <em>(opcional)</em></span>
        <textarea
          rows="2"
          [value]="notes()"
          (input)="notes.set($any($event.target).value)"
          placeholder="Lo que convenga dejar dicho del día."
        ></textarea>
      </label>

      <div class="gi-day__actions">
        <button #cancelarCierre class="gi-day__cancel" type="button" (click)="cerrarDialogo()">Cancelar</button>
        <span class="gi-day__gap" aria-hidden="true"></span>
        <button class="gi-day__confirm" type="button" (click)="confirmClose()">Cerrar el día</button>
      </div>
    </dialog>

    <dialog #reabrir class="gi-day__dialog" aria-labelledby="gi-day-reopen-title" (close)="resetReopen()">
      <h2 class="gi-day__title" id="gi-day-reopen-title">Reabrir el día operativo</h2>
      <p class="gi-day__lead">
        La foto del cierre se conserva. Quedan registrados quién reabre, cuándo y por qué, y las
        correcciones vuelven a no pedir motivo.
      </p>

      <label class="gi-day__field">
        <span>Por qué se reabre</span>
        <textarea
          #motivo
          rows="3"
          [value]="reason()"
          (input)="reason.set($any($event.target).value)"
          [attr.aria-describedby]="reasonTooShort() ? 'gi-day-reason-help' : null"
        ></textarea>
      </label>

      @if (reasonTooShort()) {
        <p class="gi-day__help" id="gi-day-reason-help">
          Escribe al menos {{ minLength }} caracteres. Van {{ reason().trim().length }}.
        </p>
      }

      <div class="gi-day__actions">
        <button #cancelarReapertura class="gi-day__cancel" type="button" (click)="cerrarDialogo()">
          Cancelar
        </button>
        <span class="gi-day__gap" aria-hidden="true"></span>
        <button
          class="gi-day__confirm"
          type="button"
          [disabled]="reasonTooShort()"
          (click)="confirmReopen()"
        >
          Reabrir
        </button>
      </div>
    </dialog>
  `,
  styles: `
    :host { display: contents; }

    .gi-day { display: flex; align-items: center; gap: 0.6rem; }

    .gi-day__chip {
      border: 1px solid currentcolor;
      border-radius: var(--gestia-radius-pill);
      padding: 0.15rem 0.45rem;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    /* El color nunca es lo único: la palabra va dentro de la píldora. */
    .gi-day__chip--open { color: var(--gestia-success); }
    .gi-day__chip--closed { color: var(--gestia-muted); }
    .gi-day__chip--reopened { color: var(--gestia-warning); }

    .gi-day__trail { color: var(--gestia-muted); font-size: 11.5px; }

    .gi-day__action {
      height: 2.5rem;
      padding: 0 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-day__action:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .gi-day__dialog {
      width: min(30rem, calc(100vw - 2rem));
      padding: 1.1rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    .gi-day__dialog::backdrop { background: var(--gestia-dialog-veil); }

    .gi-day__title { margin: 0 0 0.5rem; color: var(--gestia-navy); font-size: 13px; font-weight: 700; }
    .gi-day__lead { margin: 0 0 0.8rem; color: var(--gestia-muted); font-size: 12px; line-height: 1.55; }

    .gi-day__snapshot { margin: 0 0 0.6rem; display: flex; flex-direction: column; gap: 0.2rem; }
    .gi-day__snapshot div { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 12px; }
    .gi-day__snapshot dt { margin: 0; color: var(--gestia-muted); }
    .gi-day__snapshot dd { margin: 0; font-weight: 600; }
    .gi-day__warn dt, .gi-day__warn dd { color: var(--gestia-warning); }

    .gi-day__consequence {
      margin: 0 0 0.8rem;
      padding: 0.5rem 0.6rem;
      border-left: 3px solid var(--gestia-warning);
      background: var(--gestia-canvas);
      font-size: 12px;
      line-height: 1.55;
    }

    .gi-day__field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 12px; }
    .gi-day__field span { color: var(--gestia-muted); font-weight: 600; }
    .gi-day__field em { font-style: normal; font-weight: 400; }

    .gi-day__field textarea {
      padding: 0.5rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      resize: vertical;
    }

    .gi-day__help { margin: 0.3rem 0 0; color: var(--gestia-warning); font-size: 11.5px; }

    .gi-day__actions { display: flex; align-items: center; margin-top: 1rem; }
    .gi-day__gap { flex: 1; }

    .gi-day__cancel, .gi-day__confirm {
      height: 2.5rem;
      padding: 0 0.9rem;
      border-radius: var(--gestia-radius);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-day__cancel { border: 1px solid var(--gestia-border); background: var(--gestia-surface); color: var(--gestia-text); }
    .gi-day__confirm { border: 1px solid var(--gestia-navy); background: var(--gestia-navy); color: var(--gestia-surface); }
    .gi-day__confirm[disabled] { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class GiDayClosure implements OnInit {
  readonly state = input.required<GiDayState>();

  /** Quién cerró y cuándo, ya formateados en el huso operativo por quien llama. */
  readonly closedByName = input('');
  readonly closedAt = input('');
  readonly reopenedByName = input('');
  readonly reopenedAt = input('');

  readonly snapshot = input<GiDaySnapshot>({
    expectedShifts: 0,
    attendanceRecords: 0,
    pendingAttendance: 0,
    openIncidents: 0,
    coverageRecords: 0,
  });

  readonly canWrite = input(false);

  readonly closeDay = output<string | null>();
  readonly reopenDay = output<string>();

  protected readonly minLength = GI_REASON_MIN_LENGTH;
  protected readonly notes = signal('');
  protected readonly reason = signal('');

  private readonly closeDialog = viewChild<ElementRef<HTMLDialogElement>>('cerrar');
  private readonly reopenDialog = viewChild<ElementRef<HTMLDialogElement>>('reabrir');
  private readonly cancelClose = viewChild<ElementRef<HTMLButtonElement>>('cancelarCierre');
  private readonly reasonField = viewChild<ElementRef<HTMLTextAreaElement>>('motivo');

  protected readonly chipLabel = computed(() => {
    switch (this.state()) {
      case 'closed':
        return 'DÍA CERRADO';
      case 'reopened':
        return 'DÍA REABIERTO';
      default:
        return 'DÍA ABIERTO';
    }
  });

  protected readonly trail = computed(() =>
    this.state() === 'reopened'
      ? `Reabrió ${this.reopenedByName()}, ${this.reopenedAt()}`
      : `Cerró ${this.closedByName()}, ${this.closedAt()}`,
  );

  protected readonly reasonTooShort = computed(() => this.reason().trim().length < GI_REASON_MIN_LENGTH);

  /**
   * El aviso que nombra la consecuencia.
   *
   * <p>«Hay pendientes» no es un aviso: es un botón de continuar con otra redacción. Decir cuántas
   * quedan y qué significa que se congelen sí deja decidir.</p>
   */
  protected readonly pendingWarning = computed(() => {
    const { pendingAttendance, openIncidents } = this.snapshot();
    const partes: string[] = [];

    if (pendingAttendance > 0) {
      partes.push(
        pendingAttendance === 1
          ? 'Queda 1 asistencia sin capturar'
          : `Quedan ${pendingAttendance} asistencias sin capturar`,
      );
    }

    if (openIncidents > 0) {
      partes.push(
        openIncidents === 1 ? '1 incidencia sigue abierta' : `${openIncidents} incidencias siguen abiertas`,
      );
    }

    if (partes.length === 0) {
      return '';
    }

    return `${partes.join(' y ')}. Se puede cerrar igual, y así queda en la foto: capturarlas después va a exigir motivo y la conciliación va a mostrar este número.`;
  });

  constructor() {
    // El diálogo se abre y se cierra desde el componente, pero el foco inicial se pone aquí para
    // que Cancelar sea lo que recibe el foco al abrir el cierre —confirmar sin mirar no cierra un
    // día— y el campo de motivo lo reciba al reabrir, porque ahí lo único que se puede hacer es
    // escribirlo.
    effect(() => {
      if (this.reasonField()) {
        this.reasonField()?.nativeElement.focus();
      }
    });
  }

  ngOnInit(): void {
    devAssert(
      this.state() === 'open' || this.closedByName().trim().length > 0,
      'gi-day-closure: un día cerrado o reabierto tiene que decir quién lo cerró. Un cierre sin ' +
        'nombre no se puede auditar, y el servidor siempre lo manda: si llega vacío es que la ' +
        'pantalla no lo está leyendo.',
    );

    devAssert(
      this.state() !== 'reopened' || this.reopenedByName().trim().length > 0,
      'gi-day-closure: un día reabierto tiene que decir quién lo reabrió. La entidad guarda ' +
        'ReopenedByName y el motivo es obligatorio, así que nunca puede venir vacío.',
    );

    devAssert(
      this.reason().length === 0,
      'gi-day-closure: el motivo de la reapertura no se prellena ni se sugiere. Un motivo ' +
        'propuesto por el sistema se acepta sin leer, y entonces la bitácora guarda la sugerencia ' +
        'en lugar de la razón de la persona.',
    );
  }

  protected openCloseDialog(): void {
    this.notes.set('');
    this.closeDialog()?.nativeElement.showModal();
    this.cancelClose()?.nativeElement.focus();
  }

  protected openReopenDialog(): void {
    this.reason.set('');
    this.reopenDialog()?.nativeElement.showModal();
  }

  protected cerrarDialogo(): void {
    this.closeDialog()?.nativeElement.close();
    this.reopenDialog()?.nativeElement.close();
  }

  protected confirmClose(): void {
    this.closeDay.emit(this.notes().trim() || null);
    this.cerrarDialogo();
  }

  protected confirmReopen(): void {
    if (this.reasonTooShort()) {
      return;
    }

    this.reopenDay.emit(this.reason().trim());
    this.cerrarDialogo();
  }

  protected resetClose(): void {
    this.notes.set('');
  }

  protected resetReopen(): void {
    this.reason.set('');
  }
}
