using GestIA.Application;
using GestIA.Application.Catalogs;
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
/// El perfil que la posición pide, comparado contra la persona.
///
/// <para><b>Lo que estas pruebas sujetan, sobre todo, es que no bloquee.</b> La matriz «Datos
/// necesarios para GestIA» marca con asterisco —el que define bloqueante e informativa— sólo tres
/// catálogos: experiencia, documento y evaluación. Sexo, edad, escolaridad y equipo no lo llevan.
/// De ahí sale que el sistema no excluya a nadie por ellos, y de ahí que desaparezca el riesgo
/// legal de excluir por sexo o por edad que tenía frenada esta pieza. Si alguien los vuelve
/// bloqueantes, estas pruebas se ponen rojas y eso es justamente lo que se quiere.</para>
///
/// <para>Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.</para>
/// </summary>
public sealed class PositionProfileMatchingTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Actor TestActor = new();
    private static readonly DateTime Now = new(2026, 9, 19, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 19);

    /// <summary>Quien tiene un nivel superior al pedido, cumple: la matriz pide el mínimo.</summary>
    [OperationalSqlFact]
    public async Task AHigherEducationLevelMeetsTheMinimum()
    {
        var seed = await SeedAsync("SUP", requiere: "Secundaria", tiene: "Licenciatura");

        var motivo = await EducationReasonAsync(seed);

        Assert.Contains("Secundaria", motivo.Message, StringComparison.Ordinal);
        Assert.Contains("Licenciatura", motivo.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("No alcanza", motivo.Message, StringComparison.Ordinal);
    }

    /// <summary>Y quien no llega, se dice —pero no se le impide asignar.</summary>
    [OperationalSqlFact]
    public async Task ALowerEducationLevelIsReportedButDoesNotBlock()
    {
        var seed = await SeedAsync("INF", requiere: "Licenciatura", tiene: "Primaria");

        var motivo = await EducationReasonAsync(seed);

        Assert.Contains("No alcanza el mínimo", motivo.Message, StringComparison.Ordinal);
        Assert.False(motivo.IsBlocking);
        Assert.True((await CheckAsync(seed)).IsEligible);
    }

    /// <summary>
    /// Un expediente sin escolaridad no incumple: dice «no se sabe».
    ///
    /// <para>Es el mismo criterio del puesto, y el que impide que el día del despliegue toda la
    /// plantilla —271 expedientes, ninguno con escolaridad capturada— apareciera como que no
    /// encaja.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AnEmployeeWithoutEducationIsNotReportedAsFailing()
    {
        var seed = await SeedAsync("NUL", requiere: "Licenciatura", tiene: null);

        var motivo = await EducationReasonAsync(seed);

        Assert.Contains("no tiene escolaridad capturada", motivo.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("No alcanza", motivo.Message, StringComparison.Ordinal);
        Assert.True((await CheckAsync(seed)).IsEligible);
    }

    /// <summary>
    /// <b>La prueba que sujeta la decisión.</b> Ninguno de los cuatro criterios de perfil bloquea.
    ///
    /// <para>Si alguien marca uno como bloqueante, esto se pone rojo. Sin ella, volver a excluir por
    /// sexo o por edad no rompería nada visible, y es exactamente lo que el documento de Posiciones
    /// pedía que no ocurriera sin aprobación formal.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task NoProfileCriterionEverBlocks()
    {
        var seed = await SeedAsync("PER", requiere: "Licenciatura", tiene: "Primaria", conPerfil: true);

        var check = await CheckAsync(seed);
        var perfil = check.Reasons.Where(reason => reason.Scope == "Perfil del puesto").ToArray();

        Assert.Equal(4, perfil.Length);
        Assert.All(perfil, reason => Assert.False(reason.IsBlocking));
        Assert.True(check.IsEligible);
    }

    /// <summary>El sexo y la edad se enseñan sin veredicto: dicen qué pidió el cliente y qué hay.</summary>
    [OperationalSqlFact]
    public async Task SexAndAgeAreShownWithoutAVerdict()
    {
        var seed = await SeedAsync("SEX", requiere: "Primaria", tiene: "Primaria", conPerfil: true);

        var check = await CheckAsync(seed);

        var sexo = Assert.Single(check.Reasons, reason => reason.Requirement == "Sexo");
        Assert.Contains("El cliente pidió Femenino", sexo.Message, StringComparison.Ordinal);
        Assert.Contains("Masculino", sexo.Message, StringComparison.Ordinal);

        var edad = Assert.Single(check.Reasons, reason => reason.Requirement == "Rango de edad");
        Assert.Contains("18 a 30 años", edad.Message, StringComparison.Ordinal);
        Assert.Contains("años", edad.Message, StringComparison.Ordinal);
    }

    private async Task<EligibilityReasonResponse> EducationReasonAsync(Seed seed)
    {
        var check = await CheckAsync(seed);
        return Assert.Single(check.Reasons, reason => reason.Requirement == "Escolaridad");
    }

    private async Task<EligibilityCheckResponse> CheckAsync(Seed seed)
    {
        database.Organization.SetAuthorizedOrganization(seed.IdOrganization);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();

        return await scope.ServiceProvider.GetRequiredService<ICatalogService>().CheckEligibilityAsync(
            new EligibilityCheckQuery(
                seed.IdOrganization, seed.IdEmployee, null, null, seed.IdPosition, Day),
            Token);
    }

    /// <summary>
    /// Una posición con la escolaridad que pida la prueba y, si se le pide, el resto del perfil.
    ///
    /// <para>El catálogo de escolaridad se siembra con su orden, que es lo que decide qué nivel es
    /// «superior»: comparar por nombre no distinguiría Primaria de Posgrado.</para>
    /// </summary>
    private async Task<Seed> SeedAsync(string prefix, string requiere, string? tiene, bool conPerfil = false)
    {
        await using var context = database.Context();
        var sufijo = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Perfil {prefix}", null,
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(organization);

        var niveles = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var orden = 1;

        foreach (var nivel in new[] { "Primaria", "Secundaria", "Bachillerato", "Licenciatura" })
        {
            var item = BusinessCatalogItem.Create(
                organization.IdOrganization,
                new BusinessCatalogItemProfile(
                    BusinessCatalogItemType.EducationLevel, nivel, null, orden++),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(item);
            niveles[nivel] = item.IdBusinessCatalogItem;
        }

        Guid? idSexo = null;
        Guid? idEdad = null;

        if (conPerfil)
        {
            var sexo = BusinessCatalogItem.Create(
                organization.IdOrganization,
                new BusinessCatalogItemProfile(BusinessCatalogItemType.Sex, "Femenino", null, 1),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(sexo);
            idSexo = sexo.IdBusinessCatalogItem;

            var edad = BusinessCatalogItem.Create(
                organization.IdOrganization,
                new BusinessCatalogItemProfile(BusinessCatalogItemType.AgeRange, "18 a 30 años", null, 1),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(edad);
            idEdad = edad.IdBusinessCatalogItem;
        }

        var client = Client.Create(
            organization.IdOrganization, $"{prefix}-{sufijo}", "Cliente", $"EXA{sufijo[..6]}AA1",
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(client);

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
            new PositionProfile(
                "Caseta poniente", 1, null, null, Day.AddDays(-30), null,
                IdSexCatalogItem: idSexo,
                IdAgeRangeCatalogItem: idEdad,
                IdEducationLevelCatalogItem: niveles[requiere]),
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(position);

        if (conPerfil)
        {
            var equipo = BusinessCatalogItem.Create(
                organization.IdOrganization,
                new BusinessCatalogItemProfile(
                    BusinessCatalogItemType.RequiredEquipment, "Radio de comunicación", null, 1),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(equipo);

            context.Add(PositionRequiredEquipment.Create(
                organization.IdOrganization, position.IdPosition, equipo.IdBusinessCatalogItem,
                TestActor.ActorId, TestActor.ActorName, Now));
        }

        var employee = Employee.Create(
            organization.IdOrganization, $"{prefix}-E{sufijo}", "Adrián Escobar",
            "Guardia", Day.AddDays(-200), TestActor.ActorId, TestActor.ActorName, Now);

        employee.UpdateProfile(
            new EmployeeProfile(
                "Adrián Escobar", "Guardia", Day.AddDays(-200), new DateOnly(1994, 3, 1), null,
                "Masculino", null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                IdEducationLevelCatalogItem: tiene is null ? null : niveles[tiene]),
            TestActor.ActorId, TestActor.ActorName, Now);

        context.Add(employee);

        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        return new Seed(organization.IdOrganization, position.IdPosition, employee.IdEmployee);
    }

    private sealed record Seed(Guid IdOrganization, Guid IdPosition, Guid IdEmployee);

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
        public string ActorName => "Pruebas de perfil";
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => Day;
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
