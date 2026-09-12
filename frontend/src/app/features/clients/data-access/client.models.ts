export type Organization = {
  readonly idOrganization: string;
  readonly codeOrganization: string;
  readonly legalName: string;
  readonly rfc: string | null;
  readonly active: boolean;
};

export type CreateOrganization = {
  readonly codeOrganization: string;
  readonly legalName: string;
  readonly rfc: string | null;
};

export type UpdateOrganization = CreateOrganization;

/**
 * El alta de una organizacion junto con su administrador inicial.
 *
 * <p>El codigo va aparte de <c>CreateOrganization</c> porque aqui es <b>opcional</b>: cuando no se
 * manda, lo pone el servidor con la forma <c>ORG-01</c>. Pedirselo a quien da de alta una empresa
 * le hace inventar una convencion que el sistema ya tiene, y el codigo no es la clave del
 * registro sino un identificador de conveniencia.</p>
 */
export type CreateOrganizationWithAdmin = Omit<CreateOrganization, 'codeOrganization'> & {
  readonly codeOrganization?: string | null;
  readonly admin: {
    readonly displayName: string;
    readonly email: string;
    readonly password: string;
  };
};

export type OrganizationProvisioningResult = {
  readonly organization: Organization;
  readonly idAdminUser: string;
  readonly adminEmail: string;
  readonly adminDisplayName: string;
};

export type OrganizationClientSummary = {
  readonly idClient: string;
  readonly codeClient: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly active: boolean;
};

export type OrganizationGovernanceSummary = {
  readonly organization: Organization;
  readonly clients: readonly OrganizationClientSummary[];
  readonly usersCount: number;
  readonly adminsCount: number;
};

export type Client = {
  readonly idClient: string;
  readonly idOrganization: string;
  readonly organizationName: string;
  readonly codeClient: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly nationality: string | null;
  readonly taxActivity: string | null;
  readonly taxAddress: string | null;
  readonly publicRegistryDate: string | null;
  readonly commercialRegistryFolio: string | null;
  readonly employerRegistrationNumber: string | null;
  readonly incorporationDate: string | null;
  readonly incorporationDeedNumber: string | null;
  readonly legalRepresentativeInstrumentNumber: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
};

export type ClientInput = {
  readonly idOrganization: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly nationality: string | null;
  readonly taxActivity: string | null;
  readonly taxAddress: string | null;
  readonly publicRegistryDate: string | null;
  readonly commercialRegistryFolio: string | null;
  readonly employerRegistrationNumber: string | null;
  readonly incorporationDate: string | null;
  readonly incorporationDeedNumber: string | null;
  readonly legalRepresentativeInstrumentNumber: string | null;
};

/**
 * El alta de un cliente.
 *
 * <p><c>codeClient</c> es opcional: cuando no va, <b>lo genera el servidor</b> con la forma
 * <c>CLI-01</c>. Es un identificador que después sirve para buscar, pero que nadie sabe inventar
 * al dar de alta.</p>
 */
export type CreateClient = ClientInput & {
  readonly codeClient?: string;
};

export type ClientSite = {
  readonly idClientSite: string;
  readonly idClient: string;
  readonly codeClientSite: string;
  readonly name: string;
  readonly street: string;
  readonly exteriorNumber: string | null;
  readonly interiorNumber: string | null;
  readonly neighborhood: string | null;
  readonly municipality: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly accessInstructions: string | null;
  readonly timeZoneId: string | null;
  readonly active: boolean;
};

export type ClientSiteInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly name: string;
  readonly street: string;
  readonly exteriorNumber: string | null;
  readonly interiorNumber: string | null;
  readonly neighborhood: string | null;
  readonly municipality: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string | null;
  readonly accessInstructions: string | null;
  readonly timeZoneId: string | null;
};

export type CreateClientSite = ClientSiteInput & {
  readonly codeClientSite: string;
};

export type ClientContactPurpose =
  | 'Administrative'
  | 'Operational'
  | 'Billing'
  | 'Legal'
  | 'Emergency'
  | 'Payments'
  | 'Purchasing'
  | 'InternalSecurity';

