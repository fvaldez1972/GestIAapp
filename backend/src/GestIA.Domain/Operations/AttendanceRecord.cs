using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Operations;

public sealed record AttendanceRecordProfile(
    AttendanceStatus Status,
    TimeOnly? ActualStartTime,
    TimeOnly? ActualEndTime,
    int MinutesLate,
    string? Notes);

public sealed class AttendanceRecord : AuditableEntity
{
    private AttendanceRecord()
    {
    }

    private AttendanceRecord(
        Guid idAttendanceRecord,
        Guid idScheduledShift,
        Guid idEmployee,
        DateOnly attendanceDate,
        AttendanceRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdAttendanceRecord = idAttendanceRecord;
        IdScheduledShift = idScheduledShift;
        IdEmployee = idEmployee;
        AttendanceDate = attendanceDate;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdAttendanceRecord { get; private set; }
    public Guid IdScheduledShift { get; private set; }
    public Guid IdEmployee { get; private set; }
    public DateOnly AttendanceDate { get; private set; }
    public AttendanceStatus Status { get; private set; }
    public TimeOnly? ActualStartTime { get; private set; }
    public TimeOnly? ActualEndTime { get; private set; }
    public int MinutesLate { get; private set; }
    public string? Notes { get; private set; }
    public ScheduledShift ScheduledShift { get; private set; } = null!;
    public Employee Employee { get; private set; } = null!;

    public static AttendanceRecord Create(
        Guid idScheduledShift,
        Guid idEmployee,
        DateOnly attendanceDate,
        AttendanceRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idScheduledShift, idEmployee, attendanceDate, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        AttendanceRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(AttendanceRecordProfile profile)
    {
        if (profile.MinutesLate < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "Los minutos de retardo no pueden ser negativos.");
        }

        Status = profile.Status;
        ActualStartTime = profile.ActualStartTime;
        ActualEndTime = profile.ActualEndTime;
        MinutesLate = profile.MinutesLate;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
