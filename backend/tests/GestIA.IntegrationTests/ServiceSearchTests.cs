using GestIA.Application.Services;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
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

        var (items, total) = await SearchAsync(Criterios(seed.OrganizationId));

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

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));

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

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));

        Assert.Equal(1, Assert.Single(items, item => item.CodeService == "POS-SER-A").PositionsCount);
    }

    /// <summary>
    /// Y siguen sin contarse con el filtro de estado en «Todos», que es donde fallaba.
    ///
    /// <para>La prueba de arriba pasaba y el defecto existía igual, porque sólo miraba el filtro por
    /// omisión. Con «Todos» o «Inactivos» la consulta lleva <c>IgnoreQueryFilters(["Active"])</c>, y
    /// ese operador vale para la <b>consulta entera</b>: apagaba el filtro también en las
    /// subconsultas que cuentan posiciones y asignaciones. Una fila decía «6 / 6» mientras su propia
    /// ficha decía «Posiciones 0 · Sin posiciones registradas».</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task ThePositionCountIgnoresInactivePositionsAlsoWhenTheListShowsEveryStatus()
    {
        var seed = await SeedAsync("TOD");

        await using (var context = database.Context())
        {
            // Por código, no la primera que salga: las dos piden distinto número de personas
            // —una y dos—, así que dejarlo al orden de la base haría que la cuenta esperada
            // cambiara de una corrida a otra.
            var position = await context.Positions
                .SingleAsync(item => item.CodePosition == "TOD-P1");
            position.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        var (items, _) = await SearchAsync(
            Criterios(seed.OrganizationId, status: ServiceStatusFilter.All));

        var servicio = Assert.Single(items, item => item.CodeService == "TOD-SER-A");
        Assert.Equal(1, servicio.PositionsCount);
        // La suma de personas requeridas viene de las mismas posiciones: si una cuenta, la otra
        // también, y el «6 / 6» de la captura era esto.
        Assert.Equal(2, servicio.RequiredWorkerCount);
    }

    /// <summary>
    /// Un servicio dado de baja se puede abrir.
    ///
    /// <para>El listado sabe enseñarlos —el filtro de estado tiene «Inactivos» y «Todos»—, así que
    /// se puede pulsar una fila que está a la vista. La búsqueda por identificador no ignoraba el
    /// filtro de activo, y esa fila respondía «No se encontró el servicio solicitado»: la pantalla
    /// ofrecía abrir algo que se declaraba inexistente.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AnInactiveServiceCanStillBeOpened()
    {
        var seed = await SeedAsync("BAJ");

        await using (var context = database.Context())
        {
            var servicio = await context.Services
                .FirstAsync(item => item.IdService == seed.ServiceWithPositionsId);
            servicio.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        await using var lectura = database.Context();
        var encontrado = await new ServiceManagementRepository(lectura)
            .GetServiceAsync(seed.ClientId, seed.ServiceWithPositionsId, Token);

        Assert.NotNull(encontrado);
        Assert.False(encontrado!.Active);
    }

    [OperationalSqlFact]
    public async Task EachOptionalFilterNarrowsTheList()
    {
        var seed = await SeedAsync("FIL");

        var byClient = await SearchAsync(Criterios(seed.OrganizationId, idClient: seed.ClientId));
        Assert.Equal(2, byClient.TotalCount);

        var bySite = await SearchAsync(Criterios(seed.OrganizationId, idClientSite: seed.ClientSiteId));
        Assert.Equal(2, bySite.TotalCount);

        var byContract = await SearchAsync(Criterios(seed.OrganizationId, idServiceContract: seed.ContractId));
        Assert.Equal(1, byContract.TotalCount);

        var byOtherClient = await SearchAsync(Criterios(seed.OrganizationId, idClient: Guid.NewGuid()));
        Assert.Equal(0, byOtherClient.TotalCount);
    }

    /// <summary>La búsqueda cubre el servicio y también el cliente, que es como se busca de verdad.</summary>
    [OperationalSqlFact]
    public async Task TheSearchMatchesTheServiceAndTheClient()
    {
        var seed = await SeedAsync("BUS");

        Assert.Equal(1, (await SearchAsync(Criterios(seed.OrganizationId, search: "BUS-SER-A"))).TotalCount);
        Assert.Equal(2, (await SearchAsync(Criterios(seed.OrganizationId, search: "Comercial BUS"))).TotalCount);
        Assert.Equal(0, (await SearchAsync(Criterios(seed.OrganizationId, search: "nada que exista"))).TotalCount);
    }

    /// <summary>
    /// Los tres modos. Omitir el estado devuelve sólo los activos, como el resto de las listas del
    /// sistema; los otros dos apagan el borrado lógico <b>y sólo ése</b>.
    ///
    /// <para>El modo <c>All</c> existe porque el listado de Servicios pinta activos, inactivos y
    /// vencidos en una sola tabla. Antes no había forma de ver los dos primeros juntos.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task TheStatusFilterSeparatesActiveFromInactiveAndCanReturnBoth()
    {
        var seed = await SeedAsync("EST");

        await using (var context = database.Context())
        {
            var service = await context.Services.SingleAsync(item => item.IdService == seed.ServiceWithPositionsId);
            service.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        var active = await SearchAsync(Criterios(seed.OrganizationId));
        Assert.Equal(1, active.TotalCount);
        Assert.All(active.Items, item => Assert.True(item.Active));

        var inactive = await SearchAsync(Criterios(seed.OrganizationId, status: ServiceStatusFilter.Inactive));
        Assert.False(Assert.Single(inactive.Items).Active);

        var all = await SearchAsync(Criterios(seed.OrganizationId, status: ServiceStatusFilter.All));
        Assert.Equal(2, all.TotalCount);
        Assert.Contains(all.Items, item => item.Active);
        Assert.Contains(all.Items, item => !item.Active);
    }

    /// <summary>
    /// La cobertura agregada, que es la razón de que la columna «Posiciones» exista: el hueco se
    /// ve desde el listado, sin abrir la ficha y sin una llamada por fila.
    ///
    /// <para>La definición es la misma de la vacancia por posición, sumada por servicio: una
    /// asignación cuenta si empezó en o antes de la fecha y no había terminado.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task TheListAddsUpRequiredAndAssignedAtTheGivenDate()
    {
        var seed = await SeedAsync("COB");

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));
        var withPositions = Assert.Single(items, item => item.CodeService == "COB-SER-A");

        // Dos posiciones, de uno y de dos: tres personas pedidas y nadie asignado todavía.
        Assert.Equal(3, withPositions.RequiredWorkerCount);
        Assert.Equal(0, withPositions.AssignedWorkerCount);
        Assert.Equal(3, withPositions.Vacancy);
        Assert.True(withPositions.HasVacancy);
        Assert.Equal(Day, withPositions.CoverageDate);

        var withoutPositions = Assert.Single(items, item => item.CodeService == "COB-SER-B");
        Assert.Equal(0, withoutPositions.RequiredWorkerCount);
        Assert.Equal(0, withoutPositions.Vacancy);
        Assert.False(withoutPositions.HasVacancy);
    }

    /// <summary>
    /// La cobertura depende de la fecha, y por eso viaja con ella. Una asignación que empieza
    /// mañana no cubre hoy, y una que terminó ayer tampoco.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheCoverageOnlyCountsAssignmentsInForceThatDay()
    {
        var seed = await SeedAsync("FEC");
        await AssignAsync(seed, first: 1, start: Day, end: Day);

        Assert.Equal(1, (await CoverageAsync(seed, Day)).AssignedWorkerCount);
        // El día en que termina todavía cuenta; el siguiente ya no.
        Assert.Equal(0, (await CoverageAsync(seed, Day.AddDays(1))).AssignedWorkerCount);
        Assert.Equal(0, (await CoverageAsync(seed, Day.AddDays(-1))).AssignedWorkerCount);
    }

    /// <summary>
    /// <b>El excedente se muestra, no se recorta.</b> Más gente que cupo en una posición revela
    /// una violación de control, y esconderla detrás de un cero la vuelve invisible.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheOverstaffedServiceReportsANegativeVacancy()
    {
        var seed = await SeedAsync("EXC");
        await AssignAsync(seed, first: 4, start: Day, end: null);

        var cobertura = await CoverageAsync(seed, Day);

        Assert.Equal(3, cobertura.RequiredWorkerCount);
        Assert.Equal(4, cobertura.AssignedWorkerCount);
        Assert.Equal(-1, cobertura.Vacancy);
        Assert.False(cobertura.HasVacancy);
    }

    [OperationalSqlFact]
    public async Task ThePagingReturnsTheTotalOfTheWholeSetAndOnlyOnePage()
    {
        var seed = await SeedAsync("PAG");

        var page = await SearchAsync(Criterios(seed.OrganizationId, take: 1));

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
        var own = await SearchAsync(Criterios(mine.OrganizationId));
        Assert.Equal(2, own.TotalCount);
        Assert.All(own.Items, item => Assert.StartsWith("MIA", item.CodeService, StringComparison.Ordinal));

        // Parado en la otra organización, ni siquiera pidiendo la primera por parámetro.
        database.Organization.SetAuthorizedOrganization(other.OrganizationId);
        var foreign = await SearchAsync(Criterios(mine.OrganizationId));
        Assert.Equal(2, foreign.TotalCount);
        Assert.All(foreign.Items, item => Assert.StartsWith("OTR", item.CodeService, StringComparison.Ordinal));
    }

    /// <summary>
    /// Criterios con nombres. El registro creció y las llamadas posicionales dejaron de leerse:
    /// seis nulos seguidos no dicen cuál es cuál.
    /// </summary>
    private static ServiceSearchCriteria Criterios(
        Guid organizationId,
        string? search = null,
        Guid? idClient = null,
        Guid? idClientSite = null,
        Guid? idServiceContract = null,
        ServiceStatusFilter status = ServiceStatusFilter.Active,
        DateOnly? coverageDate = null,
        int skip = 0,
        int take = 20) =>
        new(organizationId, search, idClient, idClientSite, idServiceContract, status, coverageDate ?? Day, skip, take);

    private async Task<(IReadOnlyList<ServiceListItemResponse> Items, int TotalCount)> SearchAsync(
        ServiceSearchCriteria criteria)
    {
        await using var context = database.Context();
        return await new ServiceManagementRepository(context).SearchServicesAsync(criteria, Token);
    }

    /// <summary>La cobertura del servicio con posiciones, a la fecha que se pida.</summary>
    private async Task<ServiceListItemResponse> CoverageAsync(Seed seed, DateOnly date)
    {
        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId, coverageDate: date));
        return Assert.Single(items, item => item.IdService == seed.ServiceWithPositionsId);
    }

    /// <summary>Asigna gente a la primera posición del servicio con posiciones.</summary>
    private async Task AssignAsync(Seed seed, int first, DateOnly start, DateOnly? end)
    {
        await using var context = database.Context();
        var position = await context.Positions
            .Where(item => item.IdService == seed.ServiceWithPositionsId)
            .OrderBy(item => item.CodePosition)
            .FirstAsync();

        for (var i = 0; i < first; i++)
        {
            var employee = Employee.Create(
                seed.OrganizationId, $"EMP-{Guid.NewGuid():N}"[..12], $"Empleado {i}", null, Day, ActorId, ActorName, Now);
            var assignment = ServiceAssignment.Create(
                seed.OrganizationId,
                employee.IdEmployee,
                seed.ServiceWithPositionsId,
                new(position.IdPosition, ServiceAssignmentType.Primary, start, end, true, null),
                ActorId,
                ActorName,
                Now);

            context.AddRange(employee, assignment);
        }

        await context.SaveChangesAsync();
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
