import { formatOperationalDate } from '../../../shared/util/operational-date';

/**
 * Lo que el servidor dice de la organización.
 *
 * <p><b>El servidor devuelve hechos y aquí se componen las frases.</b> Las claves y los números
 * son suyos —decidir si un cero es real o falta el dato es una regla de negocio—, pero la
 * redacción vive de este lado, donde se ve y donde se puede probar.</p>
 */
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

export type OverviewMetric = {
  readonly key: OverviewMetricKey;
  readonly state: OverviewMetricState;
  readonly value: number;
  readonly tone: OverviewTone;
  readonly total: number;
  readonly serviceCount: number;
  readonly asOfDate: string | null;
  readonly route: string | null;
  /** Cuántos días de la semana tienen turnos. Sólo lo usa «turnos planeados». */
  readonly coveredDays: number;
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
  readonly metrics: readonly OverviewMetric[];
  readonly attention: readonly OverviewAttentionItem[];
};

const plural = (total: number, singular: string, muchos: string) =>
  `${total} ${total === 1 ? singular : muchos}`;

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

/**
 * El nombre del módulo al que lleva cada ruta.
 *
 * <p>Se deriva de la ruta y no de la métrica, y ésa es toda la razón de que exista. Antes la
 * etiqueta se calculaba aquí por clave y la ruta la mandaba el servidor: dos fuentes que nadie
 * mantenía sincronizadas, y dos de las cuatro se separaron. «Turnos sin cubrir» decía «Ir a
 * Planeación» y llevaba a Cobertura, y «Posiciones sin titular» decía «Definir posiciones» sin
 * nombrar Servicios, que era su destino.</p>
 *
 * <p>Con una sola fuente no se pueden volver a separar: si el servidor cambia el destino, la
 * etiqueta cambia con él.</p>
 */
const MODULO_POR_RUTA: Readonly<Record<string, string>> = {
  '/planeacion': 'Planeación',
  '/servicios': 'Servicios',
  '/personal': 'Personal',
  '/clientes': 'Clientes',
  '/solicitudes': 'Solicitudes',
  '/operacion/cobertura': 'Cobertura',
  '/operacion/incidencias': 'Incidencias',
  '/operacion/asistencia': 'Asistencia',
};

export function metricPendingAction(route: string | null): string {
  if (!route) {
    return '';
  }

  const modulo = MODULO_POR_RUTA[route];
  return modulo ? `Ir a ${modulo}` : '';
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
    case 'PlannedShifts': {
      const alcance = `En ${plural(metric.serviceCount, 'servicio', 'servicios')} y ` +
        `${plural(metric.total, 'posición', 'posiciones')}.`;

      // Una semana planeada sólo el lunes no es una semana planeada. Callarlo dejaría un número
      // que parece calculado apoyado en un prerrequisito a medias, que es la trampa que esta
      // pantalla viene a cerrar.
      return metric.coveredDays >= 7
        ? alcance
        : `${alcance} Sólo ${plural(metric.coveredDays, 'día', 'días')} de los 7 con turnos ` +
            'publicados.';
    }

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
