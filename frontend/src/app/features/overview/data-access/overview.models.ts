import { formatOperationalDate } from '../../../shared/util/operational-date';

/**
 * Lo que el servidor dice de la organización.
 *
 * <p><b>El servidor devuelve hechos y aquí se componen las frases.</b> Las claves y los números
 * son suyos —decidir si un cero es real o falta el dato es una regla de negocio—, pero la
 * redacción vive de este lado, donde se ve y donde se puede probar.</p>
 */
export type OverviewSetupStepKey =
  | 'Catalogs'
  | 'Clients'
  | 'Services'
  | 'Positions'
  | 'Employees'
  | 'Assignments'
  | 'Planning';

export type OverviewMetricKey =
  | 'PlannedShifts'
  | 'PositionsWithoutPrimary'
  | 'UncoveredShiftsYesterday'
  | 'ExpiredDocuments';

export type OverviewAttentionKey =
  | 'PositionsWithoutPrimary'
  | 'AbsencesWithoutIncident'
  | 'NextWeekUnpublished'
  | 'PositionsWithoutPattern'
  | 'ExpiredDocuments';

export type OverviewMetricState = 'Ready' | 'Pending';
export type OverviewTone = 'Neutral' | 'Success' | 'Warning' | 'Danger';

export type OverviewSetupCounts = {
  readonly jobPositions: number;
  readonly skills: number;
  readonly zones: number;
  readonly incidentReasons: number;
  readonly coverageReasons: number;
  readonly clients: number;
  readonly clientSites: number;
  readonly clientContacts: number;
  readonly clientsWithoutContact: number;
  readonly services: number;
  readonly servicesWithConfiguration: number;
  readonly servicesWithoutPositions: number;
  readonly positions: number;
  readonly positionsWithPattern: number;
  readonly employees: number;
  readonly employeesWithFile: number;
  readonly primaryAssignments: number;
  readonly reliefAssignments: number;
  readonly publishedVersions: number;
};

export type OverviewSetupStep = {
  readonly key: OverviewSetupStepKey;
  readonly order: number;
  readonly done: boolean;
  readonly blockedBy: readonly OverviewSetupStepKey[];
  readonly route: string | null;
  readonly highlightName: string | null;
};

export type OverviewSetup = {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly counts: OverviewSetupCounts;
  readonly steps: readonly OverviewSetupStep[];
};

export type OverviewMetric = {
  readonly key: OverviewMetricKey;
  readonly state: OverviewMetricState;
  readonly value: number;
  readonly tone: OverviewTone;
  readonly total: number;
  readonly serviceCount: number;
  readonly asOfDate: string | null;
  readonly route: string | null;
};

export type OverviewAttentionItem = {
  readonly key: OverviewAttentionKey;
  readonly severity: OverviewTone;
  readonly count: number;
  readonly serviceCount: number;
  readonly sinceDate: string | null;
  readonly route: string | null;
};

export type Overview = {
  readonly operationDate: string;
  readonly previousOperationDate: string;
  readonly weekStartDate: string;
  readonly weekEndDate: string;
  readonly setup: OverviewSetup;
  readonly metrics: readonly OverviewMetric[];
  readonly attention: readonly OverviewAttentionItem[];
};

/**
 * Cuánto ocupa el camino.
 *
 * <p><b>Sale del conteo, nunca de una preferencia.</b> Si alguien desactiva su único servicio, un
 * paso deja de estar hecho y el camino vuelve a crecer solo. Lo único que se recuerda por
 * organización es si el usuario abrió a mano la línea cerrada.</p>
 */
export type SetupDensity = 'full' | 'compact' | 'line';

export function setupDensity(completedSteps: number, totalSteps: number): SetupDensity {
  if (completedSteps >= totalSteps) {
    return 'line';
  }

  return completedSteps <= 2 ? 'full' : 'compact';
}

// ── Los textos del camino ──────────────────────────────────────────────────────────────────

