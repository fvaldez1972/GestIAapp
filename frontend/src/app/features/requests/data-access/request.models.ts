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

export type PagedResult<T> = {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};
