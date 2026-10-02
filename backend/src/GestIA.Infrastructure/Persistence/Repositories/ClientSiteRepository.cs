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

    /// <summary>
    /// Todas las zonas de la organización, ordenadas por cliente.
    ///
    /// <para>No lleva <c>Where</c> por organización: lo pone el filtro global, que alcanza a
    /// <c>ClientSites</c> porque declara <c>IOrganizationScopedEntity</c>. Repetirlo aquí daría la
    /// impresión de que sin esa línea la consulta se escaparía, y la regla del proyecto es la
    /// contraria: sin organización fijada devuelve cero filas, no todas.</para>
    /// </summary>
    public async Task<IReadOnlyList<(ClientSite Zone, string ClientName)>> ListForOrganizationAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var filas = await dbContext.ClientSites
            .AsNoTracking()
            .Join(
                dbContext.Clients.AsNoTracking(),
                site => site.IdClient,
                client => client.IdClient,
                (site, client) => new { Zone = site, ClientName = client.LegalName })
            .OrderBy(fila => fila.ClientName)
            .ThenBy(fila => fila.Zone.Name)
            .ToArrayAsync(cancellationToken);

        return [.. filas.Select(fila => (fila.Zone, fila.ClientName))];
    }

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
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                site =>
                    site.IdClient == idClient &&
                    site.CodeClientSite == codeClientSite &&
                    (!excludedClientSiteId.HasValue || site.IdClientSite != excludedClientSiteId.Value),
                cancellationToken);

    public Task AddAsync(ClientSite site, CancellationToken cancellationToken) =>
        dbContext.ClientSites.AddAsync(site, cancellationToken).AsTask();
}
