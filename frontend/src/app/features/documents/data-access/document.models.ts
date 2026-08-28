import { PagedResult } from '../../clients/data-access/client.models';

export type BusinessDocumentOwnerType =
  | 'Client'
  | 'ServiceContract'
  | 'Service'
  | 'Employee'
  | 'EmployeeEvaluation'
  | 'OperationalRequest';

export type BusinessDocumentStatus = 'PendingReview' | 'Validated' | 'Rejected' | 'Expired' | 'Archived';

export type BusinessDocument = {
  readonly idBusinessDocument: string;
  readonly idOrganization: string;
  readonly ownerType: BusinessDocumentOwnerType;
  readonly ownerId: string;
  readonly ownerLabel: string;
  readonly category: string;
  readonly title: string;
  readonly status: BusinessDocumentStatus;
  readonly issuedDate: string | null;
  readonly expiresDate: string | null;
  readonly isExpired: boolean;
  readonly storageReference: string;
  readonly isSensitive: boolean;
  readonly notes: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
};

export type BusinessDocumentInput = {
  readonly idOrganization: string;
  readonly ownerType: BusinessDocumentOwnerType;
  readonly ownerId: string;
  readonly category: string;
  readonly title: string;
  readonly status: BusinessDocumentStatus;
  readonly issuedDate: string | null;
  readonly expiresDate: string | null;
  readonly storageReference: string;
  readonly isSensitive: boolean;
  readonly notes: string | null;
};

export type BusinessDocumentPage = PagedResult<BusinessDocument>;

export type FileUploadResponse = {
  readonly originalFileName: string;
  readonly contentType: string;
  readonly size: number;
  readonly storageReference: string;
};
