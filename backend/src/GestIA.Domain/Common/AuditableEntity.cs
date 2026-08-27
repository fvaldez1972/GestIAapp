namespace GestIA.Domain.Common;

public abstract class AuditableEntity : IAuditableEntity, IActivatableEntity
{
    public bool Active { get; protected set; } = true;
    public DateTime CreatedAt { get; protected set; }
    public Guid CreatedBy { get; protected set; }
    public string CreatedByName { get; protected set; } = string.Empty;
    public DateTime? UpdatedAt { get; protected set; }
    public Guid? UpdatedBy { get; protected set; }
    public string? UpdatedByName { get; protected set; }

    protected void RegisterCreation(Guid actorId, string actorName, DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actorName);
        CreatedBy = actorId;
        CreatedByName = actorName.Trim();
        CreatedAt = EnsureUtc(occurredAt);
    }

    protected void RegisterUpdate(Guid actorId, string actorName, DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actorName);
        UpdatedBy = actorId;
        UpdatedByName = actorName.Trim();
        UpdatedAt = EnsureUtc(occurredAt);
    }

    public void Deactivate(Guid actorId, string actorName, DateTime occurredAt)
    {
        Active = false;
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
