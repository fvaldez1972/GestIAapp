using GestIA.Domain.Catalogs;

namespace GestIA.Application.Catalogs;

public sealed record CatalogItemInput(
    Guid IdOrganization,
    BusinessCatalogItemType Type,
    string Code,
    string Name,
    string? Description);

public sealed record CatalogItemResponse(
    Guid IdCatalogItem,
    Guid IdOrganization,
    BusinessCatalogItemType Type,
    string Code,
    string Name,
    string? Description,
    bool Active);

public sealed record EligibilityRequirementInput(
    Guid IdOrganization,
    EligibilityRequirementTargetType TargetType,
    Guid? IdClient,
    Guid? IdService,
    Guid? IdPosition,
    EligibilityRequirementType RequirementType,
    string RequiredCode,
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
    string RequiredCode,
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
    string SkillCode,
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
