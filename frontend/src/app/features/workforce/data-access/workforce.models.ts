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
  readonly documentType: EmployeeDocumentType;
  readonly status: EmployeeDocumentStatus;
  readonly documentNumber: string | null;
  readonly receivedDate: string | null;
  readonly issuedDate: string | null;
  readonly expiresDate: string | null;
  readonly storageReference: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type EmployeeDocumentInput = Omit<EmployeeDocument, 'idEmployeeDocument' | 'active'> & {
  readonly idOrganization: string;
};

export type EmployeeEvaluation = {
  readonly idEmployeeEvaluation: string;
  readonly idEmployee: string;
  readonly evaluationType: EmployeeEvaluationType;
  readonly result: EmployeeEvaluationResult;
  readonly evaluatedDate: string;
  readonly expiresDate: string | null;
  readonly certificateNumber: string | null;
  readonly storageReference: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type EmployeeEvaluationInput = Omit<EmployeeEvaluation, 'idEmployeeEvaluation' | 'active'> & {
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
