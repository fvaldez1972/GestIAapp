import {
  AttendanceRecord,
  AttendanceStatus,
  OperationDayClosure,
  ScheduledShift,
  ServicePosition,
} from '../../clients/data-access/client.models';
import { GiDayState } from '../../../shared/ui/gi-ui';

/**
 * Un turno del día, con lo planeado y lo real uno al lado del otro.
 *
 * <p><b>`record` en nulo no es una falta: es que nadie ha capturado nada.</b> La diferencia importa
 * más de lo que parece. Una falta es un hecho —la persona no se presentó— y abre una incidencia; un
 * turno sin capturar es trabajo pendiente del supervisor. Pintarlos igual convertiría cada turno no
 * capturado en una falta que nadie cometió.</p>
 */
export type AttendanceRow = {
  readonly idScheduledShift: string;
  /** La posición del turno. Cobertura la necesita para preguntar quién cumple sus requisitos. */
  readonly idPosition: string;
  readonly idEmployee: string;
  readonly employeeName: string;
  readonly employeeCode: string;
  readonly positionCode: string;
  readonly positionName: string;
  /** `07:00 – 19:00`, del turno publicado. */
  readonly planned: string;
  /** Lo que se capturó, o cómo se dice que todavía no. */
  readonly actual: string;
  readonly status: AttendanceStatus | null;
  readonly minutesLate: number;
  readonly record: AttendanceRecord | null;
};

/**
 * Una posición que pide más gente de la que tiene turnos publicados ese día.
 *
 * <p><b>No es una falta de nadie</b>: no hay persona a la que registrarle una asistencia, porque
 * nunca se le asignó el turno. Se resuelve en Cobertura, y por eso viaja aparte de las filas.</p>
 */
export type AttendanceGap = {
  readonly idPosition: string;
  readonly positionCode: string;
  readonly positionName: string;
  readonly requiredWorkerCount: number;
  readonly scheduledCount: number;
};

export type AttendanceDay = {
  readonly rows: readonly AttendanceRow[];
  readonly gaps: readonly AttendanceGap[];
};

const SIN_CAPTURA = 'Sin capturar';

/** `07:00:00` → `07:00`. Los segundos no dicen nada de un turno. */
const hhmm = (time: string) => time.slice(0, 5);

/**
 * Cómo se lee lo real de un turno.
 *
 * <p>El turno que sigue en curso dice que la salida se registra al cierre, en vez de dejar un
 * guion que se confunde con «no vino».</p>
 */
function real(record: AttendanceRecord | null): string {
  if (!record) {
    return SIN_CAPTURA;
  }

  if (record.status === 'Absent') {
    return 'Sin registro de entrada';
  }

  if (!record.actualStartTime) {
    return SIN_CAPTURA;
  }

  return record.actualEndTime
    ? `${hhmm(record.actualStartTime)} – ${hhmm(record.actualEndTime)}`
    : `${hhmm(record.actualStartTime)} – pendiente`;
}

/**
 * El día de asistencia: un renglón por turno publicado, más los huecos de las posiciones.
 *
 * <p><b>Se arma sobre los turnos publicados y no sobre las asistencias capturadas.</b> Es la
 * diferencia entre «qué debía pasar hoy» y «qué se alcanzó a escribir»: si la lista saliera de las
 * asistencias, un turno que nadie capturó simplemente no aparecería, y lo que hay que ver es
 * precisamente ése.</p>
 */
