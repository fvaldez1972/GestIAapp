export type BusinessCatalogItemType =
  | 'Skill'
  | 'JobPosition'
  | 'DocumentRequirement'
  | 'EvaluationRequirement'
  | 'ClientRestriction'
  | 'ServiceRestriction'
  | 'Zone'
  | 'IncidentReason'
  | 'CoverageReason'
  | 'CancellationReason'
  | 'Country' | 'State' | 'City' | 'Nationality';

export type EligibilityRequirementTargetType = 'Organization' | 'Client' | 'Service' | 'Position';
export type EligibilityRequirementType = 'Skill' | 'Document' | 'Evaluation' | 'Restriction';

export type CatalogItem = {
  readonly idCatalogItem: string;
  readonly idOrganization: string;
  readonly type: BusinessCatalogItemType;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly group?: string;
  readonly order?: number;
  readonly synonyms?: readonly string[];
  readonly updatedAt?: string | null;
  readonly idParentCatalogItem?: string | null;
};

export type CatalogItemInput = Omit<CatalogItem, 'idCatalogItem' | 'active' | 'updatedAt'> & { readonly active?: boolean };

export type CatalogDefinition = {
  readonly key: string;
  readonly name: string;
  readonly group: string;
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
  readonly requiredCode: string;
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
  | 'active'
>;

export type EmployeeSkill = {
  readonly idEmployeeSkill: string;
  readonly idEmployee: string;
  readonly idSkillCatalogItem: string;
  readonly skillCode: string;
  readonly skillName: string;
  readonly acquiredDate: string | null;
  readonly expiresDate: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type EmployeeSkillInput = Omit<EmployeeSkill, 'idEmployeeSkill' | 'skillCode' | 'skillName' | 'active'> & {
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
