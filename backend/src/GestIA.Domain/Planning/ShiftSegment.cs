using GestIA.Domain.Common;

namespace GestIA.Domain.Planning;

public sealed record ShiftSegmentProfile(
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    int RequiredWorkerCount,
    string? Notes);

public sealed class ShiftSegment : AuditableEntity
{
    private ShiftSegment()
    {
    }

    private ShiftSegment(
        Guid idShiftSegment,
        Guid idShiftPattern,
        ShiftSegmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdShiftSegment = idShiftSegment;
        IdShiftPattern = idShiftPattern;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdShiftSegment { get; private set; }
    public Guid IdShiftPattern { get; private set; }
    public DayOfWeek DayOfWeek { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public bool IsOvernight { get; private set; }
    public int RequiredWorkerCount { get; private set; }
    public int DurationMinutes { get; private set; }
    public string? Notes { get; private set; }
    public ShiftPattern ShiftPattern { get; private set; } = null!;

    public static ShiftSegment Create(
        Guid idShiftPattern,
        ShiftSegmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idShiftPattern, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        ShiftSegmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ShiftSegmentProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (profile.RequiredWorkerCount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        var duration = CalculateDurationMinutes(profile.StartTime, profile.EndTime, profile.IsOvernight);
        if (duration <= 0 || duration > 24 * 60)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        DayOfWeek = profile.DayOfWeek;
        StartTime = profile.StartTime;
        EndTime = profile.EndTime;
        IsOvernight = profile.IsOvernight;
        RequiredWorkerCount = profile.RequiredWorkerCount;
        DurationMinutes = duration;
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

