import {
  AttendanceRecord,
  AttendanceStatus,
  OperationDayClosure,
  ScheduledShift,
  ServicePosition,
} from '../../clients/data-access/client.models';
import {
  attendanceExceptions,
  buildAttendanceDay,
  correctionNeedsReason,
  dayState,
  pendingAttendance,
} from './attendance-day';

const DIA = '2026-09-10';

const turno = (id: string, idPosition: string, employeeName: string): ScheduledShift => ({
  idScheduledShift: id,
  idScheduleVersion: 'v-1',
  idPosition,
  positionCode: idPosition.toUpperCase(),
  positionName: `Posición ${idPosition}`,
  idEmployee: `emp-${employeeName}`,
  employeeCode: 'EMP-1',
  employeeName,
  shiftDate: DIA,
  startTime: '07:00:00',
  endTime: '19:00:00',
  isOvernight: false,
  durationMinutes: 720,
  notes: null,
  active: true,
});

const asistencia = (
  idScheduledShift: string,
  status: AttendanceStatus,
  extra: Partial<AttendanceRecord> = {},
): AttendanceRecord => ({
  idAttendanceRecord: `att-${idScheduledShift}`,
  idScheduledShift,
  idEmployee: 'emp-1',
  employeeCode: 'EMP-1',
  employeeName: 'Laura',
  attendanceDate: DIA,
  status,
  actualStartTime: '06:54:00',
  actualEndTime: '19:03:00',
  minutesLate: 0,
  notes: null,
  active: true,
  rowVersion: 'AAAAAAAAB9E=',
  ...extra,
});

const posicion = (id: string, required: number): ServicePosition => ({
  idPosition: id,
  idService: 'srv-1',
  codePosition: id.toUpperCase(),
  name: `Posición ${id}`,
  requiredWorkerCount: required,
  requiredSkillProfile: null,
  notes: null,
  active: true,
  monthlyPrice: 0,
  currencyCode: 'MXN',
  isTaxIncluded: false,
});

const cierre = (status: 'Closed' | 'Reopened'): OperationDayClosure => ({
  idOperationDayClosure: 'cl-1',
  idOrganization: 'org-1',
  idService: 'srv-1',
  operationDate: DIA,
  expectedShifts: 3,
  attendanceRecords: 3,
  pendingAttendance: 0,
  openIncidents: 0,
  coverageRecords: 0,
  notes: null,
  status,
  closedAt: '2026-09-10T21:14:00Z',
  closedByName: 'Renata Villaseñor',
  reopenedAt: null,
  reopenedByName: null,
  reopenReason: null,
  active: true,
  rowVersion: 'AAAAAAAAB9E=',
});

const dia = (options: {
  shifts?: readonly ScheduledShift[];
  records?: readonly AttendanceRecord[];
  positions?: readonly ServicePosition[];
}) =>
  buildAttendanceDay({
    shifts: options.shifts ?? [],
    records: options.records ?? [],
    positions: options.positions ?? [],
    date: DIA,
  });