export type ClientContact = {
  readonly idClientContact: string;
  readonly idClient: string;
  readonly idClientSite: string | null;
  readonly clientSiteName: string | null;
  readonly purpose: ClientContactPurpose;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobilePhone: string | null;
  readonly isPrimary: boolean;
  readonly active: boolean;
};

export type ClientContactInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idClientSite: string | null;
  readonly purpose: ClientContactPurpose;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobilePhone: string | null;
  readonly isPrimary: boolean;
};

export type ServiceContractStatus =
  | 'Draft'
  | 'UnderReview'
  | 'Executed'
  | 'Effective'
  | 'Expired'
  | 'Terminated';

export type ServiceContract = {
  readonly idServiceContract: string;
  readonly idClient: string;
  readonly codeServiceContract: string;
  readonly status: ServiceContractStatus;
  readonly signedDate: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly paymentTermDays: number;
  readonly terminationNoticeDays: number;
  readonly currencyCode: string;
  readonly documentReference: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ServiceContractInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly status: ServiceContractStatus;
  readonly signedDate: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly paymentTermDays: number;
  readonly terminationNoticeDays: number;
  readonly currencyCode: string | null;
  readonly documentReference: string | null;
  readonly notes: string | null;
};

export type CreateServiceContract = ServiceContractInput & {
  readonly codeServiceContract: string;
};

export type ManagedService = {
  readonly idService: string;
  readonly idClient: string;
  readonly idClientSite: string;
  readonly clientSiteName: string | null;
  readonly idServiceContract: string | null;
  readonly serviceContractCode: string | null;
  readonly codeService: string;
  readonly name: string;
  readonly description: string;
  readonly invoiceDescription: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly active: boolean;
};

export type ManagedServiceInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idClientSite: string;
  readonly idServiceContract: string | null;
  readonly name: string;
  readonly description: string;
  readonly invoiceDescription: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
};

export type CreateManagedService = ManagedServiceInput & {
  readonly codeService: string;
};

export type ServiceConfiguration = {
  readonly idServiceConfiguration: string;
  readonly idService: string;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly requiredWorkerCount: number;
  readonly hoursPerDay: number;
  readonly daysPerWeek: number;
  readonly averageWeeklyHours: number;
  readonly averageMonthlyHours: number;
  readonly preparationLeadDays: number;
  readonly workScheduleDescription: string;
  readonly specificInstructions: string | null;
  readonly monthlyPrice: number;
  readonly currencyCode: string;
  readonly isTaxIncluded: boolean;
  readonly active: boolean;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al guardar; si alguien
   * corrigió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

export type ServiceConfigurationInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly requiredWorkerCount: number;
  readonly hoursPerDay: number;
  readonly daysPerWeek: number;
  readonly averageMonthlyHours: number;
  readonly preparationLeadDays: number;
  readonly workScheduleDescription: string;
  readonly specificInstructions: string | null;
  readonly monthlyPrice: number;
  readonly currencyCode: string | null;
  readonly isTaxIncluded: boolean;
};

/** La corrección de una configuración. Mismo criterio que `ServiceAssignmentCorrectionInput`. */
export type ServiceConfigurationCorrectionInput = ServiceConfigurationInput & {
  readonly rowVersion: string;
  /** Por qué se corrige. Obligatorio cuando la regla del servidor lo exige. */
  readonly correctionReason?: string;
};

export type ServicePosition = {
  readonly idPosition: string;
  readonly idService: string;
  readonly codePosition: string;
  readonly name: string;
  readonly requiredWorkerCount: number;
  readonly requiredSkillProfile: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ServicePositionInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly name: string;
  readonly requiredWorkerCount: number;
  readonly requiredSkillProfile: string | null;
  readonly notes: string | null;
};

export type CreateServicePosition = ServicePositionInput & {
  readonly codePosition: string;
};

export type ShiftPattern = {
  readonly idShiftPattern: string;
  readonly idPosition: string;
  readonly codeShiftPattern: string;
  readonly name: string;
  readonly description: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly active: boolean;
};

export type ShiftPatternInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idPosition: string;
  readonly name: string;
  readonly description: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
};

export type CreateShiftPattern = ShiftPatternInput & {
  readonly codeShiftPattern: string;
};

