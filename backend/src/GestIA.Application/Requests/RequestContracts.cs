using GestIA.Application.Common;
using GestIA.Domain.Operations;
using GestIA.Domain.Requests;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Requests;

public sealed record CreateOperationalRequestRequest(
    Guid IdOrganization,
    Guid? IdClient,
    Guid? IdService,
    string CodeOperationalRequest,
    OperationalRequestType RequestType,
    OperationalRequestPriority Priority,
    string Title,
    string Description,
    string RequestedByName,
    DateOnly? NeededByDate);

public sealed record UpdateOperationalRequestRequest(
    Guid IdOrganization,
    Guid? IdClient,
    Guid? IdService,
    OperationalRequestType RequestType,
    OperationalRequestPriority Priority,
    string Title,
    string Description,
    string RequestedByName,
    DateOnly? NeededByDate);

public sealed record ChangeOperationalRequestStatusRequest(
    Guid IdOrganization,
    OperationalRequestStatus Status,
    string? ResolutionNotes);

public sealed record ExecuteOperationalRequestRequest(
    Guid IdOrganization,
    string? ExecutionNotes,
    OperationalRequestClientInput? Client,
    OperationalRequestClientSiteInput? ClientSite,
    OperationalRequestServiceContractInput? ServiceContract,
    OperationalRequestServiceInput? Service,
    OperationalRequestServiceConfigurationInput? ServiceConfiguration,
    OperationalRequestStaffAssignmentInput? StaffAssignment,
    OperationalRequestCoverageInput? Coverage);

public sealed record ExecuteOperationalRequestResponse(
    OperationalRequestResponse Request,
    string Outcome,
    IReadOnlyList<string> Warnings,
    string? ExecutedEntityKind,
    Guid? ExecutedEntityId);

public sealed record OperationalRequestClientInput(
    string CodeClient,
    string LegalName,
    string? TradeName,
    string Rfc,
    string? Nationality,
    string? TaxActivity,
    string? TaxAddress,
    DateOnly? PublicRegistryDate,
    string? CommercialRegistryFolio,
    string? EmployerRegistrationNumber,
    DateOnly? IncorporationDate,
    string? IncorporationDeedNumber,
    string? LegalRepresentativeInstrumentNumber);

public sealed record OperationalRequestClientSiteInput(
    string CodeClientSite,
    string Name,
    string Street,
    string? ExteriorNumber,
    string? InteriorNumber,
    string? Neighborhood,
    string Municipality,
    string State,
    string PostalCode,
    string? CountryCode,
    string? AccessInstructions,
    string? TimeZoneId);

public sealed record OperationalRequestServiceContractInput(
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

public sealed record OperationalRequestServiceInput(
    Guid? IdClientSite,
    Guid? IdServiceContract,
    string CodeService,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate);

public sealed record OperationalRequestServiceConfigurationInput(
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

public sealed record OperationalRequestStaffAssignmentInput(
    Guid IdEmployee,
    Guid IdPosition,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    string? Notes);

public sealed record OperationalRequestCoverageInput(
    Guid IdScheduledShift,
    Guid IdReplacementEmployee,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    CoverageStatus Status,
    string? Notes);

public sealed record OperationalRequestResponse(
    Guid IdOperationalRequest,
    Guid IdOrganization,
    string OrganizationName,
    Guid? IdClient,
    string? ClientName,
    Guid? IdService,
    string? ServiceName,
    string CodeOperationalRequest,
    OperationalRequestType RequestType,
    OperationalRequestStatus Status,
    OperationalRequestPriority Priority,
    string Title,
    string Description,
    string RequestedByName,
    DateOnly? NeededByDate,
    string? ResolutionNotes,
    bool Active,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record OperationalRequestQuery(
    Guid IdOrganization,
    OperationalRequestStatus? Status,
    OperationalRequestType? RequestType,
    string? Search,
    int Page,
    int PageSize);

public sealed record OperationalRequestSearchCriteria(
    Guid IdOrganization,
    OperationalRequestStatus? Status,
    OperationalRequestType? RequestType,
    string? Search,
    int Skip,
    int Take);

public sealed record OperationalRequestSearchResult(
    IReadOnlyList<OperationalRequest> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public PagedResult<OperationalRequestResponse> ToPagedResult(
        Func<OperationalRequest, OperationalRequestResponse> map) =>
        new(Items.Select(map).ToArray(), TotalCount, Page, PageSize);
}
