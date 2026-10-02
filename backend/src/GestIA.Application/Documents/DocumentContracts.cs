using GestIA.Application.Common;
using GestIA.Domain.Documents;

namespace GestIA.Application.Documents;

public sealed record CreateBusinessDocumentRequest(
    Guid IdOrganization,
    BusinessDocumentOwnerType OwnerType,
    Guid OwnerId,
    string Category,
    string Title,
    BusinessDocumentStatus Status,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string StorageReference,
    bool IsSensitive,
    string? Notes);

public sealed record UpdateBusinessDocumentRequest(
    Guid IdOrganization,
    BusinessDocumentOwnerType OwnerType,
    Guid OwnerId,
    string Category,
    string Title,
    BusinessDocumentStatus Status,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string StorageReference,
    bool IsSensitive,
    string? Notes);

public sealed record ReviewBusinessDocumentRequest(
    Guid IdOrganization,
    BusinessDocumentStatus Status,
    string? ReviewNotes);

public sealed record BusinessDocumentEventResponse(Guid IdBusinessDocumentEvent, string Action,
    BusinessDocumentStatus Status, string? Notes, string ActorName, DateTime OccurredAt,
    string? BeforeSnapshot = null, string? AfterSnapshot = null);

public sealed record BusinessDocumentResponse(
    Guid IdBusinessDocument,
    Guid IdOrganization,
    BusinessDocumentOwnerType OwnerType,
    Guid OwnerId,
    string OwnerLabel,
    string Category,
    string Title,
    BusinessDocumentStatus Status,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    bool IsExpired,
    string StorageReference,
    bool IsSensitive,
    string? Notes,
    string? ReviewNotes,
    DateTime? ReviewedAt,
    string? ReviewedByName,
    bool Active,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record BusinessDocumentQuery(
    Guid IdOrganization,
    BusinessDocumentOwnerType? OwnerType,
    Guid? OwnerId,
    BusinessDocumentStatus? Status,
    string? Search,
    int Page,
    int PageSize);

public sealed record BusinessDocumentSearchCriteria(
    Guid IdOrganization,
    BusinessDocumentOwnerType? OwnerType,
    Guid? OwnerId,
    BusinessDocumentStatus? Status,
    string? Search,
    int Skip,
    int Take,
    bool IncludeSensitive = false);

public sealed record BusinessDocumentSearchResult(
    IReadOnlyList<BusinessDocumentResponse> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public PagedResult<BusinessDocumentResponse> ToPagedResult() =>
        new(Items, TotalCount, Page, PageSize);
}
