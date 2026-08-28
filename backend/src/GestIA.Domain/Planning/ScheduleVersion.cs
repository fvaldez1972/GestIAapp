using GestIA.Domain.Common;
using GestIA.Domain.Services;

namespace GestIA.Domain.Planning;

public sealed record ScheduleVersionProfile(
    string Name,
    DateOnly PeriodStartDate,
    DateOnly PeriodEndDate,
    string? Notes);

public sealed class ScheduleVersion : AuditableEntity
{
    private readonly List<ScheduledShift> shifts = [];

    private ScheduleVersion()
    {
    }

    private ScheduleVersion(
        Guid idScheduleVersion,
        Guid idService,
        ScheduleVersionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdScheduleVersion = idScheduleVersion;
        IdService = idService;
        Status = ScheduleVersionStatus.Draft;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdScheduleVersion { get; private set; }
    public Guid IdService { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public DateOnly PeriodStartDate { get; private set; }
    public DateOnly PeriodEndDate { get; private set; }
    public ScheduleVersionStatus Status { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public Guid? PublishedBy { get; private set; }
    public string? PublishedByName { get; private set; }
    public string? Notes { get; private set; }
    public Service Service { get; private set; } = null!;
    public IReadOnlyCollection<ScheduledShift> Shifts => shifts;

    public static ScheduleVersion Create(
        Guid idService,
        ScheduleVersionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idService, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        ScheduleVersionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        EnsureDraft();
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    public void Publish(Guid actorId, string actorName, DateTime occurredAt)
    {
        EnsureDraft();
        ArgumentException.ThrowIfNullOrWhiteSpace(actorName);
        Status = ScheduleVersionStatus.Published;
        PublishedAt = EnsureUtc(occurredAt);
        PublishedBy = actorId;
        PublishedByName = actorName.Trim();
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    public void MarkSuperseded(Guid actorId, string actorName, DateTime occurredAt)
    {
        if (Status == ScheduleVersionStatus.Published)
        {
            Status = ScheduleVersionStatus.Superseded;
            RegisterUpdate(actorId, actorName, occurredAt);
        }
    }

    public void EnsureDraft()
    {
        if (Status != ScheduleVersionStatus.Draft)
        {
            throw new InvalidOperationException("La planeación publicada no puede modificarse directamente.");
        }
    }

    private void ApplyProfile(ScheduleVersionProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (profile.PeriodEndDate < profile.PeriodStartDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "La fecha final no puede ser menor que la inicial.");
        }

        Name = Required(profile.Name, nameof(profile.Name));
        PeriodStartDate = profile.PeriodStartDate;
        PeriodEndDate = profile.PeriodEndDate;
        Notes = Optional(profile.Notes);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
