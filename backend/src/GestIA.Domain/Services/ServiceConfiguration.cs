using GestIA.Domain.Common;

namespace GestIA.Domain.Services;

public sealed class ServiceConfiguration : AuditableEntity
{
    private ServiceConfiguration()
    {
    }

    private ServiceConfiguration(
        Guid idServiceConfiguration,
        Guid idService,
        ServiceConfigurationProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdServiceConfiguration = idServiceConfiguration;
        IdService = idService;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdServiceConfiguration { get; private set; }
    public Guid IdService { get; private set; }
    public DateOnly EffectiveFromDate { get; private set; }
    public DateOnly? EffectiveToDate { get; private set; }
    public short RequiredWorkerCount { get; private set; }
    public decimal HoursPerDay { get; private set; }
    public byte DaysPerWeek { get; private set; }
    public decimal AverageWeeklyHours { get; private set; }
    public decimal AverageMonthlyHours { get; private set; }
    public short PreparationLeadDays { get; private set; }
    public string WorkScheduleDescription { get; private set; } = string.Empty;
    public string? SpecificInstructions { get; private set; }
    public decimal MonthlyPrice { get; private set; }
    public string CurrencyCode { get; private set; } = "MXN";
    public bool IsTaxIncluded { get; private set; }
    public Service Service { get; private set; } = null!;

    public static ServiceConfiguration Create(
        Guid idService,
        DateOnly effectiveFromDate,
        short requiredWorkerCount,
        decimal hoursPerDay,
        byte daysPerWeek,
        decimal averageMonthlyHours,
        short preparationLeadDays,
        string workScheduleDescription,
        decimal monthlyPrice,
        bool isTaxIncluded,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        Create(
            idService,
            new ServiceConfigurationProfile(
                effectiveFromDate,
                null,
                requiredWorkerCount,
                hoursPerDay,
                daysPerWeek,
                averageMonthlyHours,
                preparationLeadDays,
                workScheduleDescription,
                null,
                monthlyPrice,
                "MXN",
                isTaxIncluded),
            actorId,
            actorName,
            occurredAt);

    public static ServiceConfiguration Create(
        Guid idService,
        ServiceConfigurationProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idService, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        ServiceConfigurationProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ServiceConfigurationProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);

        if (profile.EffectiveToDate < profile.EffectiveFromDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(profile.RequiredWorkerCount);
        if (profile.HoursPerDay <= 0 || profile.HoursPerDay > 24)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        if (profile.DaysPerWeek is < 1 or > 7)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        ArgumentOutOfRangeException.ThrowIfNegative(profile.PreparationLeadDays);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(profile.AverageMonthlyHours);
        ArgumentOutOfRangeException.ThrowIfNegative(profile.MonthlyPrice);

        EffectiveFromDate = profile.EffectiveFromDate;
        EffectiveToDate = profile.EffectiveToDate;
        RequiredWorkerCount = profile.RequiredWorkerCount;
        HoursPerDay = profile.HoursPerDay;
        DaysPerWeek = profile.DaysPerWeek;
        AverageWeeklyHours = profile.HoursPerDay * profile.DaysPerWeek;
        AverageMonthlyHours = profile.AverageMonthlyHours;
        PreparationLeadDays = profile.PreparationLeadDays;
        WorkScheduleDescription = Required(profile.WorkScheduleDescription, nameof(profile.WorkScheduleDescription));
        SpecificInstructions = Optional(profile.SpecificInstructions);
        MonthlyPrice = profile.MonthlyPrice;
        CurrencyCode = Required(profile.CurrencyCode, nameof(profile.CurrencyCode)).ToUpperInvariant();
        IsTaxIncluded = profile.IsTaxIncluded;
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record ServiceConfigurationProfile(
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short RequiredWorkerCount,
    decimal HoursPerDay,
    byte DaysPerWeek,
    decimal AverageMonthlyHours,
    short PreparationLeadDays,
    string WorkScheduleDescription,
    string? SpecificInstructions,
    decimal MonthlyPrice,
    string CurrencyCode,
    bool IsTaxIncluded);
