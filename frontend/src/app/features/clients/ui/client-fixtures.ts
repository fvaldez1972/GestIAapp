import { ClientContact, ClientListItem, ClientZone } from '../data-access/client.models';

/**
 * Datos de ejemplo para las pruebas de Clientes.
 *
 * <p>Viven aquí y no dentro de una prueba porque los cinco archivos necesitan el mismo objeto y
 * con la misma forma. No lo importa ningún componente, así que no entra al paquete.</p>
 *
 * <p>Nombres inventados, como manda el proyecto: nunca personas reales.</p>
 */
export function cliente(extra: Partial<ClientListItem> = {}): ClientListItem {
  return {
    idClient: 'cli-1',
    idOrganization: 'org-a',
    codeClient: 'CLI-01',
    legalName: 'Corporativo Altavista, S.A. de C.V.',
    tradeName: 'Corporativo Altavista',
    rfc: 'CAL180423K72',
    active: true,
    createdAt: '2026-02-12T15:00:00Z',
    zoneCount: 3,
    zonesWithoutContact: 0,
    contactCount: 4,
    documentCount: 2,
    serviceCount: 5,
    mainZoneName: 'Torre Altavista',
    mainZoneMunicipality: 'Zapopan',
    mainZoneState: 'Jalisco',
    ...extra,
  };
}

/** El caso que la pantalla existe para resolver: guardado, válido, y sin poder tener servicios. */
export const sinZona = (extra: Partial<ClientListItem> = {}) =>
  cliente({
    idClient: 'cli-2',
    codeClient: 'CLI-02',
    legalName: 'Textiles La Concepción, S.A. de C.V.',
    tradeName: 'Textiles La Concepción',
    zoneCount: 0,
    zonesWithoutContact: 0,
    contactCount: 0,
    serviceCount: 0,
    mainZoneName: null,
    mainZoneMunicipality: null,
    mainZoneState: null,
    ...extra,
  });

export function zona(extra: Partial<ClientZone> = {}): ClientZone {
  return {
    idClientZone: 'sed-1',
    idClient: 'cli-1',
    codeClientZone: 'SED-01',
    name: 'Torre Altavista',
    street: 'Av. Patria 1250',
    exteriorNumber: null,
    interiorNumber: null,
    neighborhood: 'Jardines Universidad',
    municipality: 'Zapopan',
    state: 'Jalisco',
    postalCode: '45110',
    countryCode: 'MX',
    accessInstructions: null,
    timeZoneId: null,
    active: true,
    ...extra,
  };
}

export function contacto(extra: Partial<ClientContact> = {}): ClientContact {
  return {
    idClientContact: 'con-1',
    idClient: 'cli-1',
    idClientZone: 'sed-1',
    scope: 'Zone',
    idPurposeCatalogItem: 'cat-operativo',
    idContactJobPositionCatalogItem: 'cat-jefa',
    clientZoneName: 'Torre Altavista',
    purposeName: 'Operativo',
    contactJobPositionName: 'Jefa de vigilancia',
    purpose: 'Operational',
    fullName: 'Mariana Escalante Ruvalcaba',
    jobTitle: 'Jefa de vigilancia',
    email: null,
    phone: '33 1234 5678',
    mobilePhone: null,
    isPrimary: true,
    active: true,
    ...extra,
  };
}
