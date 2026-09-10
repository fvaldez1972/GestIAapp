using GestIA.Domain.Catalogs;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Catalogs;

public sealed record CatalogItemInput(
    Guid IdOrganization,
    BusinessCatalogItemType Type,
    string Name,
    string? Description,
    int? Order = null,
    bool? Active = null,
    Guid? IdParentCatalogItem = null);

public sealed record CatalogItemResponse(
    Guid IdCatalogItem,
    Guid IdOrganization,
    BusinessCatalogItemType Type,
    string Name,
    string? Description,
    bool Active,
    int Order = 1,
    DateTime? UpdatedAt = null,
    Guid? IdParentCatalogItem = null);

public sealed record EligibilityRequirementInput(
    Guid IdOrganization,
    EligibilityRequirementTargetType TargetType,
    Guid? IdClient,
    Guid? IdService,
    Guid? IdPosition,
    EligibilityRequirementType RequirementType,
    Guid? IdRequiredCatalogItem,
    EmployeeDocumentType? RequiredDocumentType,
    EmployeeEvaluationType? RequiredEvaluationType,
    string Name,
    string? Description,
    bool IsBlocking);

public sealed record EligibilityRequirementResponse(
    Guid IdEligibilityRequirement,
    Guid IdOrganization,
    EligibilityRequirementTargetType TargetType,
    Guid? IdClient,
    string? ClientName,
    Guid? IdService,
    string? ServiceName,
    Guid? IdPosition,
    string? PositionName,
    EligibilityRequirementType RequirementType,
    Guid? IdRequiredCatalogItem,
    string? RequiredCatalogItemName,
    EmployeeDocumentType? RequiredDocumentType,
    EmployeeEvaluationType? RequiredEvaluationType,
    string Name,
    string? Description,
    bool IsBlocking,
    bool Active);

public sealed record EmployeeSkillInput(
    Guid IdOrganization,
    Guid IdEmployee,
    Guid IdSkillCatalogItem,
    DateOnly? AcquiredDate,
    DateOnly? ExpiresDate,
    string? Notes);

public sealed record EmployeeSkillResponse(
    Guid IdEmployeeSkill,
    Guid IdEmployee,
    Guid IdSkillCatalogItem,
    string SkillName,
    DateOnly? AcquiredDate,
    DateOnly? ExpiresDate,
    string? Notes,
    bool Active);

public sealed record EligibilityCheckQuery(
    Guid IdOrganization,
    Guid IdEmployee,
    Guid? IdClient,
    Guid? IdService,
    Guid? IdPosition,
    DateOnly ReferenceDate);

/// <summary>
/// La misma comprobación, para varias personas y un solo contexto.
///
/// <para>Existe porque el selector de candidatos de Planeación enseña una lista, y una lista de
/// diez personas no puede costar diez viajes al servidor. El contexto —cliente, servicio, posición
/// y fecha— es el mismo para todas: es la posición la que pide los requisitos.</para>
/// </summary>
public sealed record EligibilityBatchQuery(
    Guid IdOrganization,
    IReadOnlyList<Guid> IdEmployees,
    Guid? IdClient,
    Guid? IdService,
    Guid? IdPosition,
    /// <summary>Sin fecha se usa el día operativo. La decide el servicio, que es quien tiene reloj.</summary>
    DateOnly? ReferenceDate);

public sealed record EligibilityCheckResponse(
    Guid IdEmployee,
    string EmployeeCode,
    string EmployeeName,
    bool IsEligible,
    IReadOnlyList<EligibilityReasonResponse> Reasons);

public sealed record EligibilityReasonResponse(
    string Scope,
    string Requirement,
    bool IsBlocking,
    bool Passed,
    string Message);
