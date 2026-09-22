/**
 * Una incidencia administrativa del expediente.
 *
 * <p><b>No es una incidencia de la operación diaria, y se parecen lo bastante como para
 * confundirlas.</b> Una incidencia operativa describe lo que pasó en un turno y vive atada a un
 * servicio; ésta describe un hecho de la relación laboral —un acta, una llamada de atención— y vive
 * atada a la persona. Sigue en el expediente aunque cambie de servicio, y participa en la
 * elegibilidad.</p>
 */
export type AdministrativeIncident = {
  readonly idAdministrativeIncident: string;
  readonly idEmployee: string;
  readonly idIncidentTypeCatalogItem: string;
  readonly incidentTypeName: string;

  /**
   * Si tener una incidencia de este tipo impide asignar.
   *
   * <p>Lo resuelve el servidor con la marca de la entrada del catálogo. Viene resuelto para que la
   * pantalla no tenga que cargar el catálogo entero sólo para pintar una píldora.</p>
   */
  readonly isBlocking: boolean;

  readonly occurredDate: string;
  readonly details: string;
  readonly active: boolean;
};

export type AdministrativeIncidentInput = {
  readonly idOrganization: string;
  readonly idEmployee: string;
  readonly idIncidentTypeCatalogItem: string;
  readonly occurredDate: string;
  readonly details: string;
};
