import {
  ScheduledShift,
  ServiceAssignment,
  ServicePosition,
  ShiftSegment,
} from '../../clients/data-access/client.models';
import {
  buildCandidates,
  buildPlanningWeek,
  mondayOfWeek,
  planningConflicts,
  serverDayOfWeek,
} from './planning.models';

const LUNES = '2026-09-07';
const DOMINGO = '2026-09-13';

const posicion = (id: string, code: string, required = 2): ServicePosition => ({
  idPosition: id,
  idService: 'srv-1',
  codePosition: code,
  name: `Posición ${code}`,
  requiredWorkerCount: required,
  requiredSkillProfile: null,
  notes: null,
  active: true,
});

const segmento = (idPattern: string, dayOfWeek: string, required = 2): ShiftSegment => ({
  idShiftSegment: `seg-${idPattern}-${dayOfWeek}`,
  idShiftPattern: idPattern,
  dayOfWeek,
  startTime: '07:00:00',
  endTime: '19:00:00',
  isOvernight: false,
  requiredWorkerCount: required,
  durationMinutes: 720,
  notes: null,
  active: true,
});

const turno = (idPosition: string, shiftDate: string, employeeName: string): ScheduledShift => ({
  idScheduledShift: `sh-${idPosition}-${shiftDate}-${employeeName}`,
  idScheduleVersion: 'v-1',
  idPosition,
  positionCode: 'P-01',
  positionName: 'Posición P-01',
  idEmployee: `emp-${employeeName}`,
  employeeCode: 'EMP-1',
  employeeName,
  shiftDate,
  startTime: '07:00:00',
  endTime: '19:00:00',
  isOvernight: false,
  durationMinutes: 720,
  notes: null,
  active: true,
});

function semana(options: {
  positions: readonly ServicePosition[];
  segments?: ReadonlyMap<string, readonly ShiftSegment[]>;
  shifts?: readonly ScheduledShift[];
}) {
  return buildPlanningWeek({
    positions: options.positions,
    segments: options.segments ?? new Map(),
    shifts: options.shifts ?? [],
    weekStart: LUNES,
    weekEnd: DOMINGO,
  });
}

describe('serverDayOfWeek', () => {
  /**
   * Se calcula en UTC a propósito. Leer un día de negocio con la hora local devuelve el día
   * anterior en husos al oeste de Greenwich, y el jueves se volvería miércoles sin que nadie lo
   * note: el mismo corrimiento que costó nueve lugares del servidor y diez pantallas.
   */
  it('nombra el día en el vocabulario del servidor, sin que el huso intervenga', () => {
    expect(serverDayOfWeek('2026-09-07')).toBe('Monday');
    expect(serverDayOfWeek('2026-09-10')).toBe('Thursday');
    expect(serverDayOfWeek('2026-09-13')).toBe('Sunday');
  });

  it('devuelve vacío si no le dan un día de negocio', () => {
    expect(serverDayOfWeek('2026-09-10T18:00:00Z')).toBe('');
    expect(serverDayOfWeek('')).toBe('');
  });
});

