using GestIA.Application;
using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Application.Planning;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

/// <summary>
/// Las dos decisiones del 19 de septiembre de 2026 sobre la posición, sujetas donde se pueden
/// romper sin darse cuenta.
///
/// <para><b>La vigencia del puesto cabe dentro de la del servicio.</b> Hasta ese día la posición no
/// tenía fechas: la única vigencia era la del servicio, que es otra cosa. Salirse es error y no
/// aviso, porque un puesto vigente fuera de su contrato produce demanda de planeación para días en
/// los que no hay nada que cubrir.</para>
///
/// <para><b>La severidad de un requisito sale del catálogo, y sólo del catálogo.</b> Es RF-POS-010.
/// La prueba que de verdad importa es la última: una regla con su propia marca puesta a mano <b>no
/// bloquea</b> si su entrada del catálogo no lo dice. Sin ella, alguien podría volver a leer la
/// columna de la regla y las pruebas seguirían en verde.</para>
///
/// <para>Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.</para>
/// </summary>
public sealed class PositionValidityAndSeverityTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Actor TestActor = new();
    private static readonly DateTime Now = new(2026, 9, 19, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 19);

    /// <summary>Lo normal: una vigencia dentro de la del servicio se acepta tal cual.</summary>
    [OperationalSqlFact]
    public async Task APositionCanDeclareItsOwnValidityInsideTheService()
    {
        var seed = await SeedAsync("DEN", Day, Day.AddDays(365));

        var position = await CreatePositionAsync(seed, Day.AddDays(10), Day.AddDays(100));

        Assert.Equal(Day.AddDays(10), position.StartDate);
        Assert.Equal(Day.AddDays(100), position.EndDate);
    }

    /// <summary>
    /// Sin fechas propias hereda las del servicio, que es lo que las 69 posiciones capturadas antes
    /// tenían implícitamente. También mantiene el alta mínima: quien da de alta un puesto normal no
    /// tiene que teclear dos fechas que ya están en el contrato.
    /// </summary>
    [OperationalSqlFact]
    public async Task APositionWithoutDatesInheritsTheServiceValidity()
    {
        var seed = await SeedAsync("HER", Day.AddDays(-30), Day.AddDays(60));

        var position = await CreatePositionAsync(seed, null, null);

        Assert.Equal(Day.AddDays(-30), position.StartDate);
        Assert.Equal(Day.AddDays(60), position.EndDate);
    }

    /// <summary>Empezar antes que el servicio es error, y el mensaje dice desde cuándo se puede.</summary>
    [OperationalSqlFact]
    public async Task APositionCannotStartBeforeItsService()
    {
        var seed = await SeedAsync("ANT", Day, Day.AddDays(365));

        var error = await Assert.ThrowsAsync<RequestValidationException>(
            () => CreatePositionAsync(seed, Day.AddDays(-1), Day.AddDays(30)));

        Assert.Contains("19/09/2026", Mensajes(error), StringComparison.Ordinal);
    }

    /// <summary>Y terminar después tampoco: seguiría pidiendo gente cuando el contrato acabó.</summary>
    [OperationalSqlFact]
    public async Task APositionCannotOutliveItsService()
    {
        var seed = await SeedAsync("DES", Day, Day.AddDays(30));

        var error = await Assert.ThrowsAsync<RequestValidationException>(
            () => CreatePositionAsync(seed, Day, Day.AddDays(31)));

        Assert.Contains("19/10/2026", Mensajes(error), StringComparison.Ordinal);
    }

    /// <summary>Un servicio sin fecha de término no acota por arriba: ahí el puesto es permanente.</summary>
    [OperationalSqlFact]
    public async Task AnOpenEndedServiceAllowsAPermanentPosition()
    {
        var seed = await SeedAsync("ABI", Day, null);

        var position = await CreatePositionAsync(seed, Day, null);

        Assert.Null(position.EndDate);
    }

    /// <summary>
    /// La marca del catálogo decide. Es el control de la prueba que sigue: sin él, ver «no bloquea»
    /// no distinguiría la regla ignorada de un motor que no bloquea por nada.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheCatalogMarkDecidesTheSeverity()
    {
        var seed = await SeedAsync("CAT", Day, null, catalogIsBlocking: true);

        var check = await CheckEligibilityAsync(seed);

        var motivo = Assert.Single(check.Reasons, reason => reason.Requirement == "Manejo de CCTV");
        Assert.True(motivo.IsBlocking);
        Assert.False(check.IsEligible);
    }

    /// <summary>
    /// <b>La prueba que sujeta RF-POS-010.</b> La regla tiene su propia marca puesta a mano, en la
    /// columna que las reglas usaban hasta el 19 de septiembre de 2026, y el catálogo no dice nada.
    ///
    /// <para>Si alguien vuelve a leer la columna de la regla, esta prueba se pone roja. Sin ella,
    /// volver a la doble fuente no rompería nada visible, y la contradicción que RF-POS-010 vino a
    /// cerrar —el mismo requisito bloqueante en un sitio e informativo en otro— volvería a ser
    /// posible sin que nadie se enterara.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task TheRuleOwnMarkNoLongerDecidesAnything()
    {
        var seed = await SeedAsync("REG", Day, null, catalogIsBlocking: null, ruleIsBlocking: true);

        var check = await CheckEligibilityAsync(seed);

        var motivo = Assert.Single(check.Reasons, reason => reason.Requirement == "Manejo de CCTV");
        Assert.False(motivo.IsBlocking);
        Assert.True(check.IsEligible);
    }

    /// <summary>
    /// La restricción bloqueante ya no se puede crear.
    ///
    /// <para><b>Esta prueba tuvo otra forma durante unas horas.</b> Cuando la severidad pasó a salir
    /// sólo del catálogo, la restricción quedó como excepción —bloqueaba por lo que era, porque no
    /// apunta a ninguna entrada de la que heredar—. Esa misma noche el tipo se retiró entero: su
    /// efecto lo absorbieron las incidencias administrativas, que dejan constancia con fecha, tipo
    /// y detalle. La excepción no se revirtió por capricho; se retiró aquello de lo que era
    /// excepción.</para>
    ///
    /// <para>Se comprueba en el servidor y no en la pantalla, porque quitarla del desplegable no es
    /// protegerla: una petición armada a mano seguiría creándolas.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task ABlockingRestrictionCanNoLongerBeCreated()
    {
        var seed = await SeedAsync("RES", Day, null);

        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var catalogos = scope.ServiceProvider.GetRequiredService<ICatalogService>();

        var error = await Assert.ThrowsAsync<RequestValidationException>(() =>
            catalogos.CreateEligibilityRequirementAsync(
                new EligibilityRequirementInput(
                    seed.IdOrganization,
                    EligibilityRequirementTargetType.Organization,
                    null, null, null,
                    EligibilityRequirementType.Restriction,
                    null, null, null,
                    "Sin acceso a bóveda", null),
                Token));

        Assert.Contains("incidencia administrativa", Mensajes(error), StringComparison.OrdinalIgnoreCase);
    }

    private static string Mensajes(RequestValidationException error) =>
        string.Join(" ", error.Errors.SelectMany(entry => entry.Value));

    private async Task<PositionResponse> CreatePositionAsync(Seed seed, DateOnly? start, DateOnly? end)
    {
        database.Organization.SetAuthorizedOrganization(seed.IdOrganization);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();

        return await scope.ServiceProvider.GetRequiredService<IPlanningService>().CreatePositionAsync(
            new CreatePositionRequest(
                seed.IdOrganization,
                seed.IdClient,
                seed.IdService,
                null,
                "Caseta poniente",
                1,
                null,
                null,
                IdShiftPatternTemplate: seed.IdShiftPatternTemplate,
                StartDate: start,
                EndDate: end),
            Token);
    }

    private async Task<EligibilityCheckResponse> CheckEligibilityAsync(Seed seed)
    {
        database.Organization.SetAuthorizedOrganization(seed.IdOrganization);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();

        return await scope.ServiceProvider.GetRequiredService<ICatalogService>().CheckEligibilityAsync(
            new EligibilityCheckQuery(seed.IdOrganization, seed.IdEmployee, null, null, null, Day),
            Token);
    }

    /// <summary>
    /// Una organización con su cliente, su zona y un servicio con la vigencia que pida la prueba.
    ///
    /// <para>Cuando la prueba mira la severidad, además una persona, una experiencia del catálogo y
    /// la regla que la exige. El código del cliente y su RFC llevan sufijo por corrida: aquí los
    /// registros no se borran, y un valor fijo chocaría contra el de la corrida anterior con un 409
    /// que parece un defecto del código y no lo es.</para>
    /// </summary>
    private async Task<Seed> SeedAsync(
        string prefix,
        DateOnly serviceStart,
        DateOnly? serviceEnd,
        bool? catalogIsBlocking = null,
        bool ruleIsBlocking = false)
    {
        await using var context = database.Context();
        var sufijo = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Vigencia {prefix}", null,
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(organization);

        var client = Client.Create(
            organization.IdOrganization, $"{prefix}-{sufijo}", "Cliente",
            $"EXA{sufijo[..6]}AA1", TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(client);

        var site = ClientSite.Create(
            organization.IdOrganization, client.IdClient, $"{prefix}-Z{sufijo[..4]}", "Zona",
            "Calle", "Ciudad", "Estado", "01000", TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(site);

        var service = Service.Create(
            organization.IdOrganization, client.IdClient, site.IdClientSite, null,
            $"{prefix}-S{sufijo[..4]}",
            new ServiceProfile("Servicio", "Servicio", null, serviceStart, serviceEnd),
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(service);

        var employee = Employee.Create(
            organization.IdOrganization, $"{prefix}-E{sufijo}", "Adrián Escobar",
            "Guardia", Day.AddDays(-200), TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(employee);

        // Una plantilla completa, porque desde el 19 de septiembre de 2026 una posición nueva no
        // nace sin patrón del catálogo: sin él no se pueden proyectar turnos ni publicar.
        var plantilla = ShiftPatternTemplate.Create(
            organization.IdOrganization,
            new ShiftPatternTemplateProfile(
                $"Diurno {sufijo[..4]}", null, ShiftDaypart.Day, 1, Day.AddDays(-30), null),
            TestActor.ActorId, TestActor.ActorName, Now);
        plantilla.DeclareDay(1, new TimeOnly(8, 0), new TimeOnly(16, 0), false,
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(plantilla);

        if (catalogIsBlocking.HasValue || ruleIsBlocking)
        {
            var experiencia = BusinessCatalogItem.Create(
                organization.IdOrganization,
                new BusinessCatalogItemProfile(
                    BusinessCatalogItemType.Skill, "Manejo de CCTV", null, 1, null, catalogIsBlocking),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(experiencia);

            var regla = EligibilityRequirement.Create(
                organization.IdOrganization,
                new EligibilityRequirementProfile(
                    EligibilityRequirementTargetType.Organization, null, null, null,
                    EligibilityRequirementType.Skill, experiencia.IdBusinessCatalogItem,
                    null, null, "Manejo de CCTV", null),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(regla);

            if (ruleIsBlocking)
            {
                // Se escribe por EF y no por el perfil, porque el perfil ya no la lleva. Es
                // exactamente el caso que hay que cubrir: la columna sigue en la base, con datos de
                // antes, y tiene que dar igual.
                context.Entry(regla).Property(nameof(EligibilityRequirement.IsBlocking)).CurrentValue = true;
            }
        }

        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        return new Seed(
            organization.IdOrganization, client.IdClient, service.IdService, employee.IdEmployee,
            plantilla.IdShiftPatternTemplate);
    }

    private sealed record Seed(
        Guid IdOrganization,
        Guid IdClient,
        Guid IdService,
        Guid IdEmployee,
        Guid IdShiftPatternTemplate);

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
        public string ActorName => "Pruebas de vigencia";
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => Day;
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