export function buildAttendanceDay(options: {
  readonly shifts: readonly ScheduledShift[];
  readonly records: readonly AttendanceRecord[];
  readonly positions: readonly ServicePosition[];
  readonly date: string;
}): AttendanceDay {
  const delDia = options.shifts.filter((shift) => shift.active && shift.shiftDate === options.date);
  const porTurno = new Map(
    options.records
      .filter((record) => record.active && record.attendanceDate === options.date)
      .map((record) => [record.idScheduledShift, record]),
  );

  const rows = delDia.map((shift): AttendanceRow => {
    const record = porTurno.get(shift.idScheduledShift) ?? null;

    return {
      idScheduledShift: shift.idScheduledShift,
      idPosition: shift.idPosition,
      idEmployee: shift.idEmployee,
      employeeName: shift.employeeName,
      employeeCode: shift.employeeCode,
      positionCode: shift.positionCode,
      positionName: shift.positionName,
      planned: `${hhmm(shift.startTime)} – ${hhmm(shift.endTime)}`,
      actual: real(record),
      status: record?.status ?? null,
      minutesLate: record?.minutesLate ?? 0,
      record,
    };
  });

  const turnosPorPosicion = new Map<string, number>();

  for (const shift of delDia) {
    turnosPorPosicion.set(shift.idPosition, (turnosPorPosicion.get(shift.idPosition) ?? 0) + 1);
  }

  const gaps = options.positions
    .filter((position) => position.active)
    .map((position): AttendanceGap => {
      const scheduledCount = turnosPorPosicion.get(position.idPosition) ?? 0;

      return {
        idPosition: position.idPosition,
        positionCode: position.codePosition,
        positionName: position.name,
        requiredWorkerCount: position.requiredWorkerCount,
        scheduledCount,
      };
    })
    // Una posición sin ningún turno publicado ese día no es un hueco: es un día en que no opera.
    // Contarla como hueco llenaría la lista de falsos descubiertos cada domingo.
    .filter((gap) => gap.scheduledCount > 0 && gap.scheduledCount < gap.requiredWorkerCount);

  return { rows, gaps };
}

/** Las excepciones del día: lo que se salió de lo planeado, y sólo eso. */
export function attendanceExceptions(day: AttendanceDay): readonly AttendanceRow[] {
  return day.rows.filter((row) => row.status === 'Absent' || row.status === 'Late');
}

/**
 * Los turnos que nadie ha capturado.
 *
 * <p>Van aparte de las excepciones a propósito: <b>no capturar no es una excepción, es trabajo
 * pendiente</b>. Mezclarlos haría que el conteo de excepciones creciera al empezar el día y
 * bajara al capturar, que es justo al revés de lo que significa.</p>
 */
export function pendingAttendance(day: AttendanceDay): readonly AttendanceRow[] {
  return day.rows.filter((row) => row.record === null);
}

/**
 * El estado del día para la pieza del cierre.
 *
 * <p><b>«Abierto» es la ausencia de fila</b>, no un valor guardado: si no hay cierre para ese
 * servicio y esa fecha, el día está abierto. Por eso esto recibe el cierre o nulo, y no un estado
 * ya resuelto por quien llama.</p>
 */
export function dayState(closure: OperationDayClosure | null): GiDayState {
  if (!closure) {
    return 'open';
  }

  return closure.status === 'Reopened' ? 'reopened' : 'closed';
}

/**
 * Si corregir este día va a exigir motivo.
 *
 * <p>Es la misma regla del servidor —`CorrectionReasonPolicy.DayClosureRequirement`—: un día
 * cerrado lo exige, uno reabierto no, porque reabrirlo ya fue una decisión justificada por sí
 * misma. Se repite aquí para poder decirlo <b>antes</b> de que el usuario escriba, no después de
 * que el servidor lo rechace.</p>
 *
 * <p><b>Hueco conocido y decidido, pendiente de arreglar en el servidor.</b> Hoy el motivo sólo se
 * exige al <i>corregir</i>: `RequireCorrectionReasonAsync` vive en la rama de corrección de
 * `UpsertAttendanceAsync`, así que <b>capturar por primera vez una asistencia sobre un día ya
 * cerrado no pide motivo</b>. Debería pedirlo. El cierre congeló «N pendientes» en su foto, y esa
 * foto es lo que se concilia con el cliente: capturar una de esas después cambia lo que el cierre
 * afirmó. Que técnicamente no sea una corrección no quita que altere un dato ya reportado, y deja
 * una asimetría rara —corregir un dato en un día cerrado pide motivo, agregar uno que no existía
 * no, y es el segundo el que cambia el conteo—. El arreglo es de servidor y va con las tres cosas
 * chicas del final de la tanda; esta función se queda como está mientras tanto, para no mentir
 * sobre lo que el servidor hace.</p>
 */
export function correctionNeedsReason(closure: OperationDayClosure | null): boolean {
  return dayState(closure) === 'closed';
}
