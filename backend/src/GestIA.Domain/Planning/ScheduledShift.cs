using GestIA.Domain.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Planning;

public sealed record ScheduledShiftProfile(
    Guid IdPosition,
    Guid IdEmployee,
    DateOnly ShiftDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    string? Notes);

public sealed class ScheduledShift : AuditableEntity
{
    private ScheduledShift()
    {
    }

    private ScheduledShift(
        Guid idScheduledShift,
        Guid idScheduleVersion,
        ScheduledShiftProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdScheduledShift = idScheduledShift;
        IdScheduleVersion = idScheduleVersion;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdScheduledShift { get; private set; }
    public Guid IdScheduleVersion { get; private set; }
    public Guid IdPosition { get; private set; }
    public Guid IdEmployee { get; private set; }
    public DateOnly ShiftDate { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public bool IsOvernight { get; private set; }
    public int DurationMinutes { get; private set; }
    public string? Notes { get; private set; }
    public ScheduleVersion ScheduleVersion { get; private set; } = null!;
    public Position Position { get; private set; } = null!;
    public Employee Employee { get; private set; } = null!;

    public static ScheduledShift Create(
        Guid idScheduleVersion,
        ScheduledShiftProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idScheduleVersion, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        ScheduledShiftProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ScheduledShiftProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (profile.IdPosition == Guid.Empty)
        {
            throw new ArgumentException("La posición es obligatoria.", nameof(profile));
        }

        if (profile.IdEmployee == Guid.Empty)
        {
            throw new ArgumentException("El empleado es obligatorio.", nameof(profile));
        }

        var duration = CalculateDurationMinutes(profile.StartTime, profile.EndTime, profile.IsOvernight);
        if (duration <= 0 || duration > 24 * 60)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "La duración del turno no es válida.");
        }

        IdPosition = profile.IdPosition;
        IdEmployee = profile.IdEmployee;
        ShiftDate = profile.ShiftDate;
        StartTime = profile.StartTime;
        EndTime = profile.EndTime;
        IsOvernight = profile.IsOvernight;
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
