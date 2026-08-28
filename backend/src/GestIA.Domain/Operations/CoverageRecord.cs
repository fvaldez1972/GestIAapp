using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Operations;

public sealed record CoverageRecordProfile(
    Guid IdReplacementEmployee,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    CoverageStatus Status,
    string? Notes);

public sealed class CoverageRecord : AuditableEntity
{
    private CoverageRecord()
    {
    }

    private CoverageRecord(
        Guid idCoverageRecord,
        Guid idScheduledShift,
        Guid idOriginalEmployee,
        CoverageRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdCoverageRecord = idCoverageRecord;
        IdScheduledShift = idScheduledShift;
        IdOriginalEmployee = idOriginalEmployee;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdCoverageRecord { get; private set; }
    public Guid IdScheduledShift { get; private set; }
    public Guid IdOriginalEmployee { get; private set; }
    public Guid IdReplacementEmployee { get; private set; }
    public TimeOnly CoverageStartTime { get; private set; }
    public TimeOnly CoverageEndTime { get; private set; }
    public bool IsOvernight { get; private set; }
    public int DurationMinutes { get; private set; }
    public CoverageStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public ScheduledShift ScheduledShift { get; private set; } = null!;
    public Employee OriginalEmployee { get; private set; } = null!;
    public Employee ReplacementEmployee { get; private set; } = null!;

    public static CoverageRecord Create(
        Guid idScheduledShift,
        Guid idOriginalEmployee,
        CoverageRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idScheduledShift, idOriginalEmployee, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        CoverageRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(CoverageRecordProfile profile)
    {
        if (profile.IdReplacementEmployee == Guid.Empty)
        {
            throw new ArgumentException("El empleado sustituto es obligatorio.", nameof(profile));
        }

        var duration = CalculateDurationMinutes(profile.CoverageStartTime, profile.CoverageEndTime, profile.IsOvernight);
        if (duration <= 0 || duration > 24 * 60)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "La duración de cobertura no es válida.");
        }

        IdReplacementEmployee = profile.IdReplacementEmployee;
        CoverageStartTime = profile.CoverageStartTime;
        CoverageEndTime = profile.CoverageEndTime;
        IsOvernight = profile.IsOvernight;
        DurationMinutes = duration;
        Status = profile.Status;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }

    private static int CalculateDurationMinutes(TimeOnly startTime, TimeOnly endTime, bool isOvernight)
    {
        var startMinutes = startTime.Hour * 60 + startTime.Minute;
        var endMinutes = endTime.Hour * 60 + endTime.Minute;
        return isOvernight
            ? (24 * 60 - startMinutes) + endMinutes
            : endMinutes - startMinutes;
    }
}