const TITULOS: Record<OverviewSetupStepKey, string> = {
  Catalogs: 'Catálogos mínimos',
  Clients: 'Primer cliente con sede y contacto',
  Services: 'Servicio con su configuración',
  Positions: 'Posiciones con turno y descanso',
  Employees: 'Empleados con expediente mínimo',
  Assignments: 'Titulares y cubre-descansos asignados',
  Planning: 'Planeación de la semana publicada',
};

const DESTINOS: Record<OverviewSetupStepKey, string> = {
  Catalogs: 'Ir a Catálogos',
  Clients: 'Ir a Clientes',
  Services: 'Ir a Servicios',
  Positions: 'Ir a Servicios',
  Employees: 'Ir a Personal',
  Assignments: 'Ir a Servicios',
  Planning: 'Ir a Planeación',
};

export const setupStepTitle = (key: OverviewSetupStepKey) => TITULOS[key];

/** El paso hecho se revisa; el pendiente lleva al módulo donde se resuelve. */
export const setupStepAction = (step: OverviewSetupStep) =>
  step.done ? 'Revisar' : DESTINOS[step.key];

const plural = (total: number, singular: string, muchos: string) =>
  `${total} ${total === 1 ? singular : muchos}`;

/**
 * Lo que dice cada paso debajo de su nombre.
 *
 * <p>Un paso hecho enseña la evidencia que lo cerró; uno pendiente dice qué falta. La diferencia
 * importa: «hecho» sin evidencia es una palomita en la que hay que confiar.</p>
 */
export function setupStepDetail(step: OverviewSetupStep, counts: OverviewSetupCounts): string {
  switch (step.key) {
    case 'Catalogs':
      return step.done
        ? [
            plural(counts.jobPositions, 'puesto', 'puestos'),
            plural(counts.skills, 'habilidad', 'habilidades'),
            plural(counts.zones, 'zona', 'zonas'),
            plural(counts.incidentReasons, 'motivo de incidencia', 'motivos de incidencia'),
            plural(counts.coverageReasons, 'motivo de cobertura', 'motivos de cobertura'),
          ].join(' · ')
        : 'Puestos, habilidades, zonas, motivos de incidencia y motivos de cobertura. Es el único ' +
            'paso que no depende de nada.';

    case 'Clients': {
      if (!step.done) {
        return 'La sede es obligatoria: un cliente sin sede no permite crear servicios.';
      }

      const base = `${plural(counts.clients, 'cliente', 'clientes')} · ` +
        `${plural(counts.clientSites, 'sede', 'sedes')} · ` +
        `${plural(counts.clientContacts, 'contacto', 'contactos')}.`;

      return step.highlightName
        ? `${base} ${step.highlightName} todavía no tiene contacto.`
        : base;
    }

    case 'Services':
      if (!step.done) {
        return counts.clientSites > 0
          ? 'Aquí se definen horas, días por semana y elementos requeridos.'
          : 'Requiere un cliente con al menos una sede.';
      }

      return step.highlightName
        ? `${plural(counts.servicesWithConfiguration, 'servicio configurado', 'servicios configurados')}, ` +
            `entre ellos ${step.highlightName}.`
        : plural(counts.servicesWithConfiguration, 'servicio configurado', 'servicios configurados');

    case 'Positions':
      if (step.done) {
        return `${plural(counts.positionsWithPattern, 'posición', 'posiciones')} con patrón, ` +
          `de ${counts.positions}. El patrón pertenece a la posición, no a la persona.`;
      }

      return counts.services > 0
        ? `${plural(counts.servicesWithoutPositions, 'servicio está', 'servicios están')} sin posiciones. ` +
            'Sin posiciones no hay planeación ni asignaciones.'
        : 'Requiere un servicio creado. El patrón pertenece a la posición, no a la persona.';

    case 'Employees':
      if (step.done) {
        return `${plural(counts.employeesWithFile, 'empleado', 'empleados')} con expediente mínimo, ` +
          `de ${counts.employees} activos.`;
      }

      return counts.jobPositions > 0
        ? 'Ningún empleado con expediente mínimo. El catálogo de puestos ya está listo, así que ' +
            'puedes empezar cuando quieras.'
        : 'Requiere el catálogo de puestos del paso 1. Identidad, contacto, zona, puesto, fecha de ' +
            'ingreso y documentos.';

    case 'Assignments':
      return step.done
        ? `${plural(counts.primaryAssignments, 'titular vigente', 'titulares vigentes')} y ` +
            `${plural(counts.reliefAssignments, 'cubre-descansos', 'cubre-descansos')}.`
        : 'Donde falte gente, la posición queda como vacante visible.';

    case 'Planning':
      return step.done
        ? `${plural(counts.publishedVersions, 'versión publicada', 'versiones publicadas')}. ` +
            'La configuración quedó cerrada y empezó la operación diaria.'
        : 'Al publicarla, la configuración queda cerrada y empieza la operación diaria.';
  }
}

