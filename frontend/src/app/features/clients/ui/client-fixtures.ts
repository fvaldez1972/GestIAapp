import { ClientContact, ClientListItem, ClientSite } from '../data-access/client.models';

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
    siteCount: 3,
    sitesWithoutContact: 0,
    contactCount: 4,
    serviceCount: 5,
    mainSiteName: 'Torre Altavista',
    mainSiteMunicipality: 'Zapopan',
    mainSiteState: 'Jalisco',
    ...extra,
  };
}

/** El caso que la pantalla existe para resolver: guardado, válido, y sin poder tener servicios. */
export const sinSede = (extra: Partial<ClientListItem> = {}) =>
  cliente({
    idClient: 'cli-2',
    codeClient: 'CLI-02',
    legalName: 'Textiles La Concepción, S.A. de C.V.',
    tradeName: 'Textiles La Concepción',
    siteCount: 0,
    sitesWithoutContact: 0,
    contactCount: 0,
    serviceCount: 0,
    mainSiteName: null,
    mainSiteMunicipality: null,
    mainSiteState: null,
    ...extra,
  });

export function sede(extra: Partial<ClientSite> = {}): ClientSite {
  return {
    idClientSite: 'sed-1',
    idClient: 'cli-1',
    codeClientSite: 'SED-01',
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
    idClientSite: 'sed-1',
    clientSiteName: 'Torre Altavista',
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
