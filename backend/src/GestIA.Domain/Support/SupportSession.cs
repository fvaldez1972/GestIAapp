using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Support;

public sealed class SupportSession : AuditableEntity
{
    private SupportSession()
    {
    }

    private SupportSession(
        Guid idOrganization,
        string reason,
        DateTime startsAt,
        DateTime expiresAt,
        Guid actorId,
        string actorName)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(expiresAt, startsAt);

        IdSupportSession = Guid.NewGuid();
        IdOrganization = idOrganization;
        Reason = Required(reason, nameof(reason));
        StartsAt = EnsureUtc(startsAt);
        ExpiresAt = EnsureUtc(expiresAt);
        RegisterCreation(actorId, actorName, startsAt);
    }

    public Guid IdSupportSession { get; private set; }
    public Guid IdOrganization { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public DateTime StartsAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime? EndedAt { get; private set; }
    public Guid? EndedBy { get; private set; }
    public string? EndedByName { get; private set; }
    public Organization Organization { get; private set; } = null!;

    public static SupportSession Start(
        Guid idOrganization,
        string reason,
        DateTime startsAt,
        DateTime expiresAt,
        Guid actorId,
        string actorName) =>
        new(idOrganization, reason, startsAt, expiresAt, actorId, actorName);

    public bool IsValidFor(Guid actorId, DateTime occurredAt) =>
        Active &&
        EndedAt is null &&
        CreatedBy == actorId &&
        StartsAt <= EnsureUtc(occurredAt) &&
        ExpiresAt > EnsureUtc(occurredAt);

    public void End(Guid actorId, string actorName, DateTime occurredAt)
    {
        if (!Active || EndedAt is not null)
        {
            return;
        }

        EndedAt = EnsureUtc(occurredAt);
        EndedBy = actorId;
        EndedByName = Required(actorName, nameof(actorName));
        Deactivate(actorId, actorName, occurredAt);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
