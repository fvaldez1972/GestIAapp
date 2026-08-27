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

    public Task<bool> ExistsAsync(Guid idOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations.AnyAsync(
            organization => organization.IdOrganization == idOrganization,
            cancellationToken);

    public Task<bool> IsCodeInUseAsync(string codeOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations
            .IgnoreQueryFilters()
            .AnyAsync(
                organization => organization.CodeOrganization == codeOrganization,
                cancellationToken);

    public Task<bool> IsRfcInUseAsync(string rfc, CancellationToken cancellationToken) =>
        dbContext.Organizations
            .IgnoreQueryFilters()
            .AnyAsync(organization => organization.Rfc == rfc, cancellationToken);

    public Task AddAsync(Organization organization, CancellationToken cancellationToken) =>
        dbContext.Organizations.AddAsync(organization, cancellationToken).AsTask();
}
