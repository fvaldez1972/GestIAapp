/**
 * El catálogo de patrones de turno.
 *
 * <p>Hasta ahora el patrón se capturaba dentro de cada posición y sus días se declaraban por día de
 * la semana, así que sólo cabían ciclos semanales: un 24x48 es un ciclo de tres días y no se podía
 * expresar. Aquí el patrón se captura una vez, con la longitud de su ciclo, y la posición lo elige
 * de un desplegable.</p>
 */

/** Con qué luz se trabaja el turno. Decide, entre otras cosas, si aplica prima nocturna. */
export type ShiftDaypart = 'Day' | 'Night' | 'Mixed' | 'Rotating';

export const SHIFT_DAYPART_LABELS: Readonly<Record<ShiftDaypart, string>> = {
  Day: 'Diurno',
  Night: 'Nocturno',
  Mixed: 'Mixto',
  Rotating: 'Rotativo',
};

export const SHIFT_DAYPARTS: readonly { readonly value: ShiftDaypart; readonly label: string }[] = [
  { value: 'Day', label: 'Diurno' },
  { value: 'Night', label: 'Nocturno' },
  { value: 'Mixed', label: 'Mixto' },
  { value: 'Rotating', label: 'Rotativo' },
];

export const shiftDaypartLabel = (daypart: ShiftDaypart): string =>
  SHIFT_DAYPART_LABELS[daypart] ?? daypart;

/** Cómo queda el patrón frente al límite legal de jornada semanal. */
export type WeeklyHoursCompliance = 'Compliant' | 'Exceeds';

export type ShiftPatternTemplateDay = {
  readonly idShiftPatternTemplateDay: string;
  readonly cycleDayNumber: number;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly isRest: boolean;
  /** Se deduce del horario: si la hora de fin no es mayor que la de inicio, el turno cruza. */
  readonly isOvernight: boolean;
  readonly durationMinutes: number;
};

export type ShiftPatternTemplate = {
  readonly idShiftPatternTemplate: string;
  readonly name: string;
  readonly description: string | null;
  readonly daypart: ShiftDaypart;
  readonly cycleDays: number;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly active: boolean;
  readonly days: readonly ShiftPatternTemplateDay[];
  /** Si todos los días del ciclo están declarados. Un día sin declarar no es un descanso. */
  readonly isComplete: boolean;
  readonly restDays: number;
  readonly weeklyHours: number;
  /** El límite legal contra el que se juzgó, para que la pantalla diga contra qué mide. */
  readonly weeklyLimit: number;
  readonly compliance: WeeklyHoursCompliance;
  readonly excessHours: number;
  readonly restDescription: string;
};

export type ShiftPatternTemplateDayInput = {
  readonly cycleDayNumber: number;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly isRest: boolean;
};

export type ShiftPatternTemplateInput = {
  readonly idOrganization: string;
  readonly name: string;
  readonly description: string | null;
  readonly daypart: ShiftDaypart;
  readonly cycleDays: number;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly days: readonly ShiftPatternTemplateDayInput[];
};

/** Lo mínimo para ofrecer el patrón en el desplegable de una posición. */
export type ShiftPatternTemplateOption = {
  readonly idShiftPatternTemplate: string;
  readonly name: string;
  readonly daypart: ShiftDaypart;
  readonly cycleDays: number;
  readonly weeklyHours: number;
  readonly compliance: WeeklyHoursCompliance;
  readonly excessHours: number;
};

/**
 * Cuánto dura un turno, en minutos, con el cruce de medianoche deducido igual que en el servidor.
 *
 * <p><b>Esto es una vista previa, no la regla.</b> El servidor vuelve a calcularlo y es el que
 * manda; aquí sólo sirve para que quien captura vea las horas antes de guardar, en lugar de
 * guardar a ciegas y descubrir después que el patrón excede.</p>
 */
export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const minutos = (valor: string) => {
    const [horas, minutos] = valor.split(':');
    return Number(horas) * 60 + Number(minutos);
  };

  const inicio = minutos(startTime);
  const fin = minutos(endTime);
  return fin <= inicio ? 24 * 60 - inicio + fin : fin - inicio;
}

/** Si el turno cruza la medianoche. Se deduce; no se pregunta. */
export const crossesMidnight = (startTime: string, endTime: string): boolean =>
  startTime.slice(0, 5) >= endTime.slice(0, 5);

/** Las horas por semana que declara un ciclo: horas del ciclo x 7 / días del ciclo. */
export function weeklyHoursOf(cycleWorkMinutes: number, cycleDays: number): number {
  if (cycleDays < 1) return 0;
  return Math.round(((cycleWorkMinutes * 7) / (cycleDays * 60)) * 100) / 100;
}

/** Las horas de un turno con el formato corto que se lee en la tabla: `12 h`, `7.5 h`. */
export const formatHours = (minutes: number): string =>
  `${Math.round((minutes / 60) * 100) / 100} h`;
