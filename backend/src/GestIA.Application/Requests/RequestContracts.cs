using GestIA.Application.Common;
using GestIA.Domain.Requests;

namespace GestIA.Application.Requests;

public sealed record CreateOperationalRequestRequest(
    Guid IdOrganization,
    Guid? IdClient,
    Guid? IdService,
    string CodeOperationalRequest,
    OperationalRequestType RequestType,
    OperationalRequestPriority Priority,
    string Title,
    string Description,
    string RequestedByName,
    DateOnly? NeededByDate);

public sealed record UpdateOperationalRequestRequest(
    Guid IdOrganization,
    Guid? IdClient,
    Guid? IdService,
    OperationalRequestType RequestType,
    OperationalRequestPriority Priority,
    string Title,
    string Description,
    string RequestedByName,
    DateOnly? NeededByDate);

public sealed record ChangeOperationalRequestStatusRequest(
    Guid IdOrganization,
    OperationalRequestStatus Status,
    string? ResolutionNotes);

public sealed record OperationalRequestResponse(
    Guid IdOperationalRequest,
    Guid IdOrganization,
    string OrganizationName,
    Guid? IdClient,
    string? ClientName,
    Guid? IdService,
    string? ServiceName,
    string CodeOperationalRequest,
    OperationalRequestType RequestType,
    OperationalRequestStatus Status,
    OperationalRequestPriority Priority,
    string Title,
    string Description,
    string RequestedByName,
    DateOnly? NeededByDate,
    string? ResolutionNotes,
    bool Active,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record OperationalRequestQuery(
    Guid IdOrganization,
    OperationalRequestStatus? Status,
    OperationalRequestType? RequestType,
    string? Search,
    int Page,
    int PageSize);

public sealed record OperationalRequestSearchCriteria(
    Guid IdOrganization,
    OperationalRequestStatus? Status,
    OperationalRequestType? RequestType,
    string? Search,
    int Skip,
    int Take);

public sealed record OperationalRequestSearchResult(
    IReadOnlyList<OperationalRequest> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public PagedResult<OperationalRequestResponse> ToPagedResult(
        Func<OperationalRequest, OperationalRequestResponse> map) =>
        new(Items.Select(map).ToArray(), TotalCount, Page, PageSize);
}
