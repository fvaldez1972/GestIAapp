/**
 * Los ocho catálogos editables que quedan.
 *
 * <p>El 7 de septiembre de 2026 se retiraron seis —`Zone`, `CancellationReason`,
 * `DocumentRequirement`, `EvaluationRequirement`, `ClientRestriction` y `ServiceRestriction`—
 * porque ninguna pantalla ni regla del servidor leía sus valores: se podían llenar, y llenarlos no
 * cambiaba nada. Los requisitos de documento y evaluación viven en los enums del expediente, no
 * aquí.</p>
 */
export type BusinessCatalogItemType =
  | 'Skill'
  | 'JobPosition'
  | 'IncidentReason'
  | 'CoverageReason'
  | 'Country' | 'State' | 'City' | 'Nationality';

export type EligibilityRequirementTargetType = 'Organization' | 'Client' | 'Service' | 'Position';
export type EligibilityRequirementType = 'Skill' | 'Document' | 'Evaluation' | 'Restriction';

/** Los catorce tipos de documento del expediente, como los nombra el servidor. */
export type EmployeeDocumentType =
  | 'EmploymentApplication' | 'BirthCertificate' | 'MarriageCertificate' | 'VoterId'
  | 'Curp' | 'SocialSecurityNumber' | 'Rfc' | 'TaxStatusCertificate' | 'DriverLicense'
  | 'ProofOfAddress' | 'ProofOfStudies' | 'MilitaryServiceCard'
  | 'CriminalRecordCertificate' | 'Other';

/** Los cinco tipos de evaluación. */
export type EmployeeEvaluationType =
  | 'Polygraph' | 'SocioeconomicStudy' | 'CriminalRecordReview' | 'DrugTest' | 'Other';

export type CatalogItem = {
  readonly idCatalogItem: string;
  readonly idOrganization: string;
  readonly type: BusinessCatalogItemType;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly order?: number;
  readonly updatedAt?: string | null;
  readonly idParentCatalogItem?: string | null;
};

export type CatalogItemInput = Omit<CatalogItem, 'idCatalogItem' | 'active' | 'updatedAt'> & { readonly active?: boolean };

export type CatalogDefinition = {
  readonly key: string;
  readonly name: string;
  readonly module: string;
  readonly editable: boolean;
  readonly type: BusinessCatalogItemType | null;
  readonly values: readonly { code: string; label: string }[];
};

export type EligibilityRequirement = {
  readonly idEligibilityRequirement: string;
  readonly idOrganization: string;
  readonly targetType: EligibilityRequirementTargetType;
  readonly idClient: string | null;
  readonly clientName: string | null;
  readonly idService: string | null;
  readonly serviceName: string | null;
  readonly idPosition: string | null;
  readonly positionName: string | null;
  readonly requirementType: EligibilityRequirementType;

  /**
   * Qué exige la regla, en tres campos y no en uno.
   *
   * <p>Antes había un solo `requiredCode` de texto cuyo significado cambiaba con el tipo: para una
   * regla de habilidad era el código de un valor de catálogo, y para las de documento y evaluación
   * era el nombre de un enum del servidor. Nada impedía guardar el valor de un enum en una regla
   * del otro. Ahora cada tipo apunta a lo suyo, y el servidor sólo acepta exactamente uno.</p>
   */
  readonly idRequiredCatalogItem: string | null;
  readonly requiredCatalogItemName: string | null;
  readonly requiredDocumentType: EmployeeDocumentType | null;
  readonly requiredEvaluationType: EmployeeEvaluationType | null;

  readonly name: string;
  readonly description: string | null;
  readonly isBlocking: boolean;
  readonly active: boolean;
};

export type EligibilityRequirementInput = Omit<
  EligibilityRequirement,
  | 'idEligibilityRequirement'
  | 'clientName'
  | 'serviceName'
  | 'positionName'
  | 'requiredCatalogItemName'
  | 'active'
>;

export type EmployeeSkill = {
  readonly idEmployeeSkill: string;
  readonly idEmployee: string;
  readonly idSkillCatalogItem: string;
  readonly skillName: string;
  readonly acquiredDate: string | null;
  readonly expiresDate: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type EmployeeSkillInput = Omit<EmployeeSkill, 'idEmployeeSkill' | 'skillName' | 'active'> & {
  readonly idOrganization: string;
};

export type EligibilityReason = {
  readonly scope: string;
  readonly requirement: string;
  readonly isBlocking: boolean;
  readonly passed: boolean;
  readonly message: string;
};

export type EligibilityCheck = {
  readonly idEmployee: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly isEligible: boolean;
  readonly reasons: readonly EligibilityReason[];
};
