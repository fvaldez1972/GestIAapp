using GestIA.Domain.Common;
using GestIA.Domain.Services;

namespace GestIA.Domain.Operations;

public sealed record ApprovalRequestProfile(
    Guid IdOrganization,
    Guid IdService,
    ApprovalRequestType ApprovalType,
    string EntityType,
    Guid EntityId,
    string Reason,
    string? RequestedChangeSummary,
    string? AssignedApproverName,
    Guid? IdOperationEvidence);

public sealed class ApprovalRequest : AuditableEntity
{
    private ApprovalRequest()
    {
    }

    private ApprovalRequest(
        Guid idApprovalRequest,
        ApprovalRequestProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdApprovalRequest = idApprovalRequest;
        IdOrganization = profile.IdOrganization;
        IdService = profile.IdService;
        ApprovalType = profile.ApprovalType;
        EntityType = profile.EntityType.Trim();
        EntityId = profile.EntityId;
        Reason = profile.Reason.Trim();
        RequestedChangeSummary = string.IsNullOrWhiteSpace(profile.RequestedChangeSummary)
            ? null
            : profile.RequestedChangeSummary.Trim();
        AssignedApproverName = string.IsNullOrWhiteSpace(profile.AssignedApproverName)
            ? null
            : profile.AssignedApproverName.Trim();
        IdOperationEvidence = profile.IdOperationEvidence;
        Status = ApprovalRequestStatus.Pending;
        RequestedAt = occurredAt.Kind == DateTimeKind.Utc ? occurredAt : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdApprovalRequest { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdService { get; private set; }
    public ApprovalRequestType ApprovalType { get; private set; }
    public string EntityType { get; private set; } = string.Empty;
    public Guid EntityId { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public string? RequestedChangeSummary { get; private set; }
    public string? AssignedApproverName { get; private set; }
    public Guid? IdOperationEvidence { get; private set; }
    public ApprovalRequestStatus Status { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? DecidedAt { get; private set; }
    public Guid? DecidedBy { get; private set; }
    public string? DecidedByName { get; private set; }
    public string? DecisionNotes { get; private set; }
    public Service Service { get; private set; } = null!;

    public static ApprovalRequest Create(
        ApprovalRequestProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (profile.IdOrganization == Guid.Empty)
        {
            throw new ArgumentException("La organización es obligatoria.", nameof(profile));
        }

        if (profile.IdService == Guid.Empty)
        {
            throw new ArgumentException("El servicio es obligatorio.", nameof(profile));
        }

        if (profile.EntityId == Guid.Empty)
        {
            throw new ArgumentException("El registro relacionado es obligatorio.", nameof(profile));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(profile.EntityType);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Reason);

        return new ApprovalRequest(Guid.NewGuid(), profile, actorId, actorName, occurredAt);
    }

    public void Decide(
        ApprovalRequestStatus status,
        string? decisionNotes,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (Status != ApprovalRequestStatus.Pending)
        {
            throw new InvalidOperationException("La autorización ya fue resuelta.");
        }

        if (status is not ApprovalRequestStatus.Approved and not ApprovalRequestStatus.Rejected and not ApprovalRequestStatus.Cancelled)
        {
            throw new ArgumentOutOfRangeException(nameof(status), "La decisión no es válida.");
        }

        Status = status;
        DecisionNotes = string.IsNullOrWhiteSpace(decisionNotes) ? null : decisionNotes.Trim();
        DecidedAt = occurredAt.Kind == DateTimeKind.Utc ? occurredAt : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        DecidedBy = actorId;
        DecidedByName = actorName.Trim();
        RegisterUpdate(actorId, actorName, occurredAt);
    }
}
