using GestIA.Application.Catalogs;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class CatalogRepository(GestIaDbContext dbContext) : ICatalogRepository
{
    public Task<bool> OrganizationExistsAsync(Guid idOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations.AnyAsync(
            organization => organization.IdOrganization == idOrganization,
            cancellationToken);

    public async Task<IReadOnlyList<BusinessCatalogItem>> ListCatalogItemsAsync(
        Guid idOrganization,
        BusinessCatalogItemType? type,
        CancellationToken cancellationToken)
    {
        var query = dbContext.BusinessCatalogItems
            .AsNoTracking()
            .Where(item => item.IdOrganization == idOrganization);

        if (type.HasValue)
        {
            query = query.Where(item => item.Type == type.Value);
        }

        return await query
            .OrderBy(item => item.Type)
            .ThenBy(item => item.Name)
            .ToArrayAsync(cancellationToken);
    }

    public Task<BusinessCatalogItem?> GetCatalogItemAsync(
        Guid idOrganization,
        Guid idCatalogItem,
        CancellationToken cancellationToken) =>
        dbContext.BusinessCatalogItems.SingleOrDefaultAsync(
            item => item.IdOrganization == idOrganization && item.IdBusinessCatalogItem == idCatalogItem,
            cancellationToken);

    public Task<bool> CatalogCodeExistsAsync(
        Guid idOrganization,
        BusinessCatalogItemType type,
        string code,
        Guid? excludedId,
        CancellationToken cancellationToken)
    {
        var normalizedCode = code.Trim().ToUpperInvariant();

        return dbContext.BusinessCatalogItems
            .IgnoreQueryFilters()
            .AnyAsync(
                item =>
                    item.IdOrganization == idOrganization &&
                    item.Type == type &&
                    item.Code == normalizedCode &&
                    (!excludedId.HasValue || item.IdBusinessCatalogItem != excludedId.Value),
                cancellationToken);
    }

    public Task AddCatalogItemAsync(BusinessCatalogItem item, CancellationToken cancellationToken) =>
        dbContext.BusinessCatalogItems.AddAsync(item, cancellationToken).AsTask();

    public async Task<IReadOnlyList<EligibilityRequirement>> ListEligibilityRequirementsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken) =>
        await dbContext.EligibilityRequirements
            .AsNoTracking()
            .Include(requirement => requirement.Client)
            .Include(requirement => requirement.Service)
            .Include(requirement => requirement.Position)
            .Where(requirement => requirement.IdOrganization == idOrganization)
            .OrderBy(requirement => requirement.TargetType)
            .ThenBy(requirement => requirement.RequirementType)
            .ThenBy(requirement => requirement.Name)
            .ToArrayAsync(cancellationToken);

    public Task<EligibilityRequirement?> GetEligibilityRequirementAsync(
        Guid idOrganization,
        Guid idEligibilityRequirement,
        CancellationToken cancellationToken) =>
        dbContext.EligibilityRequirements
            .Include(requirement => requirement.Client)
            .Include(requirement => requirement.Service)
            .Include(requirement => requirement.Position)
            .SingleOrDefaultAsync(
                requirement =>
                    requirement.IdOrganization == idOrganization &&
                    requirement.IdEligibilityRequirement == idEligibilityRequirement,
                cancellationToken);

    public Task AddEligibilityRequirementAsync(
        EligibilityRequirement requirement,
        CancellationToken cancellationToken) =>
        dbContext.EligibilityRequirements.AddAsync(requirement, cancellationToken).AsTask();

    public Task<Employee?> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        dbContext.Employees.SingleOrDefaultAsync(
            employee => employee.IdOrganization == idOrganization && employee.IdEmployee == idEmployee,
            cancellationToken);

    public Task<Client?> GetClientAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken) =>
        dbContext.Clients.SingleOrDefaultAsync(
            client => client.IdOrganization == idOrganization && client.IdClient == idClient,
            cancellationToken);

    public Task<Service?> GetServiceAsync(
        Guid idOrganization,
        Guid idService,
        CancellationToken cancellationToken) =>
        dbContext.Services
            .Include(service => service.Client)
            .SingleOrDefaultAsync(
                service => service.Client.IdOrganization == idOrganization && service.IdService == idService,
                cancellationToken);

    public Task<Position?> GetPositionAsync(
        Guid idOrganization,
        Guid idPosition,
        CancellationToken cancellationToken) =>
        dbContext.Positions
            .Include(position => position.Service)
            .ThenInclude(service => service.Client)
            .SingleOrDefaultAsync(
                position =>
                    position.IdPosition == idPosition &&
                    position.Service.Client.IdOrganization == idOrganization,
                cancellationToken);

    public async Task<IReadOnlyList<EmployeeSkill>> ListEmployeeSkillsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeSkills
            .AsNoTracking()
            .Include(skill => skill.SkillCatalogItem)
            .Where(skill =>
                skill.IdEmployee == idEmployee &&
                skill.Employee.IdOrganization == idOrganization)
            .OrderBy(skill => skill.SkillCatalogItem.Name)
            .ToArrayAsync(cancellationToken);

    public Task<EmployeeSkill?> GetEmployeeSkillAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idEmployeeSkill,
        CancellationToken cancellationToken) =>
        dbContext.EmployeeSkills
            .Include(skill => skill.SkillCatalogItem)
            .SingleOrDefaultAsync(
                skill =>
                    skill.IdEmployeeSkill == idEmployeeSkill &&
                    skill.IdEmployee == idEmployee &&
                    skill.Employee.IdOrganization == idOrganization,
                cancellationToken);

    public Task AddEmployeeSkillAsync(EmployeeSkill skill, CancellationToken cancellationToken) =>
        dbContext.EmployeeSkills.AddAsync(skill, cancellationToken).AsTask();

    public async Task<IReadOnlyList<EmployeeDocument>> ListEmployeeDocumentsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeDocuments
            .AsNoTracking()
            .Where(document => document.IdEmployee == idEmployee)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<EmployeeEvaluation>> ListEmployeeEvaluationsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeEvaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.IdEmployee == idEmployee)
            .ToArrayAsync(cancellationToken);
}
