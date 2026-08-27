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
        DateTime occurredAt)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(requiredWorkerCount);
        if (hoursPerDay <= 0 || hoursPerDay > 24)
        {
            throw new ArgumentOutOfRangeException(nameof(hoursPerDay));
        }

        if (daysPerWeek is < 1 or > 7)
        {
            throw new ArgumentOutOfRangeException(nameof(daysPerWeek));
        }

        ArgumentOutOfRangeException.ThrowIfNegative(preparationLeadDays);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(averageMonthlyHours);
        ArgumentOutOfRangeException.ThrowIfNegative(monthlyPrice);
        ArgumentException.ThrowIfNullOrWhiteSpace(workScheduleDescription);

        IdServiceConfiguration = idServiceConfiguration;
        IdService = idService;
        EffectiveFromDate = effectiveFromDate;
        RequiredWorkerCount = requiredWorkerCount;
        HoursPerDay = hoursPerDay;
        DaysPerWeek = daysPerWeek;
        AverageWeeklyHours = hoursPerDay * daysPerWeek;
        AverageMonthlyHours = averageMonthlyHours;
        PreparationLeadDays = preparationLeadDays;
        WorkScheduleDescription = workScheduleDescription.Trim();
        MonthlyPrice = monthlyPrice;
        IsTaxIncluded = isTaxIncluded;
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
        new(
            Guid.NewGuid(),
            idService,
            effectiveFromDate,
            requiredWorkerCount,
            hoursPerDay,
            daysPerWeek,
            averageMonthlyHours,
            preparationLeadDays,
            workScheduleDescription,
            monthlyPrice,
            isTaxIncluded,
            actorId,
            actorName,
            occurredAt);
}