export type ShiftSegment = {
  readonly idShiftSegment: string;
  readonly idShiftPattern: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly requiredWorkerCount: number;
  readonly durationMinutes: number;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ShiftSegmentInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idPosition: string;
  readonly idShiftPattern: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly requiredWorkerCount: number;
  readonly notes: string | null;
};

export type ServiceAssignmentType = 'Primary' | 'Support' | 'Relief' | 'TemporaryReplacement';

export type ServiceAssignment = {
  readonly idServiceAssignment: string;
  readonly idEmployee: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly idService: string;
  readonly idPosition: string | null;
  readonly positionCode: string | null;
  readonly positionName: string | null;
  readonly assignmentType: ServiceAssignmentType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isPrimary: boolean;
  readonly notes: string | null;
  readonly active: boolean;
  /** Token de concurrencia. Ver la nota de `ServiceConfiguration`. */
  readonly rowVersion: string;
};

/** Los campos que comparten el alta y la corrección de una asignación. Sin token: el alta no lo tiene. */
export type ServiceAssignmentInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idPosition: string;
  readonly assignmentType: ServiceAssignmentType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isPrimary: boolean;
  readonly notes: string | null;
};

export type CreateServiceAssignment = ServiceAssignmentInput & {
  readonly idEmployee: string;
};

/**
 * La corrección de una asignación.
 *
 * El token es obligatorio y el tipo es distinto del alta a propósito. Antes los dos usaban
 * `ServiceAssignmentInput` con `rowVersion?`, y como el alta no podía traerlo, la corrección
 * tampoco lo exigía: la pantalla nunca lo mandó y el servidor guardaba sin comprobar nada.
 */
export type ServiceAssignmentCorrectionInput = ServiceAssignmentInput & {
  readonly rowVersion: string;
  /** Por qué se corrige. Obligatorio cuando la regla del servidor lo exige. */
  readonly correctionReason?: string;
};

export type ScheduleVersionStatus = 'Draft' | 'Published' | 'Superseded';

export type ScheduleVersion = {
  readonly idScheduleVersion: string;
  readonly idService: string;
  readonly name: string;
  readonly periodStartDate: string;
  readonly periodEndDate: string;
  readonly status: ScheduleVersionStatus;
  readonly publishedAt: string | null;
  readonly publishedByName: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ScheduleVersionInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly name: string;
  readonly periodStartDate: string;
  readonly periodEndDate: string;
  readonly notes: string | null;
};

export type ScheduledShift = {
  readonly idScheduledShift: string;
  readonly idScheduleVersion: string;
  readonly idPosition: string;
  readonly positionCode: string;
  readonly positionName: string;
  readonly idEmployee: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly shiftDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly durationMinutes: number;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ScheduledShiftInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduleVersion: string;
  readonly idPosition: string;
  readonly idEmployee: string;
  readonly shiftDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly notes: string | null;
};

export type GenerateScheduledShiftsRequest = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduleVersion: string;
  readonly skipExisting: boolean;
};

export type GenerateScheduledShiftsResponse = {
  readonly createdShifts: number;
  readonly skippedShifts: number;
  readonly missingAssignments: number;
  readonly warnings: readonly string[];
};

export type AttendanceStatus = 'Expected' | 'Present' | 'Late' | 'Absent' | 'Excused';

