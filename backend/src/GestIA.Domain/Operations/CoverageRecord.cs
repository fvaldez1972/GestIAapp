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
    string? Notes,
    Guid? IdCoverageReason = null);

public sealed class CoverageRecord : AuditableEntity, IOrganizationScopedEntity
{
    private CoverageRecord()
    {
    }

    private CoverageRecord(
        Guid idCoverageRecord,
        Guid idOrganization,
        Guid idScheduledShift,
        Guid idOriginalEmployee,
        CoverageRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdCoverageRecord = idCoverageRecord;
        IdOrganization = idOrganization;
        IdScheduledShift = idScheduledShift;
        IdOriginalEmployee = idOriginalEmployee;
        ApplyProfile(profile);
        Status = CoverageStatus.Requested;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdCoverageRecord { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdScheduledShift { get; private set; }
    public Guid IdOriginalEmployee { get; private set; }
    public Guid IdReplacementEmployee { get; private set; }
    public TimeOnly CoverageStartTime { get; private set; }
    public TimeOnly CoverageEndTime { get; private set; }
    public bool IsOvernight { get; private set; }
    public int DurationMinutes { get; private set; }
    public CoverageStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public Guid? IdCoverageReason { get; private set; }
    public ScheduledShift ScheduledShift { get; private set; } = null!;
    public Employee OriginalEmployee { get; private set; } = null!;
    public Employee ReplacementEmployee { get; private set; } = null!;

    public static CoverageRecord Create(
        Guid idOrganization,
        Guid idScheduledShift,
        Guid idOriginalEmployee,
        CoverageRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idScheduledShift, idOriginalEmployee, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        CoverageRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var sameAllocation = IdReplacementEmployee == profile.IdReplacementEmployee &&
            CoverageStartTime == profile.CoverageStartTime && CoverageEndTime == profile.CoverageEndTime &&
            IsOvernight == profile.IsOvernight;
        if (Status is CoverageStatus.Completed or CoverageStatus.Cancelled)
        {
            if (sameAllocation && Status == profile.Status && IdCoverageReason == profile.IdCoverageReason &&
                Notes == (string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim()))
            {
                return;
            }

            throw new DomainRuleException("Una cobertura cerrada no puede modificarse.");
        }

        if ((Status == CoverageStatus.Confirmed || profile.Status == CoverageStatus.Cancelled) && !sameAllocation)
        {
            throw new DomainRuleException("Cancela la cobertura confirmada antes de cambiar empleado u horario.");
        }

        var allowed = Status == profile.Status || (Status, profile.Status) switch
        {
            (CoverageStatus.Requested, CoverageStatus.Confirmed or CoverageStatus.Cancelled) => true,
            (CoverageStatus.Confirmed, CoverageStatus.Completed or CoverageStatus.Cancelled) => true,
            _ => false
        };
        if (!allowed)
        {
            throw new DomainRuleException("La cobertura debe confirmarse antes de completarse y no puede reabrirse después del cierre.");
        }

        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(CoverageRecordProfile profile)
    {
        if (!Enum.IsDefined(profile.Status))
        {
            throw new DomainRuleException("El estado de cobertura no es valido.");
        }

        if (profile.IdReplacementEmployee == IdOriginalEmployee)
        {
            throw new DomainRuleException("El sustituto no puede ser el empleado original.");
        }

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
        IdCoverageReason = profile.IdCoverageReason;
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
