using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;

namespace GestIA.Domain.Operations;

public sealed record OperationEvidenceProfile(
    Guid? IdAttendanceRecord,
    Guid? IdIncident,
    Guid? IdCoverageRecord,
    OperationEvidenceType EvidenceType,
    string Title,
    string StorageReference,
    string? Notes);

public sealed class OperationEvidence : AuditableEntity
{
    private OperationEvidence()
    {
    }

    private OperationEvidence(
        Guid idOperationEvidence,
        Guid idService,
        OperationEvidenceProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdOperationEvidence = idOperationEvidence;
        IdService = idService;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdOperationEvidence { get; private set; }
    public Guid IdService { get; private set; }
    public Guid? IdAttendanceRecord { get; private set; }
    public Guid? IdIncident { get; private set; }
    public Guid? IdCoverageRecord { get; private set; }
    public OperationEvidenceType EvidenceType { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string StorageReference { get; private set; } = string.Empty;
    public string? Notes { get; private set; }
    public Service Service { get; private set; } = null!;
    public AttendanceRecord? AttendanceRecord { get; private set; }
    public Incident? Incident { get; private set; }
    public CoverageRecord? CoverageRecord { get; private set; }

    public static OperationEvidence Create(
        Guid idService,
        OperationEvidenceProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idService, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        OperationEvidenceProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(OperationEvidenceProfile profile)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Title);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.StorageReference);

        var relatedRecords = new[]
        {
            profile.IdAttendanceRecord,
            profile.IdIncident,
            profile.IdCoverageRecord
        }.Count(value => value.HasValue && value.Value != Guid.Empty);

        if (relatedRecords != 1)
        {
            throw new ArgumentException("La evidencia debe estar ligada a un solo registro operativo.", nameof(profile));
        }

        IdAttendanceRecord = profile.IdAttendanceRecord;
        IdIncident = profile.IdIncident;
        IdCoverageRecord = profile.IdCoverageRecord;
        EvidenceType = profile.EvidenceType;
        Title = profile.Title.Trim();
        StorageReference = profile.StorageReference.Trim();
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
