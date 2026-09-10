import {
  ScheduledShift,
  ServiceAssignment,
  ServicePosition,
  ShiftSegment,
} from '../../clients/data-access/client.models';
import { GiCandidate } from '../../../shared/ui/gi-ui';
import { operationalDatesBetween, shiftOperationalDate } from '../../../shared/util/operational-date';

/**
 * Qué pasa en una posición un día concreto.
 *
 * <p><b>`noShift` y `undeclared` son el mismo dato en la base, y aquí se separan con la única
 * distinción que el modelo permite hoy.</b> Un descanso es la ausencia de un segmento, así que
 * «el domingo descansa» y «nadie configuró el domingo» son indistinguibles mirando ese día. Lo que
 * sí se puede distinguir es el caso completo: si la posición **no tiene ningún segmento en toda la
 * semana**, nadie configuró nada y eso es `undeclared`. Si el patrón sí declara otros días, el día
 * vacío es lo más parecido a una decisión que el modelo sabe expresar, y es `noShift`.</p>
 *
 * <p>La distinción de verdad —descanso declarado frente a día sin declarar— necesita el patrón con
 * ancla, que depende de tres preguntas de negocio abiertas. Hasta entonces esto es lo honesto: no
 * llamar «descanso» a lo que nadie declaró.</p>
 */
export type PlanningCellKind = 'covered' | 'short' | 'noShift' | 'undeclared';

export type PlanningCell = {
  readonly date: string;
  readonly kind: PlanningCellKind;
  readonly requiredWorkerCount: number;
  readonly assignedWorkerCount: number;
  /** `07–19`, o cadena vacía cuando no hay turno ese día. */
  readonly timeRange: string;
  readonly people: readonly string[];
};

export type PlanningRow = {
  readonly idPosition: string;
  readonly codePosition: string;
  readonly name: string;
  readonly requiredWorkerCount: number;
  readonly cells: readonly PlanningCell[];
};

/**
 * Lo que impide publicar, o lo que conviene mirar antes de hacerlo.
 *
 * <p>`blocking` decide si el botón de publicar se puede usar. Lo que no bloquea igual se enseña:
 * publicar una semana con huecos es una decisión legítima —alguien tiene que cubrirlos— pero no
 * debería tomarse sin verlos.</p>
 */
export type PlanningConflict = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly blocking: boolean;
};

/** `Monday` … `Sunday`, como los devuelve el servidor en `ShiftSegment.dayOfWeek`. */
const DIAS_SERVIDOR = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * El día de la semana de un día operativo, en el vocabulario del servidor.
 *
 * <p>Se calcula en UTC por la misma razón que toda la aritmética de días de negocio: leerlo con la
 * hora local devuelve el día anterior en husos al oeste de Greenwich, y el jueves se convertiría en
 * miércoles sin que nadie lo note.</p>
 */
