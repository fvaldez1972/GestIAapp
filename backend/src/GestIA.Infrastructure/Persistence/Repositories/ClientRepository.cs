using GestIA.Application.Clients;
using GestIA.Domain.Clients;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class ClientRepository(GestIaDbContext dbContext) : IClientRepository
{
    public async Task<(IReadOnlyList<Client> Items, int TotalCount)> SearchAsync(
        ClientSearchCriteria criteria,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Organization)
            .Where(client => client.IdOrganization == criteria.IdOrganization);

        if (!string.IsNullOrWhiteSpace(criteria.Search))
        {
            var search = criteria.Search.Trim();
            query = query.Where(client =>
                client.CodeClient.Contains(search) ||
                client.LegalName.Contains(search) ||
                (client.TradeName != null && client.TradeName.Contains(search)) ||
                client.Rfc.Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var clients = await query
            .OrderBy(client => client.LegalName)
            .ThenBy(client => client.CodeClient)
            .Skip(criteria.Skip)
            .Take(criteria.Take)
            .ToArrayAsync(cancellationToken);

        return (clients, totalCount);
    }

    public Task<Client?> GetAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken) =>
        dbContext.Clients
            .Include(client => client.Organization)
            .SingleOrDefaultAsync(
                client => client.IdOrganization == idOrganization && client.IdClient == idClient,
                cancellationToken);

    public Task<bool> IsCodeInUseAsync(
        Guid idOrganization,
        string codeClient,
        Guid? excludedClientId,
        CancellationToken cancellationToken) =>
        dbContext.Clients
            .IgnoreQueryFilters()
            .AnyAsync(
                client => client.IdOrganization == idOrganization &&
                    client.CodeClient == codeClient &&
                    (!excludedClientId.HasValue || client.IdClient != excludedClientId.Value),
                cancellationToken);

    public Task<bool> IsRfcInUseAsync(
        Guid idOrganization,
        string rfc,
        Guid? excludedClientId,
        CancellationToken cancellationToken) =>
        dbContext.Clients
            .IgnoreQueryFilters()
            .AnyAsync(
                client => client.IdOrganization == idOrganization &&
                    client.Rfc == rfc &&
                    (!excludedClientId.HasValue || client.IdClient != excludedClientId.Value),
                cancellationToken);

    public Task AddAsync(Client client, CancellationToken cancellationToken) =>
        dbContext.Clients.AddAsync(client, cancellationToken).AsTask();
}
