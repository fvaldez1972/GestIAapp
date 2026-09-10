using GestIA.Domain.Catalogs;

namespace GestIA.Application.Catalogs;

public interface ICatalogService
{
    Task<IReadOnlyList<CatalogItemResponse>> ListCatalogItemsAsync(Guid idOrganization, BusinessCatalogItemType? type, CancellationToken cancellationToken);
    Task<CatalogItemResponse> CreateCatalogItemAsync(CatalogItemInput request, CancellationToken cancellationToken);
    Task<CatalogItemResponse> UpdateCatalogItemAsync(Guid idCatalogItem, CatalogItemInput request, CancellationToken cancellationToken);
    Task DeactivateCatalogItemAsync(Guid idOrganization, Guid idCatalogItem, CancellationToken cancellationToken);

    Task<IReadOnlyList<EligibilityRequirementResponse>> ListEligibilityRequirementsAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<EligibilityRequirementResponse> CreateEligibilityRequirementAsync(EligibilityRequirementInput request, CancellationToken cancellationToken);
    Task<EligibilityRequirementResponse> UpdateEligibilityRequirementAsync(Guid idEligibilityRequirement, EligibilityRequirementInput request, CancellationToken cancellationToken);
    Task DeactivateEligibilityRequirementAsync(Guid idOrganization, Guid idEligibilityRequirement, CancellationToken cancellationToken);

    /// <summary>
    /// Comprueba que el identificador corresponda a un puesto activo del catálogo de esa
    /// organización. Se valida por identificador y no por texto: comparar nombres es justo lo que
    /// esta tanda vino a eliminar.
    /// </summary>
    Task EnsureJobPositionCatalogItemAsync(Guid idOrganization, Guid idCatalogItem, CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeSkillResponse>> ListEmployeeSkillsAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken);
    Task<EmployeeSkillResponse> CreateEmployeeSkillAsync(EmployeeSkillInput request, CancellationToken cancellationToken);
    Task<EmployeeSkillResponse> UpdateEmployeeSkillAsync(Guid idEmployeeSkill, EmployeeSkillInput request, CancellationToken cancellationToken);
    Task DeactivateEmployeeSkillAsync(Guid idOrganization, Guid idEmployee, Guid idEmployeeSkill, CancellationToken cancellationToken);

    Task<EligibilityCheckResponse> CheckEligibilityAsync(EligibilityCheckQuery query, CancellationToken cancellationToken);

    /// <summary>La comprobación de elegibilidad de varias personas contra un mismo contexto.</summary>
    Task<IReadOnlyList<EligibilityCheckResponse>> CheckEligibilityBatchAsync(
        EligibilityBatchQuery query,
        CancellationToken cancellationToken);
}
