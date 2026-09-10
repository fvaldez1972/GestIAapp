import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';
import { EmployeeAssignment, EmployeeListItem } from '../data-access/employee-list.models';
import { EmployeeDocument } from '../data-access/workforce.models';

/**
 * Personas de prueba, con nombres inventados.
 *
 * <p>Nunca gente real del proyecto: una captura de pantalla de una prueba termina en un correo, y
 * la persona que aparece ahí no dio permiso de figurar en un expediente de ejemplo.</p>
 */
export function employeeFixture(overrides: Partial<EmployeeListItem> = {}): EmployeeListItem {
  return {
    idEmployee: 'e1',
    idOrganization: 'o1',
    codeEmployee: 'EMP-0001',
    fullName: 'Renata Villaseñor Cortés',
    status: 'Active',
    hireDate: '2026-03-02',
    curp: 'VICR900101MJCLRN03',
    idJobPositionCatalogItem: 'jp-1',
    jobPositionName: 'Guardia intramuros',
    jobTitle: null,
    state: 'Jalisco',
    municipality: 'Zapopan',
    requiredDocuments: 2,
    expiredDocuments: 0,
    expiringDocuments: 0,
    missingDocuments: 0,
    assignmentCount: 1,
    documentCount: 0,
    documentHealth: 'UpToDate',
    ...overrides,
  };
}

export function requirementFixture(
  overrides: Partial<EligibilityRequirement> = {},
): EligibilityRequirement {
  return {
    idEligibilityRequirement: 'r1',
    idOrganization: 'o1',
    targetType: 'Organization',
    idClient: null,
    clientName: null,
    idService: null,
    serviceName: null,
    idPosition: null,
    positionName: null,
    requirementType: 'Document',
    idRequiredCatalogItem: null,
    requiredCatalogItemName: null,
    requiredDocumentType: 'Curp',
    requiredEvaluationType: null,
    name: 'CURP',
    description: null,
    isBlocking: true,
    active: true,
    ...overrides,
  };
}

export function documentFixture(overrides: Partial<EmployeeDocument> = {}): EmployeeDocument {
  return {
    idEmployeeDocument: 'd1',
    idEmployee: 'e1',
    documentType: 'Curp',
    status: 'Validated',
    documentNumber: 'VICR900101MJCLRN03',
    receivedDate: '2026-03-02',
    issuedDate: '2026-03-01',
    expiresDate: null,
    storageReference: null,
    notes: null,
    active: true,
    ...overrides,
  };
}

export function assignmentFixture(overrides: Partial<EmployeeAssignment> = {}): EmployeeAssignment {
  return {
    idServiceAssignment: 'a1',
    idService: 's1',
    serviceName: 'Vigilancia nocturna',
    clientName: 'Corporativo Altavista',
    idPosition: 'p1',
    positionName: 'Caseta poniente · nocturno',
    assignmentType: 'Primary',
    isPrimary: true,
    startDate: '2026-08-01',
    endDate: null,
    inForce: true,
    hasShiftInProgress: false,
    shiftInProgressDate: null,
    ...overrides,
  };
}
