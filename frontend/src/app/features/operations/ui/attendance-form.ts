import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { AttendanceStatus } from '../../clients/data-access/client.models';
import { GiSelect, GiSelectOption, GI_REASON_MIN_LENGTH } from '../../../shared/ui/gi-ui';
import { AttendanceRow } from '../data-access/attendance-day';

/** Lo que se manda al guardar. La autorización y el motivo viajan en campos distintos. */
export type AttendanceDraft = {
  readonly status: AttendanceStatus;
  readonly actualStartTime: string | null;
  readonly actualEndTime: string | null;
  readonly minutesLate: number;
  readonly notes: string | null;
  /** El permiso previo, elegido de entre los aprobados. */
  readonly idApprovalRequest: string | null;
  /** Lo que se hizo y por qué, para la bitácora. */
  readonly correctionReason: string | null;
};

const ESTADOS: readonly GiSelectOption[] = [
  { value: 'Present', label: 'Asistió' },
  { value: 'Late', label: 'Llegó tarde' },
  { value: 'Absent', label: 'No se presentó' },
  { value: 'Excused', label: 'Falta justificada' },
];

/**
 * Captura y corrección de una asistencia.
 *
 * <p><b>La autorización y el motivo son dos cosas distintas, y esta pantalla no las funde.</b></p>
 *
 * <ul>
 * <li><b>La autorización</b> es un <i>permiso previo</i>: existe antes de la corrección, la concede
 * alguien más y apunta a este registro. Se <b>elige</b> de entre las aprobadas. Responde a «¿te
 * dejaron cambiar esto?».</li>
 * <li><b>El motivo</b> es <i>la explicación de lo que se hizo</i>: lo escribe quien corrige, en el
 * momento, y viaja a la bitácora del registro. Responde a «¿qué cambiaste y por qué?».</li>
 * </ul>
 *
 * <p><b>Se piden por condiciones distintas, y eso es lo que prueba que no son lo mismo.</b> La
 * autorización se exige cuando los datos <i>cambiaron</i>, esté el día cerrado o no. El motivo se
 * exige cuando el <i>día está cerrado</i>, hayan cambiado los datos o no. Una corrección puede
 * necesitar sólo una, sólo el otro, las dos o ninguna.</p>
 *
 * <p>Por eso van en dos bloques separados, con encabezados propios, y el aviso de cada uno dice qué
 * es. Fundirlos dejaría la bitácora registrando una cosa distinta de la que ocurrió.</p>
 */
