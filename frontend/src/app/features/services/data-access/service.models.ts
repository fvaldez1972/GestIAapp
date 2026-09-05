/** Los tres modos del listado. Coincide con el enum del servidor. */
export type ServiceStatusFilter = 'Active' | 'Inactive' | 'All';

/**
 * Un servicio en el listado de la organización.
 *
 * <p>Lo devuelve `GET /api/v1/services`, el endpoint plano: **no hace falta elegir un cliente
 * antes**. Trae el nombre del cliente y de la sede resueltos, y la cobertura agregada, que son los
 * datos que la tabla muestra y que de otro modo pedirían una consulta por fila.</p>
 */
export type ServiceListItem = {
  readonly idService: string;
  readonly idClient: string;
  readonly clientName: string;
  readonly idClientSite: string;
  readonly clientSiteName: string | null;
  readonly idServiceContract: string | null;
  readonly serviceContractCode: string | null;
  readonly codeService: string;
  readonly name: string;
  readonly description: string;
  readonly invoiceDescription: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly positionsCount: number;
  /** Cuánta gente piden entre todas las posiciones. */
  readonly requiredWorkerCount: number;
  /** Cuánta hay asignada a `coverageDate`. */
  readonly assignedWorkerCount: number;
  /** El día al que se calculó la cobertura. Sin él, los dos números no dicen nada. */
  readonly coverageDate: string;
  readonly active: boolean;
};

/**
 * El estado que se muestra en la tabla.
 *
 * <p><b>«Vencido» no es «Inactivo», y la distinción es sutil.</b> Lo primero sale de comparar la
 * fecha de término con el día operativo; lo segundo, del borrado lógico. **Un servicio puede estar
 * activo y vencido a la vez**, y por eso el orden de esta función importa: se pregunta primero por
 * la baja, que es la que manda.</p>
 */
export type ServiceState = 'inactive' | 'expired' | 'active';

export function serviceState(service: ServiceListItem, operationDate: string): ServiceState {
  if (!service.active) {
    return 'inactive';
  }

  // Sin día operativo no se afirma que algo venció: se compara contra una fecha que no se sabe.
  if (operationDate && service.endDate && service.endDate < operationDate) {
    return 'expired';
  }

  return 'active';
}

/** Lo que falta en el servicio. **Negativo si sobra gente**, y se muestra así. */
export const serviceVacancy = (service: ServiceListItem) =>
  service.requiredWorkerCount - service.assignedWorkerCount;

/**
 * La cobertura de una posición a una fecha.
 *
 * <p>Va aparte de la lista de posiciones porque depende de un día y la posición no: el mismo
 * puesto tiene hueco un día y no lo tiene al siguiente.</p>
 */
export type PositionVacancy = {
  readonly idPosition: string;
  readonly idService: string;
  readonly codePosition: string;
  readonly name: string;
  readonly requiredWorkerCount: number;
  readonly assignedWorkerCount: number;
  readonly date: string;
};

export const positionVacancy = (position: PositionVacancy) =>
  position.requiredWorkerCount - position.assignedWorkerCount;
