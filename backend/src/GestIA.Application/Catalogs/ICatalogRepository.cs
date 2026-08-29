using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Catalogs;

public interface ICatalogRepository
{
    Task<bool> OrganizationExistsAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<IReadOnlyList<BusinessCatalogItem>> ListCatalogItemsAsync(Guid idOrganization, BusinessCatalogItemType? type, CancellationToken cancellationToken);
    Task<BusinessCatalogItem?> GetCatalogItemAsync(Guid idOrganization, Guid idCatalogItem, CancellationToken cancellationToken);
    Task<bool> CatalogCodeExistsAsync(Guid idOrganization, BusinessCatalogItemType type, string code, Guid? excludedId, CancellationToken cancellationToken);
    Task AddCatalogItemAsync(BusinessCatalogItem item, CancellationToken cancellationToken);

    Task<IReadOnlyList<EligibilityRequirement>> ListEligibilityRequirementsAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<EligibilityRequirement?> GetEligibilityRequirementAsync(Guid idOrganization, Guid idEligibilityRequirement, CancellationToken cancellationToken);
    Task AddEligibilityRequirementAsync(EligibilityRequirement requirement, CancellationToken cancellationToken);

    Task<Employee?> GetEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken);
    Task<Client?> GetClientAsync(Guid idOrganization, Guid idClient, CancellationToken cancellationToken);
    Task<Service?> GetServiceAsync(Guid idOrganization, Guid idService, CancellationToken cancellationToken);
    Task<Position?> GetPositionAsync(Guid idOrganization, Guid idPosition, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmployeeSkill>> ListEmployeeSkillsAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken);
    Task<EmployeeSkill?> GetEmployeeSkillAsync(Guid idOrganization, Guid idEmployee, Guid idEmployeeSkill, CancellationToken cancellationToken);
    Task AddEmployeeSkillAsync(EmployeeSkill skill, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmployeeDocument>> ListEmployeeDocumentsAsync(Guid idEmployee, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmployeeEvaluation>> ListEmployeeEvaluationsAsync(Guid idEmployee, CancellationToken cancellationToken);
}