@Component({
  selector: 'app-attendance-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiSelect],
  template: `
    <form class="asis" (submit)="$event.preventDefault(); guardar()">
      <p class="asis__quien">
        <strong>{{ row().employeeName }}</strong>
        <span>{{ row().positionCode }} · {{ row().positionName }} · planeado {{ row().planned }}</span>
      </p>

      <section class="asis__bloque">
        <h3 class="asis__titulo">Lo que pasó en el turno</h3>

        <label class="asis__campo">
          <span>Estado</span>
          <gi-select
            label="Estado de la asistencia"
            [options]="estados"
            [value]="draft().status"
            (valueChange)="cambiar('status', $any($event))"
          />
        </label>

        @if (draft().status !== 'Absent') {
          <div class="asis__horas">
            <label class="asis__campo">
              <span>Entrada</span>
              <input
                type="time"
                [value]="draft().actualStartTime ?? ''"
                (input)="cambiar('actualStartTime', $any($event.target).value || null)"
              />
            </label>
            <label class="asis__campo">
              <span>Salida</span>
              <input
                type="time"
                [value]="draft().actualEndTime ?? ''"
                (input)="cambiar('actualEndTime', $any($event.target).value || null)"
              />
            </label>
            <!--
               Los minutos sólo se piden con «Llegó tarde». Antes se pedían también con «Asistió», y
               así se podía guardar «asistió, con cinco minutos de retardo»: un registro que se
               contradice a sí mismo y que además no cuenta como excepción en ninguna parte. El
               retardo quedaba escrito y no se veía en ningún contador.
             -->
            @if (draft().status === 'Late') {
              <label class="asis__campo asis__campo--corto">
                <span>Minutos de retardo</span>
                <input
                  type="number"
                  min="0"
                  [value]="draft().minutesLate"
                  (input)="cambiar('minutesLate', +$any($event.target).value)"
                />
              </label>
            }
          </div>
          <p class="asis__pie">La hora se teclea: el registro digital de entrada no está en fase 1.</p>
        } @else {
          <p class="asis__pie">
            Una falta no lleva horas: no hubo entrada que registrar. Si la persona sí vino, cambia el
            estado.
          </p>
        }

        <label class="asis__campo">
          <span>Notas del turno <em>(opcional)</em></span>
          <textarea
            rows="2"
            [value]="draft().notes ?? ''"
            (input)="cambiar('notes', $any($event.target).value || null)"
          ></textarea>
        </label>
      </section>

      @if (isCorrection() && changed()) {
        <section class="asis__bloque asis__bloque--permiso">
          <h3 class="asis__titulo">Autorización para corregir</h3>
          <p class="asis__ayuda">
            Es el <strong>permiso previo</strong>: alguien más ya autorizó cambiar este registro. No
            es la explicación del cambio, que va abajo.
          </p>

          @if (approvals().length > 0) {
            <label class="asis__campo">
              <span>Autorización aprobada</span>
              <gi-select
                label="Autorización aprobada que permite esta corrección"
                [options]="approvals()"
                [value]="draft().idApprovalRequest ?? ''"
                (valueChange)="cambiar('idApprovalRequest', $event || null)"
              />
            </label>
          } @else {
            <p class="asis__falta">
              No hay ninguna autorización aprobada que apunte a este registro, así que no se puede
              corregir todavía.
              <button type="button" class="asis__link" (click)="requestApproval.emit()">
                Solicitar la autorización
              </button>
            </p>
          }
        </section>
      }

      @if (needsReason()) {
        <section class="asis__bloque asis__bloque--motivo">
          <h3 class="asis__titulo">Motivo de la corrección</h3>
          <p class="asis__ayuda">
            Es <strong>qué se hizo y por qué</strong>, y queda en la bitácora del registro. Se pide
            porque el día ya está cerrado. No sustituye a la autorización.
          </p>

          <label class="asis__campo">
            <span>Por qué se corrige</span>
            <textarea
              rows="3"
              [value]="draft().correctionReason ?? ''"
              (input)="cambiar('correctionReason', $any($event.target).value || null)"
              [attr.aria-describedby]="motivoCorto() ? 'asis-motivo' : null"
            ></textarea>
          </label>

          @if (motivoCorto()) {
            <p class="asis__problema" id="asis-motivo">
              Escribe al menos {{ minLength }} caracteres. Van {{ largoMotivo() }}.
            </p>
          }
        </section>
      }

      @if (problema()) {
        <p class="asis__problema" id="asis-problema">{{ problema() }}</p>
      }

      <div class="asis__acciones">
        <button class="asis__cancelar" type="button" (click)="cancel.emit()">Cancelar</button>
        <button
          class="asis__guardar"
          type="submit"
          [disabled]="!!problema() || saving()"
          [attr.aria-describedby]="problema() ? 'asis-problema' : null"
        >
          {{ isCorrection() ? 'Guardar la corrección' : 'Registrar la asistencia' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; }

    .asis { display: flex; flex-direction: column; gap: 0.85rem; }

    .asis__quien { display: flex; flex-direction: column; gap: 0.15rem; margin: 0; font-size: 12.5px; }
    .asis__quien strong { color: var(--gestia-text); }
    .asis__quien span { color: var(--gestia-muted); font-size: 11.5px; }

    .asis__bloque {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    /* Los dos bloques delicados se distinguen entre sí, no sólo del resto. */
    .asis__bloque--permiso { border-left: 3px solid var(--gestia-info); }
    .asis__bloque--motivo { border-left: 3px solid var(--gestia-warning); }

    .asis__titulo { margin: 0; color: var(--gestia-navy); font-size: 12.5px; font-weight: 700; }
    .asis__ayuda { margin: 0; color: var(--gestia-muted); font-size: 11.5px; line-height: 1.5; }
    .asis__ayuda strong { color: var(--gestia-text); }
    .asis__pie { margin: 0; color: var(--gestia-muted); font-size: 11px; line-height: 1.5; }

    .asis__campo { display: flex; flex-direction: column; gap: 0.25rem; font-size: 12px; }
    .asis__campo > span { color: var(--gestia-muted); font-weight: 600; }
    .asis__campo em { font-style: normal; font-weight: 400; }

    .asis__campo input,
    .asis__campo textarea {
      padding: 0.5rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .asis__campo input { height: var(--gestia-control-height); }
    .asis__campo textarea { resize: vertical; }

    .asis__horas { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .asis__campo--corto input { width: 7rem; }

    .asis__falta { margin: 0; color: var(--gestia-warning); font-size: 11.5px; line-height: 1.5; }
    .asis__problema { margin: 0; color: var(--gestia-warning); font-size: 11.5px; }

    .asis__link {
      border: none;
      background: none;
      padding: 0;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .asis__acciones { display: flex; justify-content: flex-end; gap: 0.75rem; }

    .asis__cancelar,
    .asis__guardar {
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border-radius: var(--gestia-radius);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .asis__cancelar {
      border: 1px solid var(--gestia-border);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    .asis__guardar {
      border: 1px solid var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .asis__guardar[disabled] { opacity: 0.5; cursor: not-allowed; }

    .asis__link:focus-visible,
    .asis__cancelar:focus-visible,
    .asis__guardar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class AttendanceForm {
  readonly row = input.required<AttendanceRow>();

  /** Si el día está cerrado. Es lo que decide si se pide el motivo, y sólo eso. */
  readonly dayClosed = input(false);

  /** Autorizaciones aprobadas que apuntan a este registro. */
  readonly approvals = input<readonly GiSelectOption[]>([]);

  readonly saving = input(false);

  readonly save = output<AttendanceDraft>();
  readonly cancel = output<void>();
  readonly requestApproval = output<void>();

  protected readonly estados = ESTADOS;
  protected readonly minLength = GI_REASON_MIN_LENGTH;

  /** Corregir es escribir sobre algo capturado. Capturar por primera vez no lo es. */
  protected readonly isCorrection = computed(() => this.row().record !== null);

  /**
   * El borrador arranca con lo que ya está capturado, si lo hay.
   *
   * <p>Corregir es partir de lo que dice el registro, no de una hoja en blanco: empezar vacío
   * obligaría a reescribir lo que no se está cambiando, y cualquier olvido se guardaría como una
   * corrección que nadie hizo.</p>
   *
   * <p>Es un <c>linkedSignal</c> y no un <c>signal</c> con inicialización: la fila puede cambiar
   * mientras el panel está abierto —se toca otra excepción de la lista—, y con un signal simple el
   * formulario seguiría mostrando el turno anterior. <b>La autorización y el motivo se reinician a
   * vacío en cada turno</b>, porque son de esa corrección y no del panel.</p>
   */
  protected readonly draft = linkedSignal<AttendanceRow, AttendanceDraft>({
    source: this.row,
    computation: (row) => ({
      status: row.record?.status ?? 'Present',
      actualStartTime: row.record?.actualStartTime?.slice(0, 5) ?? null,
      actualEndTime: row.record?.actualEndTime?.slice(0, 5) ?? null,
      // Los minutos sólo pertenecen a un retardo. Si el registro guardado dice otra cosa —los hubo
      // mientras el formulario los pedía con cualquier estado— no se arrastran en silencio: se
      // muestran en cero, que es lo que el estado del registro afirma.
      minutesLate: row.record?.status === 'Late' ? row.record.minutesLate : 0,
      notes: row.record?.notes ?? null,
      idApprovalRequest: null,
      correctionReason: null,
    }),
  });

  /**
   * Si los datos del turno cambiaron respecto de lo capturado.
   *
   * <p>Es la misma comparación que hace `AttendanceChanged` en el servidor —estado, horas, minutos
   * y notas—, repetida aquí para poder <b>pedir la autorización antes</b> de que el servidor
   * rechace el guardado. Guardar lo mismo que ya estaba no es corregir, y no debe pedir permiso.</p>
   */
  protected readonly changed = computed(() => {
    const record = this.row().record;

    if (!record) {
      return false;
    }

    const draft = this.draft();

    return (
      record.status !== draft.status ||
      (record.actualStartTime?.slice(0, 5) ?? null) !== draft.actualStartTime ||
      (record.actualEndTime?.slice(0, 5) ?? null) !== draft.actualEndTime ||
      record.minutesLate !== draft.minutesLate ||
      (record.notes ?? null) !== draft.notes
    );
  });

  /** El motivo depende del cierre del día, no de si cambió el dato. Son reglas independientes. */
  protected readonly needsReason = computed(() => this.isCorrection() && this.dayClosed());

  protected readonly largoMotivo = computed(() => (this.draft().correctionReason ?? '').trim().length);
  protected readonly motivoCorto = computed(
    () => this.needsReason() && this.largoMotivo() < GI_REASON_MIN_LENGTH,
  );

  /**
   * Qué falta para poder guardar. Cadena vacía significa que ya se puede.
   *
   * <p>El orden dice cuál se resuelve primero, y no es arbitrario: sin autorización no hay nada que
   * explicar, así que el permiso va antes que el motivo.</p>
   */
  protected readonly problema = computed(() => {
    const draft = this.draft();

    if (draft.status !== 'Absent' && !draft.actualStartTime) {
      return 'Falta la hora de entrada. Si la persona no se presentó, marca que no se presentó.';
    }

    if (draft.minutesLate < 0) {
      return 'Los minutos de retardo no pueden ser negativos.';
    }

    if (this.isCorrection() && this.changed() && !draft.idApprovalRequest) {
      return this.approvals().length === 0
        ? 'Corregir una asistencia ya capturada necesita una autorización aprobada, y no hay ninguna para este registro.'
        : 'Elige la autorización aprobada que permite esta corrección.';
    }

    if (this.motivoCorto()) {
      return `El día está cerrado: escribe el motivo de la corrección, de al menos ${GI_REASON_MIN_LENGTH} caracteres.`;
    }

    return '';
  });

  protected cambiar<K extends keyof AttendanceDraft>(campo: K, valor: AttendanceDraft[K]): void {
    const siguiente = { ...this.draft(), [campo]: valor };

    // Una falta no lleva horas ni minutos de retardo: no hubo entrada que registrar. Dejarlos
    // puestos guardaría una falta con hora de entrada, que es una contradicción que el reporte
    // heredaría sin poder explicarla.
    if (siguiente.status === 'Absent') {
      this.draft.set({ ...siguiente, actualStartTime: null, actualEndTime: null, minutesLate: 0 });
      return;
    }

    // Y quien asistió no llegó tarde: si llegó tarde, el estado lo dice. Sin esto quedaban minutos
    // de retardo colgados de un «Asistió» —un retardo que no cuenta como excepción ni aparece en
    // ningún contador— sólo porque el estado se cambió después de teclear los minutos.
    this.draft.set(
      siguiente.status === 'Late' ? siguiente : { ...siguiente, minutesLate: 0 },
    );
  }

  protected guardar(): void {
    if (this.problema() || this.saving()) {
      return;
    }

    const draft = this.draft();

    this.save.emit({
      ...draft,
      notes: draft.notes?.trim() || null,
      correctionReason: draft.correctionReason?.trim() || null,
    });
  }
}