export type AttendanceRecord = {
  readonly idAttendanceRecord: string;
  readonly idScheduledShift: string;
  readonly idEmployee: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly attendanceDate: string;
  readonly status: AttendanceStatus;
  readonly actualStartTime: string | null;
  readonly actualEndTime: string | null;
  readonly minutesLate: number;
  readonly notes: string | null;
  readonly active: boolean;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

export type UpsertAttendanceRecord = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduledShift: string;
  readonly status: AttendanceStatus;
  readonly actualStartTime: string | null;
  readonly actualEndTime: string | null;
  readonly minutesLate: number;
  readonly notes: string | null;
  /**
   * **Este campo no existe en el servidor y nunca existió.** `UpsertAttendanceRequest` no lo
   * declara, así que todo lo que se escribía en él se descartaba en silencio al llegar. Es el mismo
   * defecto de la transición T3 —el frontend mandaba `clientId` donde el endpoint esperaba
   * `idClient`— con otra cara: un campo que parece guardarse y no se guarda.
   *
   * Se conserva un momento porque la pantalla vieja todavía lo declara en su formulario, y esa
   * pantalla se retira cuando Incidencias y Cobertura se rehagan. **No lo uses en pantalla nueva.**
   * Lo que sí lee el servidor es `correctionReason`, aquí abajo.
   *
   * @deprecated El servidor lo ignora. Usa `correctionReason`.
   */
  readonly correctionAuthorizationNotes?: string | null;
  /**
   * El **permiso previo** para corregir: una autorización ya aprobada que apunta a este registro.
   * No es la explicación del cambio.
   */
  readonly idApprovalRequest?: string | null;
  /**
   * El **motivo de la corrección**: qué se hizo y por qué. Viaja a la bitácora del registro.
   *
   * <p>Es otra cosa que la autorización, y se pide por otra condición: el motivo lo exige el
   * servidor cuando el día está cerrado; la autorización, cuando los datos cambiaron.</p>
   */
  readonly correctionReason?: string;
  /**
   * **La única entrada donde el token es opcional**, porque este endpoint crea o corrige con la
   * misma petición y un alta no tiene versión previa. En cuanto la asistencia ya existe el
   * servidor lo exige y responde 428 si falta, así que opcional aquí significa «opcional al dar
   * de alta», no «se puede omitir al corregir».
   */
  readonly rowVersion?: string;
};

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentStatus = 'Open' | 'InReview' | 'Resolved' | 'Cancelled';

export type Incident = {
  readonly idIncident: string;
  readonly idService: string;
  readonly idScheduledShift: string | null;
  readonly idEmployee: string | null;
  readonly employeeCode: string | null;
  readonly employeeName: string | null;
  readonly incidentDate: string;
  readonly incidentType: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly resolutionNotes: string | null;
  readonly active: boolean;
  /**
   * Cuándo se registró, en UTC.
   *
   * <p>Está para una marca que no se guarda: una incidencia es «posterior al cierre» si se creó
   * después del `closedAt` del cierre vigente. Es reconstruible, como la vacancia de posiciones,
   * pero sin este instante no se puede reconstruir nada.</p>
   */
  readonly createdAt: string;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

/**
 * El **alta** de una incidencia. No lleva token porque no hay versión previa que pisar.
 *
 * La corrección es otro tipo, `IncidentCorrectionInput`, y no por gusto: mientras alta y corrección
 * compartieron un solo tipo, el token no podía ser obligatorio en ninguna de las dos —el alta no
 * lo tiene— y esa imposibilidad se leyó como permiso para no mandarlo nunca.
 */
export type IncidentInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduledShift: string | null;
  readonly idEmployee: string | null;
  readonly incidentDate: string;
  readonly incidentType: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly resolutionNotes: string | null;
};

/** La corrección de una incidencia. El token es obligatorio: aquí sí hay algo que pisar. */
export type IncidentCorrectionInput = IncidentInput & {
  readonly rowVersion: string;
  /** Por qué se corrige. Obligatorio cuando la regla del servidor lo exige. */
  readonly correctionReason?: string;
};

export type CoverageStatus = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled';

