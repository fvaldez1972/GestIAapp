using GestIA.Application.Common;

namespace GestIA.Application.Audit;

public sealed record AuditQuery(
    Guid IdOrganization,
    string? Entity,
    string? Search,
    DateOnly? FromDate,
    DateOnly? ToDate,
    int Page,
    int PageSize);

public sealed record AuditEventResponse(
    string Entity,
    string EntityName,
    Guid RecordId,
    string Action,
    string ActorName,
    DateTime OccurredAt,
    bool Active,
    string? Details);

public sealed record AuditResult(
    PagedResult<AuditEventResponse> Events,
    IReadOnlyList<string> AvailableEntities);
