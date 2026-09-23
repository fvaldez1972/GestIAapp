using GestIA.Application;
using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Organizations;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

/// <summary>
/// Que una incidencia administrativa bloqueante de verdad bloquee.
///
/// <para><b>Esta prueba existe por un agujero que estuvo abierto un día.</b> La entidad, su catálogo
/// y su marca de bloqueo se construyeron el 19 de septiembre de 2026, y el motor de elegibilidad no
/// las miraba: el administrador registraba un acta, la pantalla le decía «Impide asignar», y el
/// servidor asignaba igual. Una protección que no protege es peor que no tenerla, porque quien la
/// puso deja de vigilar lo que creía cubierto.</para>
///
/// <para>Cubre QA-INC-001 y QA-INC-002 del documento de requerimientos: la informativa se registra
/// sin bloquear, la bloqueante deja a la persona no elegible.</para>
///
/// <para>Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.</para>
/// </summary>
public sealed class AdministrativeIncidentEligibilityTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Actor TestActor = new();
    private static readonly DateTime Now = new(2026, 9, 19, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 19);

    /// <summary>
    /// Sin incidencias, elegible. Es el control: sin él, una prueba que ve «no elegible» no
    /// distingue la incidencia de cualquier otra cosa que estuviera mal en la semilla.
    /// </summary>
    [OperationalSqlFact]
    public async Task WithoutIncidentsThePersonIsEligible()
    {
        var seed = await SeedAsync("SIN");
        var check = await CheckAsync(seed);

        Assert.True(check.IsEligible);
    }

    /// <summary>QA-INC-002: una incidencia activa de motivo bloqueante deja a la persona fuera.</summary>
    [OperationalSqlFact]
    public async Task ABlockingIncidentMakesThePersonIneligible()
    {
        var seed = await SeedAsync("BLO", isBlocking: true);
        var check = await CheckAsync(seed);

        Assert.False(check.IsEligible);

        var motivo = Assert.Single(check.Reasons, reason => reason.Requirement == "Abandono de puesto");
        Assert.True(motivo.IsRequired);
        Assert.False(motivo.Passed);

        // El mensaje nombra el tipo y la fecha. «Tiene una incidencia» obligaría a abrir el
        // expediente y buscarla a mano entre todas las suyas.
        Assert.Contains("Abandono de puesto", motivo.Message, StringComparison.Ordinal);
        Assert.Contains("19/09/2026", motivo.Message, StringComparison.Ordinal);
    }

    /// <summary>QA-INC-001: la informativa se registra, se ve, y no detiene nada.</summary>
    [OperationalSqlFact]
    public async Task AnInformationalIncidentIsVisibleAndDoesNotBlock()
    {
        var seed = await SeedAsync("INF", isBlocking: false);
        var check = await CheckAsync(seed);

        Assert.True(check.IsEligible);

        // Aparece igual: RN-PER-003 pide que deje constancia, no que desaparezca.
        var motivo = Assert.Single(check.Reasons, reason => reason.Requirement == "Abandono de puesto");
        Assert.False(motivo.IsRequired);
        Assert.Contains("no impide asignar", motivo.Message, StringComparison.Ordinal);
    }

    /// <summary>
    /// Retirar la incidencia la deja de aplicar. Es la decisión PD-PER-003: una incidencia bloquea
    /// mientras esté activa, y se deja de bloquear retirándola, no borrándola.
    /// </summary>
    [OperationalSqlFact]
    public async Task RetiringABlockingIncidentRestoresEligibility()
    {
        var seed = await SeedAsync("RET", isBlocking: true);
        Assert.False((await CheckAsync(seed)).IsEligible);

        await using (var context = database.Context())
        {
            var incident = await context.AdministrativeIncidents.FindAsync(
                [seed.IdAdministrativeIncident], Token);
            incident!.Deactivate(TestActor.ActorId, TestActor.ActorName, Now);
            await context.SaveChangesAsync(Token);
        }

        var despues = await CheckAsync(seed);
        Assert.True(despues.IsEligible);

        // Y no se borró: el expediente conserva el hecho, que es el principio 3 del proyecto.
        await using var comprobacion = database.Context();
        Assert.Single(comprobacion.AdministrativeIncidents.IgnoreQueryFilters(["Active"])
            .Where(item => item.IdAdministrativeIncident == seed.IdAdministrativeIncident));
    }

    /// <summary>
    /// Cambiar la marca en el catálogo cambia la validación siguiente, sin tocar el expediente.
    ///
    /// <para>Es RF-CAT-003, la retroactividad, comprobada donde de verdad importa: la incidencia no
    /// se modifica, sólo su tipo en el catálogo, y la persona pasa de elegible a no elegible.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task ChangingTheCatalogMarkAppliesToTheNextValidationWithoutTouchingTheRecord()
    {
        var seed = await SeedAsync("RTR", isBlocking: false);
        Assert.True((await CheckAsync(seed)).IsEligible);

        await using (var context = database.Context())
        {
            var tipo = await context.BusinessCatalogItems.FindAsync([seed.IdIncidentType], Token);
            tipo!.UpdateProfile(
                new BusinessCatalogItemProfile(
                    BusinessCatalogItemType.AdministrativeIncidentType, tipo.Name, null, tipo.Order,
                    null, IsRequired: true),
                TestActor.ActorId, TestActor.ActorName, Now);
            await context.SaveChangesAsync(Token);
        }

        Assert.False((await CheckAsync(seed)).IsEligible);
    }

    private async Task<EligibilityCheckResponse> CheckAsync(Seed seed)
    {
        database.Organization.SetAuthorizedOrganization(seed.IdOrganization);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();

        return await scope.ServiceProvider.GetRequiredService<ICatalogService>().CheckEligibilityAsync(
            new EligibilityCheckQuery(seed.IdOrganization, seed.IdEmployee, null, null, null, Day),
            Token);
    }

    /// <summary>
    /// Una organización con una persona y, salvo en el control, una incidencia activa.
    ///
    /// <para>El código del empleado lleva un sufijo por corrida: aquí los registros no se borran, y
    /// un código fijo chocaría contra el de la corrida anterior con un 409 que parece un defecto del
    /// código y no lo es.</para>
    /// </summary>
    private async Task<Seed> SeedAsync(string prefix, bool? isBlocking = null)
    {
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Incidencias {prefix}", null,
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(organization);

        var employee = Employee.Create(
            organization.IdOrganization, $"{prefix}-{Guid.NewGuid():N}"[..20], "Adrián Escobar",
            "Guardia", Day.AddDays(-200), TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(employee);

        var idIncidentType = Guid.Empty;
        var idIncident = Guid.Empty;

        if (isBlocking.HasValue)
        {
            var tipo = BusinessCatalogItem.Create(
                organization.IdOrganization,
                new BusinessCatalogItemProfile(
                    BusinessCatalogItemType.AdministrativeIncidentType, "Abandono de puesto", null,
                    1, null, isBlocking.Value),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(tipo);
            idIncidentType = tipo.IdBusinessCatalogItem;

            var incidencia = AdministrativeIncident.Create(
                organization.IdOrganization,
                employee.IdEmployee,
                new AdministrativeIncidentProfile(tipo.IdBusinessCatalogItem, Day, "Dejó la caseta sin relevo."),
                TestActor.ActorId, TestActor.ActorName, Now);
            context.Add(incidencia);
            idIncident = incidencia.IdAdministrativeIncident;
        }

        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        return new Seed(organization.IdOrganization, employee.IdEmployee, idIncidentType, idIncident);
    }

    private sealed record Seed(
        Guid IdOrganization,
        Guid IdEmployee,
        Guid IdIncidentType,
        Guid IdAdministrativeIncident);

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
        public string ActorName => "Pruebas de incidencias";
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => Day;
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
