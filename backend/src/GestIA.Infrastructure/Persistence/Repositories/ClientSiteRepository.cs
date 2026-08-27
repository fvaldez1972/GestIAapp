using GestIA.Application.Clients;
using GestIA.Domain.Clients;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class ClientSiteRepository(GestIaDbContext dbContext) : IClientSiteRepository
{
    public async Task<IReadOnlyList<ClientSite>> ListAsync(
        Guid idClient,
        CancellationToken cancellationToken) =>
        await dbContext.ClientSites
            .AsNoTracking()
            .Where(site => site.IdClient == idClient)
            .OrderBy(site => site.Name)
            .ThenBy(site => site.CodeClientSite)
            .ToArrayAsync(cancellationToken);

    public Task<ClientSite?> GetAsync(
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken) =>
        dbContext.ClientSites.SingleOrDefaultAsync(
            site => site.IdClient == idClient && site.IdClientSite == idClientSite,
            cancellationToken);

    public Task<bool> ExistsAsync(
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken) =>
        dbContext.ClientSites.AnyAsync(
            site => site.IdClient == idClient && site.IdClientSite == idClientSite,
            cancellationToken);

    public Task<bool> IsCodeInUseAsync(
        Guid idClient,
        string codeClientSite,
        Guid? excludedClientSiteId,
        CancellationToken cancellationToken) =>
        dbContext.ClientSites
            .IgnoreQueryFilters()
            .AnyAsync(
                site =>
                    site.IdClient == idClient &&
                    site.CodeClientSite == codeClientSite &&
                    (!excludedClientSiteId.HasValue || site.IdClientSite != excludedClientSiteId.Value),
                cancellationToken);

    public Task AddAsync(ClientSite site, CancellationToken cancellationToken) =>
        dbContext.ClientSites.AddAsync(site, cancellationToken).AsTask();
}