describe('buildPlanningWeek', () => {
  it('proyecta siete días por posición', () => {
    const filas = semana({ positions: [posicion('p-1', 'P-01')] });

    expect(filas).toHaveLength(1);
    expect(filas[0].cells.map((c) => c.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });

  /**
   * La distinción que el modelo sí permite. Un día vacío de una posición que declara otros días es
   * lo más parecido a una decisión que hay; una posición sin ningún segmento es que nadie configuró
   * nada, y eso no se puede llamar descanso.
   */
  it('separa el día sin turno del día que nadie declaró', () => {
    const conPatron = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday')]]]),
    });

    // El lunes declara segmento y nadie está asignado todavía: eso es un hueco, no un día vacío.
    expect(conPatron[0].cells[0].kind).toBe('short');
    expect(conPatron[0].cells[6].kind).toBe('noShift');

    const sinPatron = semana({ positions: [posicion('p-2', 'P-02')] });

    expect(sinPatron[0].cells.every((cell) => cell.kind === 'undeclared')).toBe(true);
  });

  it('un día sin turno no inventa gente ni horario', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday')]]]),
    });

    const domingo = filas[0].cells[6];
    expect(domingo.requiredWorkerCount).toBe(0);
    expect(domingo.timeRange).toBe('');
    expect(domingo.people).toEqual([]);
  });

  it('marca hueco cuando hay menos gente de la que el segmento pide', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday', 2)]]]),
      shifts: [turno('p-1', LUNES, 'Laura Menchaca')],
    });

    const lunes = filas[0].cells[0];
    expect(lunes.kind).toBe('short');
    expect(lunes.requiredWorkerCount).toBe(2);
    expect(lunes.assignedWorkerCount).toBe(1);
    expect(lunes.people).toEqual(['Laura Menchaca']);
  });

  it('marca cubierto cuando la gente alcanza lo que se pide', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday', 2)]]]),
      shifts: [turno('p-1', LUNES, 'Laura'), turno('p-1', LUNES, 'Óscar')],
    });

    expect(filas[0].cells[0].kind).toBe('covered');
    expect(filas[0].cells[0].people).toEqual(['Laura', 'Óscar']);
  });

  it('el horario se lee sin minutos cuando son cero, que es el caso normal', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday')]]]),
    });

    expect(filas[0].cells[0].timeRange).toBe('07–19');
  });

  it('los turnos de otra posición no cuentan para ésta', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday', 1)]]]),
      shifts: [turno('p-2', LUNES, 'De otra posición')],
    });

    expect(filas[0].cells[0].kind).toBe('short');
    expect(filas[0].cells[0].people).toEqual([]);
  });

  it('una posición desactivada no se proyecta', () => {
    const filas = semana({ positions: [{ ...posicion('p-1', 'P-01'), active: false }] });

    expect(filas).toEqual([]);
  });

  it('un segmento desactivado no proyecta turno', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [{ ...segmento('pat-1', 'Monday'), active: false }]]]),
    });

    expect(filas[0].cells.every((cell) => cell.kind === 'undeclared')).toBe(true);
  });
});

describe('planningConflicts', () => {
  /**
   * Los huecos NO bloquean, y es una decisión. Una semana con huecos es una semana normal a la que
   * le falta gente; publicarla es lo que deja a Cobertura resolverlos. Bloquear ahí obligaría a
   * inventar asignaciones para poder publicar.
   */
  it('los huecos de cobertura se enseñan pero no impiden publicar', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday', 3)]]]),
      shifts: [turno('p-1', LUNES, 'Laura')],
    });

    const conflictos = planningConflicts(filas);
    const huecos = conflictos.find((c) => c.id === 'coverage-gaps')!;

    expect(huecos.blocking).toBe(false);
    expect(huecos.detail).toContain('Faltan 2 elementos');
    expect(huecos.detail).toContain('No impide publicar');
  });

  it('una posición sin nada declarado sí bloquea, y dice cómo salir', () => {
    const filas = semana({ positions: [posicion('p-1', 'P-01')] });

    const conflicto = planningConflicts(filas).find((c) => c.id.startsWith('undeclared:'))!;

    expect(conflicto.blocking).toBe(true);
    expect(conflicto.title).toContain('P-01');
    expect(conflicto.detail).toContain('desactívala si ya no opera');
  });

  /**
   * El caso más vacío de todos se colaba entre las dos comprobaciones que si existian: cero
   * posiciones no dispara «ninguna posición declara turnos» —no hay ninguna que no los declare— y
   * la comprobación de la semana vacía exigía `rows.length > 0`. El resultado era una lista de
   * conflictos vacía, que el panel de publicar lee como «se puede publicar», y el botón quedaba
   * encendido sobre el resumen «0 turnos en 0 posiciones».
   */
  it('un servicio sin ninguna posición bloquea, en vez de parecer publicable', () => {
    const conflictos = planningConflicts(semana({ positions: [] }));
    const conflicto = conflictos.find((c) => c.id === 'no-positions')!;

    expect(conflicto).toBeDefined();
    expect(conflicto.blocking).toBe(true);
    expect(conflicto.detail).toContain('declara la primera posición del servicio');
  });

  it('una semana que no proyecta ningún turno bloquea', () => {
    const filas = semana({ positions: [posicion('p-1', 'P-01')] });

    expect(planningConflicts(filas).some((c) => c.id === 'empty-week')).toBe(true);
  });

  it('una semana sana no inventa conflictos', () => {
    const filas = semana({
      positions: [posicion('p-1', 'P-01')],
      segments: new Map([['p-1', [segmento('pat-1', 'Monday', 1)]]]),
      shifts: [turno('p-1', LUNES, 'Laura')],
    });

    expect(planningConflicts(filas)).toEqual([]);
  });
});

