import {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  OperationDayClosure,
} from '../../clients/data-access/client.models';

/**
 * Una incidencia del día, con lo que la pantalla necesita saber de ella.
 *
 * <p><b>Los tres conceptos que se parecen llevan nombres que no se pueden confundir</b>, y no sólo
 * etiquetas distintas. La lección viene de un caso real: el formulario viejo de Asistencia tenía un
 * campo llamado <c>correctionAuthorizationNotes</c> que fundía autorización y motivo, no era ninguno
 * de los dos, y el servidor lo descartaba en silencio. Un nombre que vale para dos cosas hace que el
 * campo parezca correcto de un vistazo, y nadie comprueba contra el contrato algo que ya suena
 * bien.</p>
 *
 * <ul>
 * <li><c>factReasonCode</c> — <b>por qué ocurrió el hecho</b>. Sale del catálogo de motivos de la
 * organización y describe la realidad operativa. Viaja al servidor como <c>incidentType</c>.</li>
 * <li><c>correctionReason</c> — <b>por qué se está cambiando el registro</b>. Lo escribe quien
 * corrige y va a la bitácora. No describe el hecho: describe la edición.</li>
 * <li><c>idApprovalRequest</c> — <b>el permiso previo</b> para corregir, concedido por alguien más.</li>
 * </ul>
 */
export type IncidentRow = {
  readonly idIncident: string;
  readonly employeeName: string | null;
  readonly positionLabel: string;
  /** El motivo del hecho, tal como lo guardó el servidor: el código del catálogo. */
  readonly factReasonCode: string;
  /** Cómo se llama ese motivo en el catálogo de la organización, o el código si ya no está. */
  readonly factReasonLabel: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly resolutionNotes: string | null;
  /**
   * Si la incidencia se registró después de que el día se cerrara.
   *
   * <p><b>Es derivado, no una columna.</b> Se compara el instante de creación contra el
   * <c>ClosedAt</c> del cierre vigente, igual que la vacancia de posiciones se reconstruye en vez de
   * guardarse. Y <b>no bloquea nada</b>: la incidencia se permite y se marca, porque la falta
   * ocurrió y si el sistema no la deja registrar se registra fuera del sistema.</p>
   */
  readonly afterClosure: boolean;
  readonly incident: Incident;
};

/** Lo que se manda al crear o corregir una incidencia. */
export type IncidentDraft = {
  /** El motivo del HECHO, del catálogo. Viaja como `incidentType`. */
  readonly factReasonCode: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly resolutionNotes: string | null;
  /** El motivo de la CORRECCIÓN, para la bitácora. Nunca es el de arriba. */
  readonly correctionReason: string | null;
};

/**
 * Marca cada incidencia del día y le pone nombre a su motivo.
 *
 * <p>El catálogo se pasa entero para resolver el nombre del motivo: el servidor guarda el código, y
 * enseñar <c>ROBO-01</c> en la lista obliga a quien la lee a traducirlo de memoria. <b>Si el código
 * ya no está en el catálogo se enseña el código tal cual</b>, no un guion: el hecho ocurrió con ese
 * motivo, y que alguien haya desactivado el valor después no lo borra.</p>
 */
export function buildIncidentDay(options: {
  readonly incidents: readonly Incident[];
  readonly reasons: ReadonlyMap<string, string>;
  readonly closure: OperationDayClosure | null;
  readonly date: string;
}): readonly IncidentRow[] {
  return options.incidents
    .filter((incident) => incident.active && incident.incidentDate === options.date)
    .map((incident): IncidentRow => ({
      idIncident: incident.idIncident,
      employeeName: incident.employeeName,
      positionLabel: incident.employeeName ?? 'Sin persona asignada',
      factReasonCode: incident.incidentType,
      factReasonLabel: options.reasons.get(incident.incidentType) ?? incident.incidentType,
      severity: incident.severity,
      status: incident.status,
      description: incident.description,
      resolutionNotes: incident.resolutionNotes,
      afterClosure: isAfterClosure(incident, options.closure),
      incident,
    }));
}

/**
 * Si la incidencia se creó después del cierre del día.
 *
 * <p>Un día reabierto no marca nada: se reabrió justamente para poder seguir registrando, así que
 * decir «posterior al cierre» ahí sería señalar algo que ya se autorizó.</p>
 */
function isAfterClosure(incident: Incident, closure: OperationDayClosure | null): boolean {
  if (!closure || closure.status !== 'Closed' || !incident.createdAt) {
    return false;
  }

  return incident.createdAt > closure.closedAt;
}

/** Las que siguen abiertas. Es lo que el cierre cuenta y lo que hay que resolver. */
export function openIncidents(rows: readonly IncidentRow[]): readonly IncidentRow[] {
  return rows.filter((row) => row.status === 'Open' || row.status === 'InReview');
}
