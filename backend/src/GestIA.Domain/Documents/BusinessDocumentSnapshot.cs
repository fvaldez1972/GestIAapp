using System.Text.Json;

namespace GestIA.Domain.Documents;

// Explicit metadata allowlist: no file bytes, storage credentials or free-form notes.
public sealed record BusinessDocumentSnapshot(
    Guid IdBusinessDocument,
    Guid IdOrganization,
    BusinessDocumentOwnerType OwnerType,
    Guid OwnerId,
    string Category,
    string Title,
    BusinessDocumentStatus Status,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    bool IsSensitive,
    bool HasNotes,
    bool HasReviewNotes,
    DateTime? ReviewedAt,
    Guid? ReviewedBy,
    bool Active)
{
    public static string Capture(BusinessDocument document) => JsonSerializer.Serialize(new BusinessDocumentSnapshot(
        document.IdBusinessDocument, document.IdOrganization, document.OwnerType, document.OwnerId,
        document.Category, document.Title, document.Status, document.IssuedDate, document.ExpiresDate,
        document.IsSensitive, !string.IsNullOrEmpty(document.Notes), !string.IsNullOrEmpty(document.ReviewNotes),
        document.ReviewedAt, document.ReviewedBy, document.Active));
}