describe('mondayOfWeek', () => {
  /**
   * La semana empieza en lunes porque así la lee la operación. `getUTCDay()` pone el domingo en
   * cero, así que usarlo tal cual pondría el domingo al principio de la semana.
   */
  it('devuelve el lunes de la semana que contiene el día', () => {
    expect(mondayOfWeek('2026-09-07')).toBe('2026-09-07');
    expect(mondayOfWeek('2026-09-10')).toBe('2026-09-07');
    expect(mondayOfWeek('2026-09-13')).toBe('2026-09-07');
    expect(mondayOfWeek('2026-09-14')).toBe('2026-09-14');
  });

  it('el domingo pertenece a la semana que termina, no a la que empieza', () => {
    expect(mondayOfWeek('2026-09-13')).toBe('2026-09-07');
  });

  it('cruza el cambio de mes y de año sin perderse', () => {
    expect(mondayOfWeek('2026-10-01')).toBe('2026-09-28');
    expect(mondayOfWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('devuelve vacío si no le dan un día de negocio', () => {
    expect(mondayOfWeek('2026-09-10T00:00:00Z')).toBe('');
  });
});

describe('buildCandidates', () => {
  const asignacion = (
    idEmployee: string,
    employeeName: string,
    extra: Partial<ServiceAssignment> = {},
  ): ServiceAssignment => ({
    idServiceAssignment: `asg-${idEmployee}`,
    idEmployee,
    employeeCode: 'EMP-1',
    employeeName,
    idService: 'srv-1',
    idPosition: 'p-1',
    positionCode: 'P-01',
    positionName: 'Guardia de acceso',
    assignmentType: 'Primary',
    startDate: '2026-09-01',
    endDate: null,
    isPrimary: true,
    notes: null,
    active: true,
    rowVersion: 'AAAAAAAAB9E=',
    ...extra,
  });

  const turnoEn = (idPosition: string, idEmployee: string, positionCode: string): ScheduledShift => ({
    ...turno(idPosition, LUNES, 'quien sea'),
    idEmployee,
    idPosition,
    positionCode,
  });

  /**
   * La decisión de negocio, en la capa donde se puede probar sin montar nada: ni el traslape ni el
   * puesto desconocido sacan a nadie de la lista.
   */
  it('nadie queda fuera por traslape ni por puesto desconocido', () => {
    const candidatos = buildCandidates({
      assignments: [
        asignacion('e-1', 'Ismael'),
        asignacion('e-2', 'Efraín', { idPosition: null, positionName: null }),
        asignacion('e-3', 'Rubén'),
      ],
      shifts: [turnoEn('p-4', 'e-3', 'P-04')],
      idPosition: 'p-1',
      date: LUNES,
      eligibility: cumplen('e-1', 'e-2', 'e-3'),
    });

    expect(candidatos.map((c) => c.name)).toEqual(['Ismael', 'Efraín', 'Rubén']);
    expect(candidatos.map((c) => c.standing)).toEqual(['eligible', 'review', 'overlap']);
  });

  /**
   * El veredicto del servidor, tal como llega de la comprobación de elegibilidad. Se escribe a
   * mano en las pruebas justo porque no lo inventa la pantalla.
   */
  const cumplen = (...ids: readonly string[]) =>
    new Map(ids.map((id) => [id, { isEligible: true, blockingReasons: [] as readonly string[] }]));

  /** «Hay traslape» sin decir qué queda corto es un botón de continuar con otra redacción. */
  it('el traslape nombra qué posición queda corta', () => {
    const [candidato] = buildCandidates({
      assignments: [asignacion('e-3', 'Rubén')],
      shifts: [turnoEn('p-4', 'e-3', 'P-04')],
      idPosition: 'p-1',
      date: LUNES,
    });

    expect(candidato.consequence).toContain('P-04 queda con un elemento menos');
    expect(candidato.availability).toContain('Cubre P-04 ese día');
  });

  it('quien ya está en este turno no aparece: ya está puesto', () => {
    const candidatos = buildCandidates({
      assignments: [asignacion('e-1', 'Ismael'), asignacion('e-2', 'Laura')],
      shifts: [turnoEn('p-1', 'e-1', 'P-01')],
      idPosition: 'p-1',
      date: LUNES,
    });

    expect(candidatos.map((c) => c.name)).toEqual(['Laura']);
  });

  it('una asignación desactivada no propone a nadie', () => {
    const candidatos = buildCandidates({
      assignments: [asignacion('e-1', 'Ismael', { active: false })],
      shifts: [],
      idPosition: 'p-1',
      date: LUNES,
    });

    expect(candidatos).toEqual([]);
  });

  it('un turno de otro día no cuenta como traslape', () => {
    const [candidato] = buildCandidates({
      assignments: [asignacion('e-1', 'Ismael')],
      shifts: [{ ...turnoEn('p-4', 'e-1', 'P-04'), shiftDate: '2026-09-08' }],
      idPosition: 'p-1',
      date: LUNES,
      eligibility: cumplen('e-1'),
    });

    expect(candidato.standing).toBe('eligible');
  });

  /**
   * <b>«Elegible» es una afirmación, y sólo la puede hacer el servidor.</b>
   *
   * <p>Esta función la hacía sola: bastaba con que la asignación trajera puesto para marcar a
   * alguien como elegible, sin haber consultado un solo requisito. Las reglas —documentos
   * vigentes, habilidades, evaluaciones— viven en el servidor y es él quien las hace cumplir;
   * repetirlas aquí de memoria es lo que el principio 5 prohíbe, y encima puede dar una respuesta
   * distinta de la que el servidor va a dar al guardar el turno.</p>
   */
  it('sin el veredicto del servidor nadie sale como elegible', () => {
    const [candidato] = buildCandidates({
      assignments: [asignacion('e-1', 'Ismael')],
      shifts: [],
      idPosition: 'p-1',
      date: LUNES,
    });

    expect(candidato.standing).toBe('unchecked');
  });

  /** No saber no es saber que sí: quien falta del mapa queda sin comprobar, no aprobado. */
  it('quien no viene en la respuesta queda sin comprobar', () => {
    const [candidato] = buildCandidates({
      assignments: [asignacion('e-1', 'Ismael')],
      shifts: [],
      idPosition: 'p-1',
      date: LUNES,
      eligibility: cumplen('otro-empleado'),
    });

    expect(candidato.standing).toBe('unchecked');
  });

  /** Y cuando el servidor dice que no, la pantalla dice por qué. */
  it('a quien el servidor rechaza lo marca y nombra el requisito que falta', () => {
    const [candidato] = buildCandidates({
      assignments: [asignacion('e-1', 'Ismael')],
      shifts: [],
      idPosition: 'p-1',
      date: LUNES,
      eligibility: new Map([
        ['e-1', { isEligible: false, blockingReasons: ['Su licencia de portación está vencida'] }],
      ]),
    });

    expect(candidato.standing).toBe('blocked');
    expect(candidato.consequence).toContain('licencia de portación está vencida');
  });

  /** Un rechazo sin motivo sigue diciendo algo, porque «no cumple» a secas no deja nada que hacer. */
  it('un rechazo sin motivos declarados no deja el aviso vacío', () => {
    const [candidato] = buildCandidates({
      assignments: [asignacion('e-1', 'Ismael')],
      shifts: [],
      idPosition: 'p-1',
      date: LUNES,
      eligibility: new Map([['e-1', { isEligible: false, blockingReasons: [] }]]),
    });

    expect(candidato.standing).toBe('blocked');
    expect((candidato.consequence ?? '').trim().length).toBeGreaterThan(0);
  });
});
