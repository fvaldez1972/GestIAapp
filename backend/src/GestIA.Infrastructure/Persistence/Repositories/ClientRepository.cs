using GestIA.Application.Clients;
using GestIA.Domain.Clients;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class ClientRepository(GestIaDbContext dbContext) : IClientRepository
{
    /// <summary>
    /// El listado de clientes con lo que la tabla necesita resuelto.
    ///
    /// <para>Los conteos van como subconsultas correlacionadas: una sola sentencia, sin traer ni
    /// una sede a memoria. El de sedes es el que decide si el paso siguiente se puede dar, así que
    /// no puede depender de una consulta por fila.</para>
    /// </summary>
    public async Task<(IReadOnlyList<ClientListItemResponse> Items, int TotalCount)> SearchAsync(
        ClientSearchCriteria criteria,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(criteria);

        var query = dbContext.Clients.AsNoTracking();

        query = criteria.Status switch
        {
            ClientStatusFilter.Inactive => query.IgnoreQueryFilters(["Active"]).Where(client => !client.Active),
            ClientStatusFilter.All => query.IgnoreQueryFilters(["Active"]),
            _ => query,
        };

        query = query.Where(client => client.IdOrganization == criteria.IdOrganization);

        if (!string.IsNullOrWhiteSpace(criteria.Search))
        {
            var search = criteria.Search.Trim();
            query = query.Where(client =>
                client.CodeClient.Contains(search) ||
                client.LegalName.Contains(search) ||
                (client.TradeName != null && client.TradeName.Contains(search)) ||
                client.Rfc.Contains(search) ||
                // También por sede: quien busca «Torre Altavista» busca a su cliente.
                //
                // El `Active` va escrito en las cuatro subconsultas de este método, y no se hereda.
                // Con el filtro de estado en «Todos» o «Inactivos» la consulta lleva
                // `IgnoreQueryFilters(["Active"])`, que vale para la CONSULTA ENTERA: sin esto, una
                // sede dada de baja seguía contando como sede.
                dbContext.ClientSites.Any(site =>
                    site.Active &&
                    site.IdClient == client.IdClient &&
                    site.Name.Contains(search)));
        }

        // «Sin sede» quiere decir sin ninguna **activa**: una sede dada de baja no permite crear
        // servicios, así que contarla dejaría al cliente fuera del filtro que lo tiene que
        // encontrar.
        query = criteria.SitePresence switch
        {
            ClientSitePresenceFilter.WithSite =>
                query.Where(client => dbContext.ClientSites.Any(site =>
                    site.Active && site.IdClient == client.IdClient)),
            ClientSitePresenceFilter.WithoutSite =>
                query.Where(client => !dbContext.ClientSites.Any(site =>
                    site.Active && site.IdClient == client.IdClient)),
            _ => query,
        };

        if (!string.IsNullOrWhiteSpace(criteria.Municipality))
        {
            var municipality = criteria.Municipality.Trim();
            query = query.Where(client =>
                dbContext.ClientSites.Any(site =>
                    site.Active &&
                    site.IdClient == client.IdClient &&
                    site.Municipality == municipality));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(client => client.LegalName)
            .ThenBy(client => client.CodeClient)
            .Skip(criteria.Skip)
            .Take(criteria.Take)
            .Select(client => new ClientListItemResponse(
                client.IdClient,
                client.IdOrganization,
                client.CodeClient,
                client.LegalName,
                client.TradeName,
                client.Rfc,
                client.Active,
                client.CreatedAt,
                // El "Active" va escrito, no heredado del filtro global. Estas subconsultas no lo
                // recibian, asi que la pestana decia "Sedes 6" mientras la lista mostraba 3: las
                // tres desactivadas se contaban y no se veian. Un contador que no cuadra con la
                // lista que tiene al lado hace dudar de los dos.
                dbContext.ClientSites.Count(site => site.IdClient == client.IdClient && site.Active),
                dbContext.ClientSites.Count(site =>
                    site.IdClient == client.IdClient
                    && site.Active
                    // Un contacto del cliente cubre a todas sus sedes: no hace falta uno por sede
                    // para que alguien responda. Antes solo contaba los atados a la sede, y como 23
                    // de los 26 contactos son del cliente, casi toda sede salia "sin contacto".
                    //
                    // "Del cliente" es el que NO tiene sede. Uno atado a otra sede no cubre a esta:
                    // el primer intento lo daba por bueno y dejaba en cero el conteo de sedes sin
                    // contacto en cuanto el cliente tuviera un contacto en cualquier parte.
                    && !dbContext.ClientContacts.Any(contact =>
                        contact.Active
                        && contact.IdClient == client.IdClient
                        && (contact.IdClientSite == site.IdClientSite || contact.IdClientSite == null))),
                dbContext.ClientContacts.Count(contact => contact.IdClient == client.IdClient && contact.Active),
                dbContext.Services.Count(service => service.IdClient == client.IdClient && service.Active),
                // La sede principal es la primera por nombre. No hay marca de «principal» en el
                // modelo, y elegir una al azar haría que la misma fila cambiara entre cargas.
                dbContext.ClientSites
                    .Where(site => site.IdClient == client.IdClient && site.Active)
                    .OrderBy(site => site.Name)
                    .Select(site => site.Name)
                    .FirstOrDefault(),
                dbContext.ClientSites
                    .Where(site => site.IdClient == client.IdClient && site.Active)
                    .OrderBy(site => site.Name)
                    .Select(site => site.Municipality)
                    .FirstOrDefault(),
                dbContext.ClientSites
                    .Where(site => site.IdClient == client.IdClient && site.Active)
                    .OrderBy(site => site.Name)
                    .Select(site => site.State)
                    .FirstOrDefault()))
            .ToArrayAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<string>> ListMunicipalitiesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken) =>
        await dbContext.ClientSites
            .AsNoTracking()
            .Where(site => site.IdOrganization == idOrganization)
            .Select(site => site.Municipality)
            .Distinct()
            .OrderBy(municipality => municipality)
            .ToArrayAsync(cancellationToken);

    /// <summary>
    /// El número más alto de los códigos con forma <c>CLI-NN</c>.
    ///
    /// <para>Mira también los inactivos: el código sigue ocupado aunque el cliente esté dado de
    /// baja, y reutilizarlo chocaría con la unicidad.</para>
    /// </summary>
    public async Task<int> HighestClientCodeNumberAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var codes = await dbContext.Clients
            .AsNoTracking()
            .IgnoreQueryFilters(["Active"])
            .Where(client => client.IdOrganization == idOrganization && client.CodeClient.StartsWith("CLI-"))
            .Select(client => client.CodeClient)
            .ToArrayAsync(cancellationToken);

        return codes
            .Select(code => int.TryParse(code.AsSpan(4), out var number) ? number : 0)
            .DefaultIfEmpty(0)
            .Max();
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
            .IgnoreQueryFilters(["Active"])
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
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                client => client.IdOrganization == idOrganization &&
                    client.Rfc == rfc &&
                    (!excludedClientId.HasValue || client.IdClient != excludedClientId.Value),
                cancellationToken);

    public Task AddAsync(Client client, CancellationToken cancellationToken) =>
        dbContext.Clients.AddAsync(client, cancellationToken).AsTask();
}
