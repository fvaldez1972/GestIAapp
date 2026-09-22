using GestIA.Application;
using GestIA.Application.Assignments;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

/// <summary>
/// Que al asignar se consideren las reglas de <b>los cuatro</b> niveles, no sólo dos.
///
/// <para><b>Estas pruebas nacieron persiguiendo un defecto que no existía.</b> La comprobación
/// previa a una asignación manda el cliente y el servicio en nulo, y leyendo esa llamada parece que
/// una regla de nivel Cliente no se aplicaría. Se aplica: <c>CheckEligibilityAsync</c> resuelve el
/// contexto completo desde la posición antes de evaluar. La garantía existía y no se veía en el
/// sitio donde uno la busca, que es justo la clase de cosa que alguien rompe más tarde «limpiando»
/// una resolución que parece redundante.</para>
///
/// <para>Las dos primeras pruebas fijan que las reglas de cliente y de servicio aplican al asignar.
/// La tercera es su control —sin regla la misma asignación pasa, así que ver «rechaza» significa
/// algo— y la cuarta cierra el otro lado: una regla de <b>otro</b> cliente no estorba, porque la
/// cascada agrega sin repartir.</para>
///
/// <para>Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.</para>
/// </summary>
public sealed class AssignmentScopeEligibilityTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Actor TestActor = new();
    private static readonly DateTime Now = new(2026, 9, 19, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 19);

    /// <summary>Una regla del cliente impide asignar a una posición de ese cliente.</summary>
    [OperationalSqlFact]
    public async Task AClientRuleBlocksAnAssignmentToThatClient()
    {
        var seed = await SeedAsync("CLI", EligibilityRequirementTargetType.Client);

        var error = await Assert.ThrowsAsync<ResourceConflictException>(() => AssignAsync(seed));

        Assert.Contains("Manejo de CCTV", error.Message, StringComparison.Ordinal);
    }

    /// <summary>Y una del servicio, lo mismo.</summary>
    [OperationalSqlFact]
    public async Task AServiceRuleBlocksAnAssignmentToThatService()
    {
        var seed = await SeedAsync("SER", EligibilityRequirementTargetType.Service);

        var error = await Assert.ThrowsAsync<ResourceConflictException>(() => AssignAsync(seed));

        Assert.Contains("Manejo de CCTV", error.Message, StringComparison.Ordinal);
    }

    /// <summary>
    /// El control: sin regla, la misma asignación pasa.
    ///
    /// <para>Sin esto, las dos de arriba no distinguirían la regla aplicada de un alta rota para
    /// todo el mundo, que es exactamente el error que cometería una prueba escrita a la ligera.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task WithoutARuleTheSameAssignmentGoesThrough()
    {
        var seed = await SeedAsync("SIN", null);

        var assignment = await AssignAsync(seed);

        Assert.Equal(seed.IdPosition, assignment.IdPosition);
    }

    /// <summary>
    /// Y una regla de OTRO cliente no estorba.
    ///
    /// <para>La cascada agrega, no reparte: si una regla de cliente se aplicara a todos, cerrar el
    /// hueco habría creado uno peor —reglas ajenas bloqueando asignaciones— y las dos primeras
    /// pruebas seguirían en verde.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task ARuleOfAnotherClientDoesNotInterfere()
    {
        var seed = await SeedAsync("OTR", EligibilityRequirementTargetType.Client, ruleForAnotherClient: true);

        var assignment = await AssignAsync(seed);

        Assert.Equal(seed.IdPosition, assignment.IdPosition);
    }

    private async Task<ServiceAssignmentResponse> AssignAsync(Seed seed)
    {
        database.Organization.SetAuthorizedOrganization(seed.IdOrganization);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();

        return await scope.ServiceProvider.GetRequiredService<IAssignmentService>().CreateAssignmentAsync(
            new CreateServiceAssignmentRequest(
                seed.IdOrganization,
                seed.IdClient,
                seed.IdService,
                seed.IdEmployee,
                seed.IdPosition,
                ServiceAssignmentType.Primary,
                Day,
                null,
                true,
                null),
            Token);
    }

    /// <summary>
    /// Una organización con cliente, zona, servicio, posición y persona, y —según la prueba— una
    /// regla que exige una experiencia que la persona no tiene.
    /// </summary>
    private async Task<Seed> SeedAsync(
        string prefix,
        EligibilityRequirementTargetType? nivel,
        bool ruleForAnotherClient = false)
    {
        await using var context = database.Context();
        var sufijo = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Alcance {prefix}", null,
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(organization);

        var client = Client.Create(
            organization.IdOrganization, $"{prefix}-{sufijo}", "Cliente", $"EXA{sufijo[..6]}AA1",
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(client);

        // El segundo cliente sólo existe para la prueba que comprueba que una regla ajena no estorba.
        var otro = Client.Create(
            organization.IdOrganization, $"{prefix}X{sufijo}", "Otro cliente", $"EXB{sufijo[..6]}AA1",
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(otro);

        var site = ClientSite.Create(
            organization.IdOrganization, client.IdClient, $"{prefix}-Z{sufijo[..4]}", "Zona",
            "Calle", "Ciudad", "Estado", "01000", TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(site);

        var service = Service.Create(
            organization.IdOrganization, client.IdClient, site.IdClientSite, null,
            $"{prefix}-S{sufijo[..4]}",
            new ServiceProfile("Servicio", "Servicio", null, Day.AddDays(-30), null),
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(service);

        var position = Position.Create(
            organization.IdOrganization, service.IdService, $"{prefix}-P{sufijo[..4]}",
            new PositionProfile("Caseta poniente", 1, null, null, Day.AddDays(-30)),
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(position);

        var employee = Employee.Create(
            organization.IdOrganization, $"{prefix}-E{sufijo}", "Adrián Escobar",
            "Guardia", Day.AddDays(-200), TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(employee);

        if (nivel is { } destino)
        {
            var experiencia = BusinessCatalogItem.Create(
                organization.IdOrganization,
                new BusinessCatalogItemProfile(
                    BusinessCatalogItemType.Skill, "Manejo de CCTV", null, 1, null, IsBlocking: true),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(experiencia);

            var idCliente = destino is EligibilityRequirementTargetType.Client
                ? (ruleForAnotherClient ? otro.IdClient : client.IdClient)
                : (Guid?)null;

            var idServicio = destino is EligibilityRequirementTargetType.Service
                ? service.IdService
                : (Guid?)null;

            context.Add(EligibilityRequirement.Create(
                organization.IdOrganization,
                new EligibilityRequirementProfile(
                    destino, idCliente, idServicio, null,
                    EligibilityRequirementType.Skill, experiencia.IdBusinessCatalogItem,
                    null, null, "Manejo de CCTV", null),
                TestActor.ActorId, TestActor.ActorName, Now));
        }

        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        return new Seed(
            organization.IdOrganization, client.IdClient, service.IdService,
            position.IdPosition, employee.IdEmployee);
    }

    private sealed record Seed(
        Guid IdOrganization,
        Guid IdClient,
        Guid IdService,
        Guid IdPosition,
        Guid IdEmployee);

    private ServiceProvider Provider()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:GestIa"] = database.ConnectionString }).Build();
        var services = new ServiceCollection().AddLogging().AddApplication().AddInfrastructure(configuration);
        services.AddSingleton<IActorContext>(TestActor);
        services.AddSingleton<IOrganizationContext>(database.Organization);
        services.AddSingleton<IOperationReasonContext>(database.Reason);
        services.AddSingleton<IClock>(new Clock());
        return services.BuildServiceProvider();
    }

    private sealed class Actor : IActorContext
    {
        public Guid ActorId { get; } = Guid.NewGuid();
        public string ActorName => "Pruebas de alcance";
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => Day;
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
