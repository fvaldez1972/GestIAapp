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
  /** Qué es de la persona quien figura como contacto de emergencia. Texto libre. */
  readonly emergencyContactRelationship: string | null;
  /**
   * El domicilio en una sola línea. <b>Rastro heredado.</b>
   *
   * <p>La calle y el número viven ahora aparte. Esto se conserva con lo que hubiera, y su contenido
   * se copió tal cual a la calle sin intentar partirlo: adivinar dónde acaba la vialidad y empieza
   * el número acierta en «Juárez 123» y falla en «Calzada de los 100 Metros 45».</p>
   */
  readonly address: string | null;

  /** La vialidad, sin el número. */
  readonly street: string | null;

  /** El número, alfanumérico: admite «45-A» o «123 int. 4». */
  readonly streetNumber: string | null;
  /**
   * Hasta dónde estudió, del catálogo de escolaridad.
   *
   * <p>Por identificador y no texto, para que se pueda comparar contra lo que pide la posición, que
   * lo guarda igual. Nulo dice «no se sabe», no «no cumple»: la columna nació el 19 de septiembre
   * de 2026 y ningún expediente la traía.</p>
   */
  readonly idEducationLevelCatalogItem: string | null;

  /** La colonia del domicilio. Texto libre por la decisión D-05. */
  readonly neighborhood: string | null;
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

  /**
   * Si el documento lleva datos personales que piden trato especial.
   *
   * <p><b>Hoy es una clasificación, no un permiso.</b> Marca el papel para que quien administra la
   * organización sepa qué está guardando; convertirla en una restricción de acceso es una decisión
   * aparte, con su comprobación en el servidor. La pantalla lo dice así para que marcar la casilla
   * no haga creer que esa restricción ya existe.</p>
   */
  readonly isSensitive: boolean;
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
