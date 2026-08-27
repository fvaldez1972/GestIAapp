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

export type PagedResult<T> = {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};
