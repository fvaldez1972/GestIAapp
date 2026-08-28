export type OperationalRequestType =
  | 'NewClient'
  | 'NewService'
  | 'ServiceChange'
  | 'CoverageSupport'
  | 'StaffChange'
  | 'Other';

export type OperationalRequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'InReview'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

export type OperationalRequestPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type OperationalRequest = {
  readonly idOperationalRequest: string;
  readonly idOrganization: string;
  readonly organizationName: string;
  readonly idClient: string | null;
  readonly clientName: string | null;
  readonly idService: string | null;
  readonly serviceName: string | null;
  readonly codeOperationalRequest: string;
  readonly requestType: OperationalRequestType;
  readonly status: OperationalRequestStatus;
  readonly priority: OperationalRequestPriority;
  readonly title: string;
  readonly description: string;
  readonly requestedByName: string;
  readonly neededByDate: string | null;
  readonly resolutionNotes: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
};

export type OperationalRequestInput = {
  readonly idOrganization: string;
  readonly idClient: string | null;
  readonly idService: string | null;
  readonly requestType: OperationalRequestType;
  readonly priority: OperationalRequestPriority;
  readonly title: string;
  readonly description: string;
  readonly requestedByName: string;
  readonly neededByDate: string | null;
};

export type CreateOperationalRequest = OperationalRequestInput & {
  readonly codeOperationalRequest: string;
};

export type ChangeOperationalRequestStatus = {
  readonly idOrganization: string;
  readonly status: OperationalRequestStatus;
  readonly resolutionNotes: string | null;
};

export type ExecuteOperationalRequest = {
  readonly idOrganization: string;
  readonly executionNotes: string | null;
  readonly client?: OperationalRequestClientInput;
  readonly clientSite?: OperationalRequestClientSiteInput;
  readonly serviceContract?: OperationalRequestServiceContractInput;
  readonly service?: OperationalRequestServiceInput;
  readonly serviceConfiguration?: OperationalRequestServiceConfigurationInput;
  readonly staffAssignment?: OperationalRequestStaffAssignmentInput;
  readonly coverage?: OperationalRequestCoverageInput;
};

export type ExecuteOperationalRequestResult = {
  readonly request: OperationalRequest;
  readonly outcome: string;
  readonly warnings: readonly string[];
  readonly executedEntityKind: string | null;
  readonly executedEntityId: string | null;
};

export type OperationalRequestClientInput = {
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
};

export type OperationalRequestClientSiteInput = {
  readonly codeClientSite: string;
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

export type OperationalRequestServiceContractInput = {
  readonly codeServiceContract: string;
  readonly status: string;
  readonly signedDate: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly paymentTermDays: number;
  readonly terminationNoticeDays: number;
  readonly currencyCode: string | null;
  readonly documentReference: string | null;
  readonly notes: string | null;
};

export type OperationalRequestServiceInput = {
  readonly idClientSite: string | null;
  readonly idServiceContract: string | null;
  readonly codeService: string;
  readonly name: string;
  readonly description: string;
  readonly invoiceDescription: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
};

export type OperationalRequestServiceConfigurationInput = {
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

export type OperationalRequestStaffAssignmentInput = {
  readonly idEmployee: string;
  readonly idPosition: string;
  readonly assignmentType: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isPrimary: boolean;
  readonly notes: string | null;
};

export type OperationalRequestCoverageInput = {
  readonly idScheduledShift: string;
  readonly idReplacementEmployee: string;
  readonly coverageStartTime: string;
  readonly coverageEndTime: string;
  readonly isOvernight: boolean;
  readonly status: string;
  readonly notes: string | null;
};

export type PagedResult<T> = {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};
