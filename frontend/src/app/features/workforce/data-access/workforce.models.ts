export type EmployeeStatus = 'Candidate' | 'Active' | 'OnLeave' | 'Inactive' | 'Terminated';

export type EmployeeDocumentType =
  | 'EmploymentApplication'
  | 'BirthCertificate'
  | 'MarriageCertificate'
  | 'VoterId'
  | 'Curp'
  | 'SocialSecurityNumber'
  | 'Rfc'
  | 'TaxStatusCertificate'
  | 'DriverLicense'
  | 'ProofOfAddress'
  | 'ProofOfStudies'
  | 'MilitaryServiceCard'
  | 'CriminalRecordCertificate'
  | 'Other';

export type EmployeeDocumentStatus = 'Pending' | 'Received' | 'Validated' | 'Rejected' | 'Expired' | 'NotApplicable';

export type EmployeeEvaluationType =
  | 'Polygraph'
  | 'SocioeconomicStudy'
  | 'CriminalRecordReview'
  | 'DrugTest'
  | 'Other';

export type EmployeeEvaluationResult =
  | 'Pending'
  | 'Approved'
  | 'ApprovedWithObservations'
  | 'NotApproved'
  | 'Inconclusive';

export type Employee = {
  readonly idEmployee: string;
  readonly idOrganization: string;
  readonly codeEmployee: string;
  readonly status: EmployeeStatus;
  readonly fullName: string;
  readonly jobTitle: string | null;
  /** El puesto por identificador de catalogo. Es el que compara la elegibilidad. */
  readonly idJobPositionCatalogItem: string | null;
  readonly hireDate: string;
  readonly birthDate: string | null;
  readonly birthPlace: string | null;
  readonly sex: string | null;
  readonly maritalStatus: string | null;
  readonly rfc: string | null;
  readonly curp: string | null;
  readonly socialSecurityNumber: string | null;
  readonly voterIdNumber: string | null;
  readonly driverLicenseNumber: string | null;
  readonly militaryServiceCardNumber: string | null;
  readonly email: string | null;
  readonly mobilePhone: string | null;
  readonly homePhone: string | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly address: string | null;
  readonly municipality: string | null;
  readonly state: string | null;
  readonly countryCode?: string | null;
  readonly postalCode: string | null;
  readonly housingType: string | null;
  readonly residenceSinceDate: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
};

export type EmployeeInput = Omit<
  Employee,
  'idEmployee' | 'codeEmployee' | 'status' | 'active' | 'createdAt' | 'updatedAt'
>;

export type CreateEmployee = EmployeeInput & {
  readonly codeEmployee: string;
};

export type EmployeeDocument = {
  readonly idEmployeeDocument: string;
  readonly idEmployee: string;

  /**
   * De qué es el documento, como enum. <b>Rastro heredado.</b>
   *
   * <p>La categoría de verdad es `idDocumentCategoryCatalogItem`. Esta columna se conserva llena
   * mientras queden expedientes anteriores a la conversión del 19 de septiembre de 2026, y nada
   * decide por ella.</p>
   */
  readonly documentType: EmployeeDocumentType;

  /** La categoría, contra el catálogo que la organización edita. */
  readonly idDocumentCategoryCatalogItem: string | null;
  readonly documentCategoryName: string | null;
  readonly status: EmployeeDocumentStatus;
  readonly documentNumber: string | null;
  readonly receivedDate: string | null;
  readonly issuedDate: string | null;
  readonly expiresDate: string | null;
  readonly storageReference: string | null;
  readonly notes: string | null;
  readonly active: boolean;
  /**
   * El archivo que cubre este requisito.
   *
   * <p>Nulo significa que el requisito se registro sin pasar por la carga de un archivo, que es el
   * caso de todo lo que existia antes de que hubiera pantalla para subirlo.</p>
   */
  readonly idBusinessDocument: string | null;
};

export type EmployeeDocumentInput = Omit<EmployeeDocument, 'idEmployeeDocument' | 'active' | 'documentCategoryName'> & {
  readonly idOrganization: string;
};

export type EmployeeEvaluation = {
  readonly idEmployeeEvaluation: string;
  readonly idEmployee: string;

  /** Qué evaluación es, como enum. <b>Rastro heredado</b>, igual que en el documento. */
  readonly evaluationType: EmployeeEvaluationType;

  /** La categoría, contra el catálogo que la organización edita. */
  readonly idEvaluationCategoryCatalogItem: string | null;
  readonly evaluationCategoryName: string | null;
  readonly result: EmployeeEvaluationResult;
  readonly evaluatedDate: string;
  readonly expiresDate: string | null;
  readonly certificateNumber: string | null;
  readonly storageReference: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type EmployeeEvaluationInput = Omit<EmployeeEvaluation, 'idEmployeeEvaluation' | 'active' | 'evaluationCategoryName'> & {
  readonly idOrganization: string;
};

export type EmployeeDetail = {
  readonly employee: Employee;
  readonly documents: readonly EmployeeDocument[];
  readonly evaluations: readonly EmployeeEvaluation[];
};

export type PagedResult<T> = {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};