describe('buildAttendanceDay', () => {
  /**
   * Se arma sobre los turnos PUBLICADOS y no sobre las asistencias capturadas. Si saliera de las
   * asistencias, un turno que nadie capturó no aparecería, y ése es justo el que hay que ver.
   */
  it('trae un renglón por turno publicado, aunque nadie haya capturado nada', () => {
    const { rows } = dia({ shifts: [turno('t-1', 'p-1', 'Laura'), turno('t-2', 'p-1', 'Óscar')] });

    expect(rows.map((row) => row.employeeName)).toEqual(['Laura', 'Óscar']);
    expect(rows.every((row) => row.record === null)).toBe(true);
  });

  /**
   * Sin capturar no es una falta. Una falta es un hecho y abre incidencia; un turno sin capturar es
   * trabajo pendiente del supervisor. Pintarlos igual convertiría cada turno no capturado en una
   * falta que nadie cometió.
   */
  it('un turno sin capturar dice «Sin capturar», no una falta', () => {
    const { rows } = dia({ shifts: [turno('t-1', 'p-1', 'Laura')] });

    expect(rows[0].actual).toBe('Sin capturar');
    expect(rows[0].status).toBeNull();
  });

  it('enseña lo planeado junto a lo real, sin segundos', () => {
    const { rows } = dia({
      shifts: [turno('t-1', 'p-1', 'Laura')],
      records: [asistencia('t-1', 'Present')],
    });

    expect(rows[0].planned).toBe('07:00 – 19:00');
    expect(rows[0].actual).toBe('06:54 – 19:03');
  });

  /** El turno en curso dice que la salida se registra al cierre, no un guion que parece «no vino». */
  it('un turno en curso lo dice, en vez de dejar la salida en blanco', () => {
    const { rows } = dia({
      shifts: [turno('t-1', 'p-1', 'Norma')],
      records: [asistencia('t-1', 'Present', { actualEndTime: null })],
    });

    expect(rows[0].actual).toBe('06:54 – pendiente');
  });

  it('una falta dice que no hubo registro de entrada', () => {
    const { rows } = dia({
      shifts: [turno('t-1', 'p-1', 'Laura')],
      records: [asistencia('t-1', 'Absent', { actualStartTime: null, actualEndTime: null })],
    });

    expect(rows[0].actual).toBe('Sin registro de entrada');
  });

  it('una asistencia de otro día no se mezcla', () => {
    const { rows } = dia({
      shifts: [turno('t-1', 'p-1', 'Laura')],
      records: [asistencia('t-1', 'Present', { attendanceDate: '2026-09-09' })],
    });

    expect(rows[0].record).toBeNull();
  });

  it('un registro desactivado no cuenta como capturado', () => {
    const { rows } = dia({
      shifts: [turno('t-1', 'p-1', 'Laura')],
      records: [asistencia('t-1', 'Present', { active: false })],
    });

    expect(rows[0].actual).toBe('Sin capturar');
  });

  describe('huecos', () => {
    it('marca la posición que pide más gente de la que tiene turnos', () => {
      const { gaps } = dia({
        shifts: [turno('t-1', 'p-1', 'Laura')],
        positions: [posicion('p-1', 4)],
      });

      expect(gaps).toHaveLength(1);
      expect(gaps[0].requiredWorkerCount).toBe(4);
      expect(gaps[0].scheduledCount).toBe(1);
    });

    /**
     * Una posición sin ningún turno ese día no opera ese día. Contarla como hueco llenaría la lista
     * de falsos descubiertos cada domingo.
     */
    it('una posición sin ningún turno ese día no es un hueco', () => {
      const { gaps } = dia({ shifts: [], positions: [posicion('p-1', 4)] });

      expect(gaps).toEqual([]);
    });

    it('una posición completa no es un hueco', () => {
      const { gaps } = dia({
        shifts: [turno('t-1', 'p-1', 'Laura'), turno('t-2', 'p-1', 'Óscar')],
        positions: [posicion('p-1', 2)],
      });

      expect(gaps).toEqual([]);
    });
  });
});

describe('attendanceExceptions y pendingAttendance', () => {
  const conTodo = () =>
    dia({
      shifts: [
        turno('t-1', 'p-1', 'Laura'),
        turno('t-2', 'p-1', 'Óscar'),
        turno('t-3', 'p-1', 'Jorge'),
        turno('t-4', 'p-1', 'Ana'),
      ],
      records: [
        asistencia('t-1', 'Present'),
        asistencia('t-2', 'Absent'),
        asistencia('t-3', 'Late', { minutesLate: 52 }),
      ],
    });

  it('las excepciones son la falta y el retardo, no lo demás', () => {
    const excepciones = attendanceExceptions(conTodo());

    expect(excepciones.map((row) => row.status)).toEqual(['Absent', 'Late']);
  });

  /**
   * No capturar no es una excepción, es trabajo pendiente. Mezclarlos haría que el conteo de
   * excepciones creciera al empezar el día y bajara al capturar, que es al revés de lo que
   * significa.
   */
  it('lo pendiente de capturar va aparte de las excepciones', () => {
    const pendientes = pendingAttendance(conTodo());

    expect(pendientes.map((row) => row.employeeName)).toEqual(['Ana']);
    expect(attendanceExceptions(conTodo()).map((row) => row.employeeName)).not.toContain('Ana');
  });
});

describe('dayState y correctionNeedsReason', () => {
  /** «Abierto» es la ausencia de fila, no un valor guardado. */
  it('sin cierre el día está abierto', () => {
    expect(dayState(null)).toBe('open');
    expect(correctionNeedsReason(null)).toBe(false);
  });

  it('un día cerrado exige motivo al corregir', () => {
    expect(dayState(cierre('Closed'))).toBe('closed');
    expect(correctionNeedsReason(cierre('Closed'))).toBe(true);
  });

  /** Reabrirlo ya fue una decisión justificada por sí misma, así que corregir vuelve a no pedirlo. */
  it('un día reabierto vuelve a no exigir motivo', () => {
    expect(dayState(cierre('Reopened'))).toBe('reopened');
    expect(correctionNeedsReason(cierre('Reopened'))).toBe(false);
  });
});