export function serverDayOfWeek(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return '';
  }

  const [year, month, day] = isoDate.split('-').map(Number);

  return DIAS_SERVIDOR[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/**
 * El lunes de la semana que contiene ese día.
 *
 * <p>La semana empieza en lunes porque así la dibuja el bosquejo y así la lee la operación, no
 * porque `getUTCDay()` lo diga: ahí el domingo es 0, y usarlo tal cual pondría el domingo al
 * principio. La resta de abajo corrige eso a propósito.</p>
 *
 * <p>La resta la hace <c>shiftOperationalDate</c> en vez de repetirse aquí. No es sólo evitar
 * duplicado: esa función ya resuelve la aritmética en UTC con su razón escrita, y reimplementarla
 * con <c>toISOString()</c> es exactamente lo que la prueba de <c>context-inheritance</c> prohíbe,
 * porque es la forma en que el día se corría en diez pantallas a la vez.</p>
 */
export function mondayOfWeek(isoDate: string): string {
  const dia = DIAS_SERVIDOR.indexOf(serverDayOfWeek(isoDate));

  if (dia < 0) {
    return '';
  }

  // El domingo es 0 en el vocabulario del servidor, así que restarlo tal cual pondría el domingo
  // al principio de la semana. Esto lo corre para que el lunes sea 0 y el domingo 6.
  const desdeElLunes = (dia + 6) % 7;

  return shiftOperationalDate(isoDate, -desdeElLunes);
}

/** `07:00:00` → `07`. Sin minutos cuando son cero, que es el caso normal de un turno. */
function hora(time: string): string {
  const [h, m] = time.split(':');

  return m && m !== '00' ? `${h}:${m}` : h;
}

/**
 * Compone el calendario de la semana con lo que ya existe: las posiciones, los segmentos de sus
 * patrones y los turnos de la versión.
 *
 * <p><b>Se arma en el navegador y no lo devuelve el servidor</b>, igual que hoy. No hace falta un
 * endpoint nuevo: las tres consultas ya existen y componerlas aquí deja la proyección visible y
 * comprobable sin base de datos, que es lo que permite probar los cuatro estados de celda sin
 * montar nada.</p>
 */
export function buildPlanningWeek(options: {
  readonly positions: readonly ServicePosition[];
  readonly segments: ReadonlyMap<string, readonly ShiftSegment[]>;
  readonly shifts: readonly ScheduledShift[];
  readonly weekStart: string;
  readonly weekEnd: string;
}): readonly PlanningRow[] {
  const dias = operationalDatesBetween(options.weekStart, options.weekEnd);

  return options.positions
    .filter((position) => position.active)
    .map((position) => {
      const segmentos = (options.segments.get(position.idPosition) ?? []).filter((s) => s.active);
      const sinDeclarar = segmentos.length === 0;

      const cells = dias.map((date): PlanningCell => {
        const delDia = segmentos.filter((s) => s.dayOfWeek === serverDayOfWeek(date));

        if (delDia.length === 0) {
          return {
            date,
            kind: sinDeclarar ? 'undeclared' : 'noShift',
            requiredWorkerCount: 0,
            assignedWorkerCount: 0,
            timeRange: '',
            people: [],
          };
        }

        const required = delDia.reduce((total, s) => total + s.requiredWorkerCount, 0);
        const delDiaTurnos = options.shifts.filter(
          (shift) => shift.idPosition === position.idPosition && shift.shiftDate === date,
        );
        const people = delDiaTurnos.map((shift) => shift.employeeName);

        return {
          date,
          kind: people.length >= required ? 'covered' : 'short',
          requiredWorkerCount: required,
          assignedWorkerCount: people.length,
          timeRange: `${hora(delDia[0].startTime)}–${hora(delDia[0].endTime)}`,
          people,
        };
      });

      return {
        idPosition: position.idPosition,
        codePosition: position.codePosition,
        name: position.name,
        requiredWorkerCount: position.requiredWorkerCount,
        cells,
      };
    });
}

/**
 * Lo que hay que mirar antes de publicar.
 *
 * <p><b>Sólo bloquea lo que haría inservible la versión publicada</b>: un servicio sin ninguna
 * posición, una semana sin ningún turno proyectado, o una posición de la que nadie declaró nada. Los huecos de cobertura <b>no</b>
 * bloquean: una semana con huecos es una semana normal a la que le falta gente, y publicarla es lo
 * que permite que Asistencia y Cobertura empiecen a trabajar sobre ella. Bloquear ahí obligaría a
 * inventar asignaciones para poder publicar.</p>
 */
export function planningConflicts(rows: readonly PlanningRow[]): readonly PlanningConflict[] {
  // El caso más vacío de todos, y va primero porque ninguna de las dos comprobaciones de abajo lo
  // ve: cero posiciones no dispara «no proyecta ningún turno» —no hay ninguna que deje de
  // proyectar— y la comprobación de la semana vacía exigía además `rows.length > 0`. Se colaba
  // entre las dos y devolvía cero conflictos, que el panel de publicar lee como «se puede
  // publicar»: el botón quedaba encendido sobre el resumen «0 turnos en 0 posiciones».
  if (rows.length === 0) {
    return [
      {
        id: 'no-positions',
        title: 'El servicio todavía no tiene ninguna posición',
        detail:
          'La posición es lo que se planea, y existe con independencia de quien la ocupe. Sin ' +
          'ninguna declarada no hay semana que publicar: declara la primera posición del servicio ' +
          'y sus turnos.',
        blocking: true,
      },
    ];
  }

  const conflicts: PlanningConflict[] = [];

  const sinDeclarar = rows.filter((row) => row.cells.every((cell) => cell.kind === 'undeclared'));

  for (const row of sinDeclarar) {
    conflicts.push({
      id: `undeclared:${row.idPosition}`,
      title: `${row.codePosition} no tiene ningún turno declarado`,
      detail:
        'Sin segmentos en su patrón, la posición no proyecta nada y la semana publicada no la va a ' +
        'incluir. Declara sus turnos o desactívala si ya no opera.',
      blocking: true,
    });
  }

  const conTurnos = rows.some((row) => row.cells.some((cell) => cell.kind !== 'undeclared' && cell.kind !== 'noShift'));

  if (!conTurnos) {
    conflicts.push({
      id: 'empty-week',
      title: 'La semana no proyecta ningún turno',
      detail:
        'Ninguna posición declara turnos en estos siete días. Publicar dejaría a Asistencia sin ' +
        'nada contra qué medir.',
      blocking: true,
    });
  }

  const huecos = rows.flatMap((row) =>
    row.cells
      .filter((cell) => cell.kind === 'short')
      .map((cell) => ({ row, cell })),
  );

  if (huecos.length > 0) {
    const faltan = huecos.reduce(
      (total, { cell }) => total + (cell.requiredWorkerCount - cell.assignedWorkerCount),
      0,
    );

    conflicts.push({
      id: 'coverage-gaps',
      title:
        huecos.length === 1
          ? 'Un turno queda con menos gente de la que pide'
          : `${huecos.length} turnos quedan con menos gente de la que piden`,
      detail:
        `Faltan ${faltan} ${faltan === 1 ? 'elemento' : 'elementos'} en total. No impide publicar: ` +
        'una semana con huecos es una semana normal a la que le falta gente, y publicarla es lo que ' +
        'deja a Cobertura resolverlos.',
      blocking: false,
    });
  }

  return conflicts;
}

/**
 * Quién puede tomar un turno que falta.
 *
 * <p><b>Nadie queda fuera de la lista</b>, y las dos exclusiones que había se quitaron por razones
 * distintas. El <b>traslape</b> se permite por decisión de negocio: el supervisor con un turno
 * descubierto va a mover a alguien de todos modos, y si el sistema no lo deja, lo mueve por
 * teléfono y el sistema queda mintiendo sobre dónde está la gente. El <b>puesto desconocido</b>
 * dejó de bloquear cuando la comparación pasó de texto libre a identificador: «no sabemos su
 * puesto» no es «no cumple el perfil».</p>
 *
 * <p>Con la condición que acompaña a la decisión: <b>el aviso nombra la consecuencia</b>. Decir
 * «hay traslape» sin decir qué posición queda corta es un botón de continuar con otra redacción.</p>
 *
 * <p>Quien ya está en <i>este</i> turno no aparece: no es un candidato, ya está puesto.</p>
 */
/**
 * El veredicto del servidor sobre una persona, tal como lo devuelve la comprobación de
 * elegibilidad. Lo que la pantalla necesita de él es si cumple y, cuando no, por qué.
 */
export type CandidateEligibility = {
  readonly isEligible: boolean;
  readonly blockingReasons: readonly string[];
};

export function buildCandidates(options: {
  readonly assignments: readonly ServiceAssignment[];
  readonly shifts: readonly ScheduledShift[];
  readonly idPosition: string;
  readonly date: string;
  /**
   * Lo que el servidor contestó, por identificador de empleado.
   *
   * <p><b>Sin este mapa nadie sale como «Elegible».</b> Antes esta función lo afirmaba sola: si la
   * asignación traía puesto, la persona quedaba marcada como elegible sin haber consultado un solo
   * requisito. Las reglas —documentos vigentes, habilidades, evaluaciones— viven en el servidor y
   * es él quien las hace cumplir; repetirlas aquí de memoria es lo que el principio 5 prohíbe, y
   * encima da una respuesta que puede no coincidir con la suya.</p>
   *
   * <p>Cuando falta el dato, o falta la persona dentro de él, el resultado es «Sin comprobar», no
   * «Elegible». No es lo mismo no saber que saber que sí.</p>
   */
  readonly eligibility?: ReadonlyMap<string, CandidateEligibility>;
}): readonly GiCandidate[] {
  const delDia = options.shifts.filter((shift) => shift.shiftDate === options.date);
  const otroTurnoDe = new Map(
    delDia.filter((shift) => shift.idPosition !== options.idPosition).map((s) => [s.idEmployee, s]),
  );
  const yaPuestos = new Set(
    delDia.filter((shift) => shift.idPosition === options.idPosition).map((s) => s.idEmployee),
  );

  return options.assignments
    .filter((assignment) => assignment.active && !yaPuestos.has(assignment.idEmployee))
    .map((assignment): GiCandidate => {
      const otro = otroTurnoDe.get(assignment.idEmployee);

      if (otro) {
        return {
          id: assignment.idEmployee,
          name: assignment.employeeName,
          role: assignment.positionName ?? 'Sin puesto registrado',
          availability: `Cubre ${otro.positionCode} ese día, ${otro.startTime.slice(0, 5)}–${otro.endTime.slice(0, 5)}`,
          standing: 'overlap',
          consequence: `Al elegirlo, ${otro.positionCode} queda con un elemento menos ese día: el hueco se mueve, no desaparece.`,
        };
      }

      if (!assignment.idPosition) {
        return {
          id: assignment.idEmployee,
          name: assignment.employeeName,
          role: 'Sin puesto registrado',
          availability: 'Sin turno ese día',
          standing: 'review',
          consequence:
            'No sabemos su puesto, así que no se puede comprobar contra el perfil de la posición. ' +
            'No queda bloqueado: conviene completar su ficha en Personal.',
        };
      }

      const veredicto = options.eligibility?.get(assignment.idEmployee);

      if (!veredicto) {
        return {
          id: assignment.idEmployee,
          name: assignment.employeeName,
          role: assignment.positionName ?? '',
          availability: 'Sin turno ese día',
          standing: 'unchecked',
        };
      }

      if (!veredicto.isEligible) {
        return {
          id: assignment.idEmployee,
          name: assignment.employeeName,
          role: assignment.positionName ?? '',
          availability: 'Sin turno ese día',
          standing: 'blocked',
          // El motivo va entero. «No cumple» a secas deja a quien asigna sin nada que hacer al
          // respecto, y no queda claro si el problema se arregla en Personal o en Catálogos.
          consequence:
            veredicto.blockingReasons.length > 0
              ? veredicto.blockingReasons.join(' · ')
              : 'El servidor no lo considera elegible para esta posición.',
        };
      }

      return {
        id: assignment.idEmployee,
        name: assignment.employeeName,
        role: assignment.positionName ?? '',
        availability: 'Sin turno ese día',
        standing: 'eligible',
      };
    });
}
