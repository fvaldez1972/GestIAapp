export type AuditEvent = {
  readonly entity: string;
  readonly entityName: string;
  readonly recordId: string;
  readonly action: string;
  readonly actorName: string;
  readonly occurredAt: string;
  readonly active: boolean;
  readonly details: string | null;
};

export type PagedResult<T> = {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

export type AuditResult = {
  readonly events: PagedResult<AuditEvent>;
  readonly availableEntities: readonly string[];
};
