using GestIA.Application.Organizations;
using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class OrganizationRepository(GestIaDbContext dbContext) : IOrganizationRepository
{
    public async Task<IReadOnlyList<Organization>> ListAsync(CancellationToken cancellationToken) =>
        await dbContext.Organizations
            .AsNoTracking()
            .OrderBy(organization => organization.LegalName)
            .ToArrayAsync(cancellationToken);

    public Task<Organization?> GetAsync(Guid idOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations
            .AsNoTracking()
            .SingleOrDefaultAsync(
                organization => organization.IdOrganization == idOrganization,
                cancellationToken);

    public Task<Organization?> GetTrackedAsync(Guid idOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(
                organization => organization.IdOrganization == idOrganization,
                cancellationToken);

    public Task<bool> ExistsAsync(Guid idOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations.AnyAsync(
            organization => organization.IdOrganization == idOrganization,
            cancellationToken);

    public Task<bool> IsCodeInUseAsync(string codeOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                organization => organization.CodeOrganization == codeOrganization,
                cancellationToken);

    public async Task<int> HighestOrganizationCodeNumberAsync(CancellationToken cancellationToken)
    {
        // Se traen los codigos y se parsean en memoria, como ya hace el de clientes: SQL Server no
        // tiene un TryParse que EF pueda traducir, y el numero de organizaciones es pequeño.
        var codes = await dbContext.Organizations
            .AsNoTracking()
            .IgnoreQueryFilters(["Active"])
            .Where(organization => organization.CodeOrganization.StartsWith("ORG-"))
            .Select(organization => organization.CodeOrganization)
            .ToArrayAsync(cancellationToken);

        return codes
            .Select(code => int.TryParse(code.AsSpan(4), out var number) ? number : 0)
            .DefaultIfEmpty(0)
            .Max();
    }

    public Task<bool> IsRfcInUseAsync(string rfc, CancellationToken cancellationToken) =>
        dbContext.Organizations
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(organization => organization.Rfc == rfc, cancellationToken);

    public Task AddAsync(Organization organization, CancellationToken cancellationToken) =>
        dbContext.Organizations.AddAsync(organization, cancellationToken).AsTask();
}
