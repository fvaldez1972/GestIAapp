namespace GestIA.Domain.Documents;

public sealed class BusinessDocumentEvent
{
    private BusinessDocumentEvent() { }

    public Guid IdBusinessDocumentEvent { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdBusinessDocument { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public BusinessDocumentStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public string? BeforeSnapshot { get; private set; }
    public string? AfterSnapshot { get; private set; }
    public Guid ActorId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public DateTime OccurredAt { get; private set; }

    public static BusinessDocumentEvent Record(BusinessDocument document, string action, string? notes, Guid actorId, string actorName, DateTime occurredAt, string? beforeSnapshot = null)
    {
        ArgumentNullException.ThrowIfNull(document);
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(actorName);
        return new BusinessDocumentEvent
        {
            IdBusinessDocumentEvent = Guid.NewGuid(),
            IdOrganization = document.IdOrganization,
            IdBusinessDocument = document.IdBusinessDocument,
            Action = action,
            Status = document.Status,
            Notes = notes,
            BeforeSnapshot = beforeSnapshot,
            AfterSnapshot = BusinessDocumentSnapshot.Capture(document),
            ActorId = actorId,
            ActorName = actorName.Trim(),
            OccurredAt = occurredAt.Kind == DateTimeKind.Local ? occurredAt.ToUniversalTime() : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc)
        };
    }
}
