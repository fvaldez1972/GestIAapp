using GestIA.Application.Clients;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Services;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// El listado de clientes con lo que la tabla necesita resuelto.
///
/// Lo que hay que demostrar es el dato que decide si el paso siguiente se puede dar: <b>cuántas
/// sedes tiene el cliente</b>. El servicio se liga a una sede, así que un cliente sin sede no
/// puede tener servicios, y esa información tiene que estar en la fila y no a una consulta de
/// distancia.
///
/// Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class ClientSearchTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("7d3c9a11-4f28-4a6b-9e05-2c81f7a4b630");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 5);
    private static readonly CancellationToken Token = CancellationToken.None;

    // ── Los agregados ────────────────────────────────────────────────────────────────────────

    [OperationalSqlFact]
    public async Task TheListResolvesSitesContactsAndServicesInOneQuery()
    {
        var seed = await SeedAsync("AGR");

        var (items, total) = await SearchAsync(Criterios(seed.OrganizationId));

        Assert.Equal(3, total);

        var completo = Assert.Single(items, item => item.CodeClient == "AGR-CLI-A");
        Assert.Equal(2, completo.SiteCount);
        Assert.Equal(1, completo.ContactCount);
        Assert.Equal(1, completo.ServiceCount);
        Assert.Equal("Sede Norte", completo.MainSiteName);
        Assert.Equal("Zapopan", completo.MainSiteMunicipality);
        Assert.Equal("Jalisco", completo.MainSiteState);

        // Una de las dos sedes no tiene contacto, y la fila lo dice sin abrir la ficha.
        Assert.Equal(1, completo.SitesWithoutContact);
    }

    /// <summary>
    /// El caso que sostiene la pantalla. Un cliente sin sede tiene que salir en la lista, con cero
    /// y sin sede principal, y <b>sin romper la consulta</b>: la sede principal es un
    /// <c>FirstOrDefault</c> sobre una lista vacía.
    /// </summary>
    [OperationalSqlFact]
    public async Task AClientWithoutASiteIsListedWithZeroAndDoesNotBreakTheQuery()
    {
        var seed = await SeedAsync("SIN");

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));

        var sinSede = Assert.Single(items, item => item.CodeClient == "SIN-CLI-C");
        Assert.Equal(0, sinSede.SiteCount);
        Assert.Equal(0, sinSede.ServiceCount);
        Assert.Null(sinSede.MainSiteName);
        Assert.Null(sinSede.MainSiteMunicipality);
    }

    /// <summary>
    /// Una sede dada de baja no permite crear servicios, así que no cuenta. Contarla dejaría al
    /// cliente fuera del filtro que tiene que encontrarlo.
    /// </summary>
    [OperationalSqlFact]
    public async Task ADeactivatedSiteCountsForNothing()
    {
        var seed = await SeedAsync("BAJ");

        await using (var context = database.Context())
        {
            var site = await context.ClientSites.SingleAsync(item => item.CodeClientSite == "BAJ-SED-2");
            site.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync(Token);
        }

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));
        Assert.Equal(1, Assert.Single(items, item => item.CodeClient == "BAJ-CLI-A").SiteCount);

        var (sinSede, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { SitePresence = ClientSitePresenceFilter.WithoutSite });
        Assert.DoesNotContain(sinSede, item => item.CodeClient == "BAJ-CLI-A");
    }

    // ── Los filtros ──────────────────────────────────────────────────────────────────────────

    [OperationalSqlFact]
    public async Task TheThreeStatusModesShowDifferentClients()
    {
        var seed = await SeedAsync("EST");

        await using (var context = database.Context())
        {
            var client = await context.Clients.SingleAsync(item => item.CodeClient == "EST-CLI-B");
            client.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync(Token);
        }

        var (activos, _) = await SearchAsync(Criterios(seed.OrganizationId));
        Assert.DoesNotContain(activos, item => item.CodeClient == "EST-CLI-B");

        var (inactivos, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { Status = ClientStatusFilter.Inactive });
        Assert.Equal("EST-CLI-B", Assert.Single(inactivos).CodeClient);

        var (todos, total) = await SearchAsync(
            Criterios(seed.OrganizationId) with { Status = ClientStatusFilter.All });
        Assert.Equal(3, total);
        Assert.Contains(todos, item => !item.Active);
        Assert.Contains(todos, item => item.Active);
    }

    [OperationalSqlFact]
    public async Task TheSiteFilterSeparatesThoseThatCanHaveServicesFromThoseThatCannot()
    {
        var seed = await SeedAsync("SED");

        var (conSede, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { SitePresence = ClientSitePresenceFilter.WithSite });
        Assert.All(conSede, item => Assert.True(item.SiteCount > 0));

        var (sinSede, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { SitePresence = ClientSitePresenceFilter.WithoutSite });
        Assert.Equal("SED-CLI-C", Assert.Single(sinSede).CodeClient);
    }

    [OperationalSqlFact]
    public async Task TheMunicipalityFilterUsesTheSitesAndOffersRealOptions()
    {
        var seed = await SeedAsync("MUN");

        var (items, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { Municipality = "Tlaquepaque" });

        Assert.Equal("MUN-CLI-B", Assert.Single(items).CodeClient);

        await using var context = database.Context();
        var municipios = await new ClientRepository(context)
            .ListMunicipalitiesAsync(seed.OrganizationId, Token);

        Assert.Equal(["Tlaquepaque", "Zapopan"], municipios);
    }

    /// <summary>Quien busca «Sede Norte» busca a su cliente, no a la sede.</summary>
    [OperationalSqlFact]
    public async Task TheSearchAlsoLooksInTheSiteName()
    {
        var seed = await SeedAsync("BUS");

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId) with { Search = "Sede Norte" });

        Assert.Equal("BUS-CLI-A", Assert.Single(items).CodeClient);
    }

    // ── El código generado ───────────────────────────────────────────────────────────────────

    /// <summary>
    /// El alta no pide el código: es un identificador de conveniencia que después sirve para
    /// buscar, y nadie sabe qué teclear. El servidor lo pone siguiendo el más alto que ya existe.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheServerGeneratesTheCodeFollowingTheHighestOneInUse()
    {
        var seed = await SeedAsync("COD");

        await using var context = database.Context();
        var repository = new ClientRepository(context);

        // El sembrado usa códigos con otra forma, así que la numeración arranca en uno.
        Assert.Equal(0, await repository.HighestClientCodeNumberAsync(seed.OrganizationId, Token));

        context.Add(Client.Create(
            seed.OrganizationId, "CLI-07", "Con codigo propio", "CCP010101AA1", ActorId, ActorName, Now));
        await context.SaveChangesAsync(Token);

        Assert.Equal(7, await repository.HighestClientCodeNumberAsync(seed.OrganizationId, Token));
    }

    /// <summary>
    /// El código de un cliente dado de baja sigue ocupado: la unicidad no distingue, así que
    /// reutilizarlo chocaría. Por eso el cálculo mira también los inactivos.
    /// </summary>
    [OperationalSqlFact]
    public async Task ADeactivatedClientStillHoldsItsCode()
    {
        var seed = await SeedAsync("OCU");

        await using var context = database.Context();

        var client = Client.Create(
            seed.OrganizationId, "CLI-04", "De baja", "DEB010101AA1", ActorId, ActorName, Now);
        client.Deactivate(ActorId, ActorName, Now);
        context.Add(client);
        await context.SaveChangesAsync(Token);

        Assert.Equal(4, await new ClientRepository(context).HighestClientCodeNumberAsync(seed.OrganizationId, Token));
    }

    // ── El aislamiento ───────────────────────────────────────────────────────────────────────

    [OperationalSqlFact]
    public async Task TheClientsOfOneOrganizationDoNotLeakIntoAnother()
    {
        var mine = await SeedAsync("MIA");
        var other = await SeedAsync("OTR");

        var (items, total) = await SearchAsync(Criterios(other.OrganizationId));

        Assert.Equal(3, total);
        Assert.All(items, item => Assert.StartsWith("OTR-", item.CodeClient, StringComparison.Ordinal));
        Assert.NotEqual(mine.OrganizationId, other.OrganizationId);
    }

    // ── Ayudas ───────────────────────────────────────────────────────────────────────────────

    private static ClientSearchCriteria Criterios(
        Guid organizationId,
        string? search = null,
        ClientStatusFilter status = ClientStatusFilter.Active,
        ClientSitePresenceFilter sitePresence = ClientSitePresenceFilter.Any,
        string? municipality = null) =>
        new(organizationId, search, status, sitePresence, municipality, 0, 50);

    private async Task<(IReadOnlyList<ClientListItemResponse> Items, int TotalCount)> SearchAsync(
        ClientSearchCriteria criteria)
    {
        database.Organization.SetAuthorizedOrganization(criteria.IdOrganization);
        await using var context = database.Context();
        return await new ClientRepository(context).SearchAsync(criteria, Token);
    }

    /// <summary>
    /// Tres clientes: uno con dos sedes —una sin contacto— y un servicio, uno con una sede en otro
    /// municipio, y uno <b>sin ninguna sede</b>, que es el caso que la pantalla existe para
    /// resolver.
    /// </summary>
    private async Task<Seed> SeedAsync(string prefix)
    {
        database.Organization.Clear();
        database.Reason.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Organización {prefix}", null, ActorId, ActorName, Now);
        var organizationId = organization.IdOrganization;

        var conTodo = Client.Create(
            organizationId, $"{prefix}-CLI-A", $"Completo {prefix}", "AAA010101AA1", ActorId, ActorName, Now);
        var otroMunicipio = Client.Create(
            organizationId, $"{prefix}-CLI-B", $"Otro municipio {prefix}", "BBB010101BB2", ActorId, ActorName, Now);
        var sinSede = Client.Create(
            organizationId, $"{prefix}-CLI-C", $"Sin sede {prefix}", "CCC010101CC3", ActorId, ActorName, Now);

        var norte = ClientSite.Create(
            organizationId, conTodo.IdClient, $"{prefix}-SED-1", "Sede Norte",
            "Av. Patria 1250", "Zapopan", "Jalisco", "45110", ActorId, ActorName, Now);
        var sur = ClientSite.Create(
            organizationId, conTodo.IdClient, $"{prefix}-SED-2", "Sede Sur",
            "Calle Ñandú 44", "Zapopan", "Jalisco", "45120", ActorId, ActorName, Now);
        var tlaquepaque = ClientSite.Create(
            organizationId, otroMunicipio.IdClient, $"{prefix}-SED-3", "Planta Tlaquepaque",
            "Av. Río Nilo 900", "Tlaquepaque", "Jalisco", "45601", ActorId, ActorName, Now);

        // Sólo la sede Norte tiene contacto: la Sur alimenta el conteo de «sedes sin contacto».
        var contacto = ClientContact.Create(
            organizationId,
            conTodo.IdClient,
            norte.IdClientSite,
            ClientContactPurpose.Operational,
            "Mariana Escalante Ruvalcaba",
            null,
            "3312345678",
            null,
            true,
            ActorId, ActorName, Now);

        var servicio = Service.Create(
            organizationId, conTodo.IdClient, norte.IdClientSite, null,
            $"{prefix}-SER", $"Servicio {prefix}", "Vigilancia", Day, ActorId, ActorName, Now);

        context.AddRange(
            organization, conTodo, otroMunicipio, sinSede, norte, sur, tlaquepaque, contacto, servicio);
        await context.SaveChangesAsync(Token);

        database.Organization.SetAuthorizedOrganization(organizationId);
        return new(organizationId, conTodo.IdClient, sinSede.IdClient);
    }

    private sealed record Seed(Guid OrganizationId, Guid CompleteClientId, Guid ClientWithoutSiteId);
}
