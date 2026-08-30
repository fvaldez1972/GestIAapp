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
  | 'CancellationReason';

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
};

export type CatalogItemInput = Omit<CatalogItem, 'idCatalogItem' | 'active'>;

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
