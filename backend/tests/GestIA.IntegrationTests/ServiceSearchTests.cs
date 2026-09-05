using GestIA.Application.Services;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// La lista de servicios de una organización, sin pasar por el cliente.
///
/// Es la consulta que permite a la pantalla de Servicios abandonar la cascada
/// organización → cliente → servicio, así que lo que hay que demostrar es que resuelve en una
/// consulta lo que antes exigía varias: el nombre del cliente, el conteo de posiciones y los
/// filtros opcionales.
///
/// Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class ServiceSearchTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("0f4a7f4f-1f0e-4a35-8f2e-3f9d5a6b7c80");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 5);
    private static readonly CancellationToken Token = CancellationToken.None;

    [OperationalSqlFact]
    public async Task TheListResolvesClientNameAndPositionCountInOneQuery()
    {
        var seed = await SeedAsync("UNA");

        var (items, total) = await SearchAsync(new(seed.OrganizationId, null, null, null, null, null, 0, 20));

        Assert.Equal(2, total);

        var withPositions = Assert.Single(items, item => item.CodeService == "UNA-SER-A");
        Assert.Equal("Comercial UNA", withPositions.ClientName);
        Assert.Equal(2, withPositions.PositionsCount);
        Assert.Equal("Sede UNA", withPositions.ClientSiteName);

        var withoutPositions = Assert.Single(items, item => item.CodeService == "UNA-SER-B");
        Assert.Equal(0, withoutPositions.PositionsCount);
    }

    /// <summary>
    /// El nombre comercial es el que se muestra, pero muchos clientes no lo tienen. Sin la caída
    /// a la razón social, la lista mostraría una celda vacía en esos casos.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheClientNameFallsBackToTheLegalNameWhenThereIsNoTradeName()
    {
        var seed = await SeedAsync("CAI");

        await using (var context = database.Context())
        {
            var client = await context.Clients.SingleAsync(item => item.IdClient == seed.ClientId);
            client.UpdateProfile(
                new("Razon Social CAI", null, client.Rfc, null, null, null, null, null, null, null, null, null),
                ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        var (items, _) = await SearchAsync(new(seed.OrganizationId, null, null, null, null, null, 0, 20));

        Assert.All(items, item => Assert.Equal("Razon Social CAI", item.ClientName));
    }

    /// <summary>
    /// Sólo se cuentan las posiciones activas: una posición dada de baja ya no es un puesto que
    /// haya que cubrir, y contarla inflaría la carga aparente del servicio.
    /// </summary>
    [OperationalSqlFact]
    public async Task ThePositionCountIgnoresInactivePositions()
    {
        var seed = await SeedAsync("POS");

        await using (var context = database.Context())
        {
            var position = await context.Positions
                .FirstAsync(item => item.IdService == seed.ServiceWithPositionsId);
            position.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        var (items, _) = await SearchAsync(new(seed.OrganizationId, null, null, null, null, null, 0, 20));

        Assert.Equal(1, Assert.Single(items, item => item.CodeService == "POS-SER-A").PositionsCount);
    }

    [OperationalSqlFact]
    public async Task EachOptionalFilterNarrowsTheList()
    {
        var seed = await SeedAsync("FIL");

        var byClient = await SearchAsync(new(seed.OrganizationId, null, seed.ClientId, null, null, null, 0, 20));
        Assert.Equal(2, byClient.TotalCount);

        var bySite = await SearchAsync(new(seed.OrganizationId, null, null, seed.ClientSiteId, null, null, 0, 20));
        Assert.Equal(2, bySite.TotalCount);

        var byContract = await SearchAsync(new(seed.OrganizationId, null, null, null, seed.ContractId, null, 0, 20));
        Assert.Equal(1, byContract.TotalCount);

        var byOtherClient = await SearchAsync(new(seed.OrganizationId, null, Guid.NewGuid(), null, null, null, 0, 20));
        Assert.Equal(0, byOtherClient.TotalCount);
    }

    /// <summary>La búsqueda cubre el servicio y también el cliente, que es como se busca de verdad.</summary>
    [OperationalSqlFact]
    public async Task TheSearchMatchesTheServiceAndTheClient()
    {
        var seed = await SeedAsync("BUS");

        Assert.Equal(1, (await SearchAsync(new(seed.OrganizationId, "BUS-SER-A", null, null, null, null, 0, 20))).TotalCount);
        Assert.Equal(2, (await SearchAsync(new(seed.OrganizationId, "Comercial BUS", null, null, null, null, 0, 20))).TotalCount);
        Assert.Equal(0, (await SearchAsync(new(seed.OrganizationId, "nada que exista", null, null, null, null, 0, 20))).TotalCount);
    }

    /// <summary>
    /// Omitir el estado devuelve sólo los activos, como el resto de las listas del sistema.
    /// Pedir los inactivos apaga el borrado lógico <b>y sólo ése</b>.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheStatusFilterSeparatesActiveFromInactive()
    {
        var seed = await SeedAsync("EST");

        await using (var context = database.Context())
        {
            var service = await context.Services.SingleAsync(item => item.IdService == seed.ServiceWithPositionsId);
            service.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        Assert.Equal(1, (await SearchAsync(new(seed.OrganizationId, null, null, null, null, null, 0, 20))).TotalCount);
        Assert.Equal(1, (await SearchAsync(new(seed.OrganizationId, null, null, null, null, true, 0, 20))).TotalCount);

        var inactive = await SearchAsync(new(seed.OrganizationId, null, null, null, null, false, 0, 20));
        Assert.False(Assert.Single(inactive.Items).Active);
    }

    [OperationalSqlFact]
    public async Task ThePagingReturnsTheTotalOfTheWholeSetAndOnlyOnePage()
    {
        var seed = await SeedAsync("PAG");

        var page = await SearchAsync(new(seed.OrganizationId, null, null, null, null, null, 0, 1));

        Assert.Equal(2, page.TotalCount);
        Assert.Single(page.Items);
    }

    /// <summary>
    /// La lista no ve servicios de otra organización, y no porque el repositorio lo filtre a
    /// mano: lo hace el filtro global de la tanda B con la organización que fijó el guard.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheListNeverShowsServicesOfAnotherOrganization()
    {
        var mine = await SeedAsync("MIA");
        var other = await SeedAsync("OTR");

        database.Organization.SetAuthorizedOrganization(mine.OrganizationId);
        var own = await SearchAsync(new(mine.OrganizationId, null, null, null, null, null, 0, 20));
        Assert.Equal(2, own.TotalCount);
        Assert.All(own.Items, item => Assert.StartsWith("MIA", item.CodeService, StringComparison.Ordinal));

        // Parado en la otra organización, ni siquiera pidiendo la primera por parámetro.
        database.Organization.SetAuthorizedOrganization(other.OrganizationId);
        var foreign = await SearchAsync(new(mine.OrganizationId, null, null, null, null, null, 0, 20));
        Assert.Equal(2, foreign.TotalCount);
        Assert.All(foreign.Items, item => Assert.StartsWith("OTR", item.CodeService, StringComparison.Ordinal));
    }

    private async Task<(IReadOnlyList<ServiceListItemResponse> Items, int TotalCount)> SearchAsync(
        ServiceSearchCriteria criteria)
    {
        await using var context = database.Context();
        return await new ServiceManagementRepository(context).SearchServicesAsync(criteria, Token);
    }

    private async Task<Seed> SeedAsync(string prefix)
    {
        database.Organization.Clear();
        database.Reason.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Organización {prefix}", null, ActorId, ActorName, Now);
        var organizationId = organization.IdOrganization;

        var client = Client.Create(
            organizationId, $"{prefix}-CLI", $"Razon Social {prefix}", "EXA010101AA1", ActorId, ActorName, Now);
        client.UpdateProfile(
            new($"Razon Social {prefix}", $"Comercial {prefix}", "EXA010101AA1",
                null, null, null, null, null, null, null, null, null),
            ActorId, ActorName, Now);

        var site = ClientSite.Create(
            client.IdOrganization, client.IdClient, $"{prefix}-SED", $"Sede {prefix}", "Calle", "Ciudad", "Estado", "01000",
            ActorId, ActorName, Now);

        var contract = ServiceContract.Create(
            organizationId, client.IdClient, $"{prefix}-CON",
            new(ServiceContractStatus.Effective, null, Day, null, 30, 30, "MXN", null, null),
            ActorId, ActorName, Now);

        var withPositions = Service.Create(
            organizationId, client.IdClient, site.IdClientSite, contract.IdServiceContract,
            $"{prefix}-SER-A", "Servicio con posiciones", "Servicio", Day, ActorId, ActorName, Now);

        var withoutPositions = Service.Create(
            organizationId, client.IdClient, site.IdClientSite, null,
            $"{prefix}-SER-B", "Servicio sin posiciones", "Servicio", Day, ActorId, ActorName, Now);

        var first = Position.Create(
            organizationId, withPositions.IdService, $"{prefix}-P1", new("Puesto uno", 1, null, null),
            ActorId, ActorName, Now);
        var second = Position.Create(
            organizationId, withPositions.IdService, $"{prefix}-P2", new("Puesto dos", 2, null, null),
            ActorId, ActorName, Now);

        context.AddRange(organization, client, site, contract, withPositions, withoutPositions, first, second);
        await context.SaveChangesAsync();

        database.Organization.SetAuthorizedOrganization(organizationId);

        return new(
            organizationId, client.IdClient, site.IdClientSite, contract.IdServiceContract,
            withPositions.IdService);
    }

    private sealed record Seed(
        Guid OrganizationId, Guid ClientId, Guid ClientSiteId, Guid ContractId, Guid ServiceWithPositionsId);
}
