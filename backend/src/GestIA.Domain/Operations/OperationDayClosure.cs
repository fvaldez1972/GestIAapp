using GestIA.Domain.Common;
using GestIA.Domain.Services;

namespace GestIA.Domain.Operations;

public sealed record OperationDayClosureProfile(
    Guid IdOrganization,
    Guid IdService,
    DateOnly OperationDate,
    int ExpectedShifts,
    int AttendanceRecords,
    int PendingAttendance,
    int OpenIncidents,
    int CoverageRecords,
    string? Notes);

public sealed class OperationDayClosure : AuditableEntity
{
    private OperationDayClosure()
    {
    }

    private OperationDayClosure(
        Guid idOperationDayClosure,
        OperationDayClosureProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdOperationDayClosure = idOperationDayClosure;
        ApplyProfile(profile);
        ClosedAt = occurredAt.Kind == DateTimeKind.Utc ? occurredAt : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        ClosedBy = actorId;
        ClosedByName = actorName.Trim();
        Status = OperationDayClosureStatus.Closed;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdOperationDayClosure { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdService { get; private set; }
    public DateOnly OperationDate { get; private set; }
    public int ExpectedShifts { get; private set; }
    public int AttendanceRecords { get; private set; }
    public int PendingAttendance { get; private set; }
    public int OpenIncidents { get; private set; }
    public int CoverageRecords { get; private set; }
    public string? Notes { get; private set; }
    public OperationDayClosureStatus Status { get; private set; }
    public DateTime ClosedAt { get; private set; }
    public Guid ClosedBy { get; private set; }
    public string ClosedByName { get; private set; } = string.Empty;
    public DateTime? ReopenedAt { get; private set; }
    public Guid? ReopenedBy { get; private set; }
    public string? ReopenedByName { get; private set; }
    public string? ReopenReason { get; private set; }
    public Service Service { get; private set; } = null!;

    public static OperationDayClosure Create(
        OperationDayClosureProfile profile,
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

        if (profile.OperationDate == default)
        {
            throw new ArgumentException("La fecha operativa es obligatoria.", nameof(profile));
        }

        return new OperationDayClosure(Guid.NewGuid(), profile, actorId, actorName, occurredAt);
    }

    public void Reopen(string reason, Guid actorId, string actorName, DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);

        if (Status == OperationDayClosureStatus.Reopened)
        {
            return;
        }

        Status = OperationDayClosureStatus.Reopened;
        ReopenReason = reason.Trim();
        ReopenedAt = occurredAt.Kind == DateTimeKind.Utc ? occurredAt : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        ReopenedBy = actorId;
        ReopenedByName = actorName.Trim();
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(OperationDayClosureProfile profile)
    {
        if (profile.ExpectedShifts < 0 || profile.AttendanceRecords < 0 || profile.PendingAttendance < 0 || profile.OpenIncidents < 0 || profile.CoverageRecords < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "Los conteos del cierre no pueden ser negativos.");
        }

        IdOrganization = profile.IdOrganization;
        IdService = profile.IdService;
        OperationDate = profile.OperationDate;
        ExpectedShifts = profile.ExpectedShifts;
        AttendanceRecords = profile.AttendanceRecords;
        PendingAttendance = profile.PendingAttendance;
        OpenIncidents = profile.OpenIncidents;
        CoverageRecords = profile.CoverageRecords;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
