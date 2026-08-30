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

export type CreateClient = ClientInput & {
  readonly codeClient: string;
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
};

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
  readonly correctionAuthorizationNotes?: string | null;
  readonly idApprovalRequest?: string | null;
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
};

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

export type CoverageStatus = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled';

export type CoverageRecord = {
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
};

export type CoverageInput = {
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
};

export type CloseOperationDay = {
  readonly idOrganization: string;
  readonly operationDate: string;
  readonly notes: string | null;
};

export type ReopenOperationDay = {
  readonly idOrganization: string;
  readonly reason: string;
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
