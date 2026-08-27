using GestIA.Domain.Services;

namespace GestIA.Application.Services;

public sealed record CreateServiceContractRequest(
    Guid IdOrganization,
    Guid IdClient,
    string CodeServiceContract,
    ServiceContractStatus Status,
    DateOnly? SignedDate,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short PaymentTermDays,
    short TerminationNoticeDays,
    string? CurrencyCode,
    string? DocumentReference,
    string? Notes);

public sealed record UpdateServiceContractRequest(
    Guid IdOrganization,
    Guid IdClient,
    ServiceContractStatus Status,
    DateOnly? SignedDate,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short PaymentTermDays,
    short TerminationNoticeDays,
    string? CurrencyCode,
    string? DocumentReference,
    string? Notes);

public sealed record ServiceContractResponse(
    Guid IdServiceContract,
    Guid IdClient,
    string CodeServiceContract,
    ServiceContractStatus Status,
    DateOnly? SignedDate,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short PaymentTermDays,
    short TerminationNoticeDays,
    string CurrencyCode,
    string? DocumentReference,
    string? Notes,
    bool Active);

public sealed record CreateServiceRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdClientSite,
    Guid? IdServiceContract,
    string CodeService,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate);

public sealed record UpdateServiceRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdClientSite,
    Guid? IdServiceContract,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate);

public sealed record ServiceResponse(
    Guid IdService,
    Guid IdClient,
    Guid IdClientSite,
    string? ClientSiteName,
    Guid? IdServiceContract,
    string? ServiceContractCode,
    string CodeService,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool Active);

public sealed record CreateServiceConfigurationRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
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
    string? CurrencyCode,
    bool IsTaxIncluded);

public sealed record UpdateServiceConfigurationRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
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
    string? CurrencyCode,
    bool IsTaxIncluded);

public sealed record ServiceConfigurationResponse(
    Guid IdServiceConfiguration,
    Guid IdService,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short RequiredWorkerCount,
    decimal HoursPerDay,
    byte DaysPerWeek,
    decimal AverageWeeklyHours,
    decimal AverageMonthlyHours,
    short PreparationLeadDays,
    string WorkScheduleDescription,
    string? SpecificInstructions,
    decimal MonthlyPrice,
    string CurrencyCode,
    bool IsTaxIncluded,
    bool Active);