export type CoverageRecord = {
  readonly idCoverageReason?: string | null;
  readonly idCoverageRecord: string;
  readonly idScheduledShift: string;
  readonly idOriginalEmployee: string;
  readonly originalEmployeeCode: string;
  readonly originalEmployeeName: string;
  readonly idReplacementEmployee: string;
  readonly replacementEmployeeCode: string;
  readonly replacementEmployeeName: string;
  readonly coverageStartTime: string;
  readonly coverageEndTime: string;
  readonly isOvernight: boolean;
  readonly durationMinutes: number;
  readonly status: CoverageStatus;
  readonly notes: string | null;
  readonly active: boolean;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

export type CoverageInput = {
  readonly idCoverageReason?: string | null;
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduledShift: string;
  readonly idReplacementEmployee: string;
  readonly coverageStartTime: string;
  readonly coverageEndTime: string;
  readonly isOvernight: boolean;
  readonly status: CoverageStatus;
  readonly notes: string | null;
};

/** La corrección de una cobertura. Mismo criterio que `IncidentCorrectionInput`. */
export type CoverageCorrectionInput = CoverageInput & {
  readonly rowVersion: string;
  /** Por qué se corrige. Obligatorio cuando la regla del servidor lo exige. */
  readonly correctionReason?: string;
};

export type OperationEvidenceType = 'Photo' | 'Document' | 'Report' | 'Signature' | 'Other';

export type OperationEvidence = {
  readonly idOperationEvidence: string;
  readonly idService: string;
  readonly idAttendanceRecord: string | null;
  readonly idIncident: string | null;
  readonly idCoverageRecord: string | null;
  readonly evidenceType: OperationEvidenceType;
  readonly title: string;
  readonly storageReference: string;
  readonly notes: string | null;
  readonly active: boolean;
};

export type OperationEvidenceInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idAttendanceRecord: string | null;
  readonly idIncident: string | null;
  readonly idCoverageRecord: string | null;
  readonly evidenceType: OperationEvidenceType;
  readonly title: string;
  readonly storageReference: string;
  readonly notes: string | null;
};

export type FileUploadResponse = {
  readonly originalFileName: string;
  readonly contentType: string;
  readonly size: number;
  readonly storageReference: string;
};

export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export type ApprovalRequestType =
  | 'AttendanceCorrection'
  | 'IncidentClosure'
  | 'CoverageCorrection'
  | 'ServiceConfigurationChange'
  | 'DocumentException'
  | 'Other';

export type ApprovalRequest = {
  readonly idApprovalRequest: string;
  readonly idOrganization: string;
  readonly idService: string;
  readonly approvalType: ApprovalRequestType;
  readonly entityType: string;
  readonly entityId: string;
  readonly reason: string;
  readonly requestedChangeSummary: string | null;
  readonly assignedApproverName: string | null;
  readonly idOperationEvidence: string | null;
  readonly status: ApprovalRequestStatus;
  readonly requestedAt: string;
  readonly requestedByName: string;
  readonly decidedAt: string | null;
  readonly decidedByName: string | null;
  readonly decisionNotes: string | null;
  readonly active: boolean;
};

export type CreateApprovalRequest = {
  readonly idOrganization: string;
  readonly idService: string;
  readonly approvalType: ApprovalRequestType;
  readonly entityType: string;
  readonly entityId: string;
  readonly reason: string;
  readonly requestedChangeSummary: string | null;
  readonly assignedApproverName: string | null;
  readonly idOperationEvidence: string | null;
};

export type DecideApprovalRequest = {
  readonly idOrganization: string;
  readonly status: ApprovalRequestStatus;
  readonly decisionNotes: string | null;
};

export type OperationDayClosureStatus = 'Closed' | 'Reopened';

