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

/// <summary>
/// Consulta de servicios de una organización, sin pasar por el cliente.
///
/// <para>Existe para que la pantalla de Servicios deje de exigir la cascada
/// organización → cliente → servicio: con <c>Service.IdOrganization</c> —denormalizada en la
/// tanda A— la lista se resuelve en una sola consulta y el cliente pasa a ser un filtro
/// opcional más.</para>
/// </summary>
/// <param name="Active">
/// Omitido o <c>true</c> devuelve sólo los activos, como el resto de las listas del sistema.
/// <c>false</c> devuelve sólo los inactivos. No hay forma de pedir ambos: ver la nota del
/// repositorio.
/// </param>
public sealed record ServiceListQuery(
    Guid IdOrganization,
    string? Search = null,
    Guid? IdClient = null,
    Guid? IdClientSite = null,
    Guid? IdServiceContract = null,
    bool? Active = null,
    int Page = 1,
    int PageSize = 20);

public sealed record ServiceSearchCriteria(
    Guid IdOrganization,
    string? Search,
    Guid? IdClient,
    Guid? IdClientSite,
    Guid? IdServiceContract,
    bool? Active,
    int Skip,
    int Take);

/// <summary>
/// Un servicio en la lista de una organización: lo mismo que <see cref="ServiceResponse"/> más
/// el nombre del cliente y cuántas posiciones tiene, que son los dos datos que la lista muestra
/// y que de otro modo obligarían a una consulta por fila.
/// </summary>
public sealed record ServiceListItemResponse(
    Guid IdService,
    Guid IdClient,
    string ClientName,
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
    int PositionsCount,
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
    bool IsTaxIncluded,
    string? CorrectionReason = null,
    byte[]? RowVersion = null);

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
    bool Active,
    byte[] RowVersion);
