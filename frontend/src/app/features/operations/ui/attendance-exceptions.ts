import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiExceptionRow, GiExceptionType } from '../../../shared/ui/gi-ui';
import { AttendanceGap, AttendanceRow } from '../data-access/attendance-day';

/** Lo que la pantalla necesita saber cuando se toca una excepción de persona. */
export type ExceptionPick = {
  readonly row: AttendanceRow;
  readonly kind: GiExceptionType;
};

/**
 * Lo que se salió de lo planeado.
 *
 * <p><b>El orden no es cronológico: es por lo que deja turnos al descubierto.</b> Primero las faltas
 * —el puesto quedó vacío—, después los huecos de posición, y al final los retardos, que documentan
 * algo pero no dejan a nadie sin cubrir. Ordenarlas por hora pondría un retardo de las 07:05 antes
 * de una falta de las 07:00, y quien abre la pantalla a media mañana necesita ver primero lo que
 * todavía puede resolver.</p>
 *
 * <p><b>Los huecos van en la misma lista pero no son faltas.</b> Nadie se ausentó: la posición pide
 * cuatro elementos y sólo tres tienen turno. Por eso su acción lleva a Cobertura y no a registrar
 * una incidencia, y el componente compartido rompe en desarrollo si alguien las confunde.</p>
 */
@Component({
  selector: 'app-attendance-exceptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiExceptionRow],
  template: `
    <section class="exc">
      <header class="exc__head">
        <span class="exc__title">LO QUE SE SALIÓ DE LO PLANEADO</span>
        <span class="exc__cuenta">{{ resumen() }}</span>
        <span class="exc__nota">Ordenadas por lo que deja turnos al descubierto</span>
      </header>

      @if (total() === 0) {
        <p class="exc__limpio">
          <span class="exc__pill">Cero real</span>
          Los {{ shiftCount() }} turnos del día se cumplieron como se publicaron. No es que falten
          datos: es que no hubo excepciones.
        </p>
      } @else {
        @for (falta of faltas(); track falta.idScheduledShift) {
          <gi-exception-row
            type="absence"
            [subject]="falta.employeeName"
            [meta]="falta.positionCode + ' · ' + falta.positionName"
            [planned]="falta.planned"
            [actual]="falta.actual"
            actionLabel="Registrar incidencia"
            [badge]="afterClosureBadge()"
            [consequence]="consecuenciaFalta"
            (act)="pick.emit({ row: falta, kind: 'absence' })"
          />
        }

        @for (hueco of gaps(); track hueco.idPosition) {
          <gi-exception-row
            type="gap"
            [subject]="hueco.positionCode + ' · ' + hueco.positionName"
            [meta]="hueco.requiredWorkerCount + ' requeridos · ' + hueco.scheduledCount + ' con turno'"
            [planned]="hueco.requiredWorkerCount + ' elementos'"
            actual="Nadie a quién registrar"
            actionLabel="Ver en cobertura"
            [consequence]="consecuenciaHueco"
            (act)="gapPick.emit(hueco)"
          />
        }

        @for (retardo of retardos(); track retardo.idScheduledShift) {
          <gi-exception-row
            type="late"
            [subject]="retardo.employeeName"
            [meta]="retardo.positionCode + ' · ' + retardo.positionName"
            [planned]="retardo.planned"
            [actual]="retardo.actual"
            [actualNote]="minutos(retardo)"
            actionLabel="Registrar incidencia"
            [badge]="afterClosureBadge()"
            [consequence]="consecuenciaRetardo"
            (act)="pick.emit({ row: retardo, kind: 'late' })"
          />
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .exc {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .exc__head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .exc__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }

    .exc__cuenta {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.45rem;
      background: var(--gestia-surface);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .exc__nota { margin-left: auto; color: var(--gestia-muted); font-size: 11.5px; }

    .exc__limpio {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin: 0;
      padding: 0.85rem;
      color: var(--gestia-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .exc__pill {
      border: 1px solid var(--gestia-success);
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.45rem;
      color: var(--gestia-success);
      font-size: 10.5px;
      font-weight: 600;
      flex: none;
    }
  `,
})
export class AttendanceExceptions {
  readonly rows = input.required<readonly AttendanceRow[]>();
  readonly gaps = input.required<readonly AttendanceGap[]>();
  readonly shiftCount = input(0);

  /**
   * Si el día ya está cerrado.
   *
   * <p>No bloquea nada: una incidencia sobre un día cerrado se permite, marcada como posterior al
   * cierre. La falta ocurrió, y si el sistema no la deja registrar se registra fuera del sistema y
   * el expediente del día queda incompleto justo en lo que importaba.</p>
   */
  readonly dayClosed = input(false);

  readonly pick = output<ExceptionPick>();
  readonly gapPick = output<AttendanceGap>();

  protected readonly consecuenciaFalta =
    'Una falta deja el turno al descubierto: la incidencia se registra y desde ahí se cubre o se ' +
    'declara sin cubrir.';

  protected readonly consecuenciaHueco =
    'No es una falta de nadie: la posición pide más elementos de los que tienen turno. Se resuelve ' +
    'en Cobertura.';

  protected readonly consecuenciaRetardo =
    'Se documenta siempre y el turno queda cubierto. No trae consecuencia por sí solo: la política ' +
    'de retardos se define por organización.';

  protected readonly afterClosureBadge = computed(() => (this.dayClosed() ? 'Posterior al cierre' : ''));

  protected readonly faltas = computed(() => this.rows().filter((row) => row.status === 'Absent'));
  protected readonly retardos = computed(() => this.rows().filter((row) => row.status === 'Late'));

  protected readonly total = computed(
    () => this.faltas().length + this.retardos().length + this.gaps().length,
  );

  protected readonly resumen = computed(() => {
    const total = this.total();

    if (total === 0) {
      return `0 de ${this.shiftCount()} turnos`;
    }

    return `${total} de ${this.shiftCount()} turnos`;
  });

  protected minutos(row: AttendanceRow): string {
    return row.minutesLate > 0 ? `${row.minutesLate} min de retardo` : '';
  }
}