/**
 * De qué depende un paso bloqueado.
 *
 * <p>Se dice <b>antes</b> de entrar al módulo. Enterarse de que falta el paso anterior después de
 * abrir un formulario y no poder guardarlo es la pared que esta línea evita.</p>
 */
export function setupStepBlockedBy(step: OverviewSetupStep): string {
  if (step.done || step.blockedBy.length === 0) {
    return '';
  }

  const nombres = step.blockedBy.map((key) => `«${TITULOS[key]}»`);
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;

  return `Antes hace falta ${lista}.`;
}

// ── Los textos del tablero ─────────────────────────────────────────────────────────────────

const ETIQUETAS: Record<OverviewMetricKey, string> = {
  PlannedShifts: 'TURNOS PLANEADOS · SEMANA',
  PositionsWithoutPrimary: 'POSICIONES SIN TITULAR',
  UncoveredShiftsYesterday: 'TURNOS SIN CUBRIR · AYER',
  ExpiredDocuments: 'EMPLEADOS CON DOCUMENTOS VENCIDOS',
};

export const metricLabel = (key: OverviewMetricKey) => ETIQUETAS[key];

/** Lo que falta para que el número exista, y no un texto genérico igual para los cuatro. */
export function metricPendingLabel(key: OverviewMetricKey): string {
  switch (key) {
    case 'PlannedShifts':
      return 'Sin planeación publicada';
    case 'PositionsWithoutPrimary':
      return 'Sin posiciones definidas';
    case 'UncoveredShiftsYesterday':
      return 'Sin planeación de ayer';
    case 'ExpiredDocuments':
      return 'Sin empleados dados de alta';
  }
}

export function metricPendingAction(key: OverviewMetricKey): string {
  switch (key) {
    case 'PlannedShifts':
    case 'UncoveredShiftsYesterday':
      return 'Ir a Planeación';
    case 'PositionsWithoutPrimary':
      return 'Definir posiciones';
    case 'ExpiredDocuments':
      return 'Ir a Personal';
  }
}

/** La palabra que acompaña al número. Sólo cuando dice algo que el número solo no dice. */
export function metricPill(metric: OverviewMetric): string {
  if (metric.state === 'Pending') {
    return '';
  }

  switch (metric.key) {
    case 'PositionsWithoutPrimary':
      return metric.value > 0 ? 'Vacante' : 'Todas cubiertas';
    case 'UncoveredShiftsYesterday':
      return metric.value > 0 ? 'Al descubierto' : 'Todo cubierto';
    case 'ExpiredDocuments':
      return metric.value > 0 ? 'Bloquea asignación' : '';
    default:
      return '';
  }
}

/**
 * La línea que explica el número.
 *
 * <p>Sin ella un 22 px suelto es una cifra sin unidad ni alcance: «3» no dice lo mismo que «3 de
 * 38, en 2 servicios».</p>
 */
