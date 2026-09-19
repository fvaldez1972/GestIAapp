/**
 * Los catálogos editables por organización.
 *
 * <p>El 7 de septiembre de 2026 se retiraron seis —`Zone`, `CancellationReason`,
 * `DocumentRequirement`, `EvaluationRequirement`, `ClientRestriction` y `ServiceRestriction`—
 * porque ninguna pantalla ni regla del servidor leía sus valores: se podían llenar, y llenarlos no
 * cambiaba nada.</p>
 *
 * <p>El 19 de septiembre de 2026 entraron diez. Tres vienen de enums que dejaron de ser fijos
 * —`EmployeeDocumentCategory`, `EmployeeEvaluationCategory` y `ContactPurpose`—, y siete son nuevos.
 * Los cuatro que participan en la elegibilidad llevan además marca de bloqueante o informativa.</p>
 */
export type BusinessCatalogItemType =
  | 'Skill'
  | 'JobPosition'
  | 'IncidentReason'
  | 'CoverageReason'
  | 'ClientDocumentCategory'
  | 'EmployeeDocumentCategory'
  | 'EmployeeDocumentGroup'
  | 'EmployeeEvaluationCategory'
  | 'AdministrativeIncidentType'
  | 'Sex'
  | 'AgeRange'
  | 'EducationLevel'
  | 'RequiredEquipment'
  | 'ContactJobPosition'
  | 'ContactPurpose'
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

  /**
   * Si faltar esta entrada impide asignar y publicar, o sólo deja constancia.
   *
   * <p>Nulo no es «informativa»: es «este catálogo no tiene severidad», que es el caso de la
   * geografía y los puestos. La pantalla decide si dibuja la marca con `supportsBlockingMark`, no
   * mirando si el valor viene nulo.</p>
   */
  readonly isBlocking?: boolean | null;
  readonly supportsBlockingMark?: boolean;
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
   * regla de experiencia era el código de un valor de catálogo, y para las de documento y evaluación
   * era el nombre de un enum del servidor. Nada impedía guardar el valor de un enum en una regla
   * del otro. Ahora cada tipo apunta a lo suyo, y el servidor sólo acepta exactamente uno.</p>
   */
  readonly idRequiredCatalogItem: string | null;
  readonly requiredCatalogItemName: string | null;
  readonly requiredDocumentType: EmployeeDocumentType | null;
  readonly requiredEvaluationType: EmployeeEvaluationType | null;

  readonly name: string;
  readonly description: string | null;

  /**
   * La severidad, resuelta por el servidor a partir de la entrada del catálogo que la regla exige.
   *
   * <p>La regla <b>ya no la afina</b>. Hasta el 19 de septiembre de 2026 podía, y eso permitía
   * configurar el mismo requisito como bloqueante en un sitio e informativo en otro; RF-POS-010
   * pidió una sola fuente. El catálogo dice qué tan grave es, la regla dice a quién aplica.</p>
   */
  readonly isBlockingEffective: boolean;
  readonly active: boolean;
};

export type EligibilityRequirementInput = Omit<
  EligibilityRequirement,
  | 'idEligibilityRequirement'
  | 'clientName'
  | 'serviceName'
  | 'positionName'
  | 'requiredCatalogItemName'
  | 'isBlockingEffective'
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