export type OperationDayClosure = {
  readonly idOperationDayClosure: string;
  readonly idOrganization: string;
  readonly idService: string;
  readonly operationDate: string;
  readonly expectedShifts: number;
  readonly attendanceRecords: number;
  readonly pendingAttendance: number;
  readonly openIncidents: number;
  readonly coverageRecords: number;
  readonly notes: string | null;
  readonly status: OperationDayClosureStatus;
  readonly closedAt: string;
  readonly closedByName: string;
  readonly reopenedAt: string | null;
  readonly reopenedByName: string | null;
  readonly reopenReason: string | null;
  readonly active: boolean;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

export type CloseOperationDay = {
  readonly idOrganization: string;
  readonly operationDate: string;
  readonly notes: string | null;
};

export type ReopenOperationDay = {
  readonly idOrganization: string;
  readonly reason: string;
  /** El token del cierre que se está reabriendo. Reabrir es corregir. */
  readonly rowVersion: string;
};

export type OperationsSummary = {
  readonly attendanceRecords: number;
  readonly presentAttendance: number;
  readonly lateAttendance: number;
  readonly absentAttendance: number;
  readonly excusedAttendance: number;
  readonly incidents: number;
  readonly openIncidents: number;
  readonly criticalIncidents: number;
  readonly coverageRecords: number;
  readonly confirmedCoverages: number;
  readonly completedCoverages: number;
  readonly coveredMinutes: number;
  readonly pendingApprovals: number;
  readonly closedOperationDays: number;
};

export type OperationsServiceSummary = OperationsSummary & {
  readonly idClient: string;
  readonly clientName: string;
  readonly idService: string;
  readonly codeService: string;
  readonly serviceName: string;
};

export type WorkforceEligibilityReport = {
  readonly idEmployee: string;
  readonly codeEmployee: string;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly isEligible: boolean;
  readonly reasons: readonly string[];
  readonly expiredDocuments: number;
  readonly rejectedDocuments: number;
  readonly invalidEvaluations: number;
};

export type PagedResult<T> = {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

/**
 * Un cliente en el listado.
 *
 * <p>Trae los conteos resueltos por el servidor. El que importa es <c>siteCount</c>: <b>la sede es
 * el prerrequisito para crear servicios</b>, porque el servicio se liga a una sede. Saberlo aquí
 * es lo que permite decirlo en esta pantalla en vez de dejar que el usuario se estrelle en la
 * siguiente.</p>
 */
export type ClientListItem = {
  readonly idClient: string;
  readonly idOrganization: string;
  readonly codeClient: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly siteCount: number;
  readonly sitesWithoutContact: number;
  readonly contactCount: number;
  readonly serviceCount: number;
  readonly mainSiteName: string | null;
  readonly mainSiteMunicipality: string | null;
  readonly mainSiteState: string | null;
};

/** Los tres modos del listado. Coincide con el enum del servidor. */
export type ClientStatusFilter = 'Active' | 'Inactive' | 'All';

/** Si el cliente tiene sede: el filtro que separa a los que pueden tener servicios. */
export type ClientSitePresenceFilter = 'Any' | 'WithSite' | 'WithoutSite';

/** El nombre que se muestra. El comercial manda; muchos clientes no lo tienen. */
export const clientDisplayName = (client: {
  readonly tradeName: string | null;
  readonly legalName: string;
}) => client.tradeName ?? client.legalName;

/**
 * Dónde está el cliente, según su sede principal.
 *
 * <p>El bosquejo pedía «Zona · Municipio», y <b>la zona no existe en el modelo</b>: ni el cliente
 * ni la sede la tienen, y el catálogo <c>Zone</c> no lo referencia ninguna entidad. Lo que sí
 * existe, y es lo que se muestra, es el estado y el municipio de la sede.</p>
 */
export function clientLocation(client: ClientListItem): string {
  if (!client.mainSiteMunicipality) {
    return 'Sin ubicación: no tiene sede';
  }

  return client.mainSiteState
    ? `${client.mainSiteState} · ${client.mainSiteMunicipality}`
    : client.mainSiteMunicipality;
}

/**
 * Lo que dice la columna de sedes.
 *
 * <p><b>Cero sedes no se muestra como cero.</b> Un cero diría que está en orden, y lo que dice de
 * verdad es que a este cliente no se le puede crear un servicio. Va como raya más la palabra.</p>
 */
export type ClientSiteBadge = {
  readonly value: string;
  readonly pill: string;
  readonly tone: 'danger' | 'warning' | 'muted' | 'none';
};

export function clientSiteBadge(client: ClientListItem): ClientSiteBadge {
  if (client.siteCount === 0) {
    return { value: '—', pill: 'Sin sede', tone: 'warning' };
  }

  if (client.sitesWithoutContact > 0) {
    return {
      value: String(client.siteCount),
      pill: client.sitesWithoutContact === 1 ? '1 sin contacto' : `${client.sitesWithoutContact} sin contacto`,
      tone: 'muted',
    };
  }

  return { value: String(client.siteCount), pill: '', tone: 'none' };
}

/**
 * Por qué no se puede crear un servicio de este cliente, o cadena vacía si sí se puede.
 *
 * <p>La razón se escribe al lado del botón bloqueado. Un botón gris sin explicación obliga a
 * adivinar, y quien adivina mal se va a Servicios a intentarlo de todos modos.</p>
 */
export const clientServiceBlockReason = (client: { readonly siteCount: number }) =>
  client.siteCount === 0 ? 'No se puede crear el servicio: falta la sede a la que se ligaría.' : '';