export function metricHint(metric: OverviewMetric): string {
  switch (metric.key) {
    case 'PlannedShifts':
      return `En ${plural(metric.serviceCount, 'servicio', 'servicios')} y ` +
        `${plural(metric.total, 'posición', 'posiciones')}.`;

    case 'PositionsWithoutPrimary':
      return metric.value > 0
        ? `De ${plural(metric.total, 'posición', 'posiciones')}, en ` +
            `${plural(metric.serviceCount, 'servicio', 'servicios')}. La cobertura del turno queda ` +
            'al descubierto.'
        : `Las ${metric.total} posiciones tienen titular vigente.`;

    case 'UncoveredShiftsYesterday': {
      const dia = formatOperationalDate(metric.asOfDate);
      return metric.value > 0
        ? `${dia}: ${plural(metric.value, 'turno quedó', 'turnos quedaron')} con falta y sin cobertura.`
        : `${dia}: los ${metric.total} turnos del día quedaron cubiertos.`;
    }

    case 'ExpiredDocuments':
      return metric.value > 0
        ? `De ${plural(metric.total, 'empleado activo', 'empleados activos')}. No pueden asignarse a ` +
            'una posición hasta reponer el documento.'
        : `Los ${metric.total} empleados activos tienen sus documentos vigentes.`;
  }
}

// ── Los textos de la atención ──────────────────────────────────────────────────────────────

export function attentionTitle(item: OverviewAttentionItem): string {
  switch (item.key) {
    case 'PositionsWithoutPrimary':
      return `${plural(item.count, 'posición sin titular', 'posiciones sin titular')} en ` +
        `${plural(item.serviceCount, 'servicio', 'servicios')}`;
    case 'AbsencesWithoutIncident':
      return `${plural(item.count, 'falta sin incidencia registrada', 'faltas sin incidencia registrada')}`;
    case 'NextWeekUnpublished':
      return 'La planeación de la semana siguiente sigue en borrador';
    case 'PositionsWithoutPattern':
      return `${plural(item.count, 'posición sin patrón de turno', 'posiciones sin patrón de turno')} en ` +
        `${plural(item.serviceCount, 'servicio', 'servicios')}`;
    case 'ExpiredDocuments':
      return `${plural(item.count, 'empleado con documentos vencidos', 'empleados con documentos vencidos')}`;
  }
}

export function attentionDetail(item: OverviewAttentionItem): string {
  switch (item.key) {
    case 'PositionsWithoutPrimary':
      return item.sinceDate
        ? `Vacantes desde el ${formatOperationalDate(item.sinceDate)}. El detalle por servicio y ` +
            'posición vive en Asignaciones.'
        : 'Nunca han tenido titular. El detalle por servicio y posición vive en Asignaciones.';
    case 'AbsencesWithoutIncident':
      return `De la asistencia del día anterior, en ${plural(item.serviceCount, 'servicio', 'servicios')}. ` +
        'Cada falta abre su incidencia con su motivo.';
    case 'NextWeekUnpublished':
      return 'Mientras no se publique, los turnos de esa semana no existen para asistencia ni cobertura.';
    case 'PositionsWithoutPattern':
      return 'Sin patrón no se puede proyectar ni un turno: esas posiciones no entran en la ' +
        'planeación de la semana.';
    case 'ExpiredDocuments':
      return item.sinceDate
        ? `El más antiguo venció el ${formatOperationalDate(item.sinceDate)}. No pueden asignarse ` +
            'hasta reponerlo.'
        : 'No pueden asignarse a ninguna posición hasta reponer el documento.';
  }
}

/** Dónde se resuelve. Va aparte del título porque el bosquejo lo pone en su propia columna. */
export function attentionWhere(item: OverviewAttentionItem): string {
  switch (item.key) {
    case 'PositionsWithoutPrimary':
      return 'Servicios · Asignaciones';
    case 'AbsencesWithoutIncident':
      return 'Asistencia';
    case 'NextWeekUnpublished':
      return 'Planeación';
    case 'PositionsWithoutPattern':
      return 'Servicios · Posiciones';
    case 'ExpiredDocuments':
      return 'Personal';
  }
}

export function attentionAction(item: OverviewAttentionItem): string {
  switch (item.key) {
    case 'PositionsWithoutPrimary':
      return 'Asignar titular';
    case 'AbsencesWithoutIncident':
      return 'Registrar incidencias';
    case 'NextWeekUnpublished':
      return 'Publicar la semana';
    case 'PositionsWithoutPattern':
      return 'Definir patrón';
    case 'ExpiredDocuments':
      return 'Ver expedientes';
  }
}
