using GestIA.Application;
using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Organizations;
using GestIA.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

/// <summary>
/// La marca de bloqueo del catálogo tiene dos estados, y los dos se pueden guardar.
///
/// <para><b>Por qué existe este archivo.</b> Hasta el 21 de septiembre de 2026 la marca tenía un
/// tercer estado, «sin decidir», que <b>no se podía guardar</b>: el servicio resolvía la marca con
/// <c>request.IsRequired ?? existing?.IsRequired</c>, así que un nulo entrante —que es como viaja
/// «sin decidir»— conservaba la marca anterior en vez de borrarla. Quien la elegía veía un guardado
/// correcto y ningún cambio. No lo detectó ninguna prueba porque no había ninguna que guardara una
/// marca y volviera a leerla.</para>
///
/// <para>Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.</para>
/// </summary>
public sealed class RequiredMarkTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Actor TestActor = new();
    private static readonly DateTime Now = new(2026, 9, 21, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>
    /// Lo que el defecto impedía: pasar de bloqueante a informativa y que se quede.
    ///
    /// <para>Se vuelve a leer del servidor en vez de creerle a la respuesta del guardado, porque un
    /// eco de lo que se mandó no demuestra que se haya escrito.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AMarkCanBeChangedFromBlockingToInformativeAndItPersists()
    {
        var idOrganization = await SeedOrganizationAsync();

        var creada = await CatalogsAsync(idOrganization, catalogs => catalogs.CreateCatalogItemAsync(
            Entrada(idOrganization, "Polígrafo", isBlocking: true), Token));
        Assert.True(creada.IsRequired);

        await CatalogsAsync(idOrganization, catalogs => catalogs.UpdateCatalogItemAsync(
            creada.IdCatalogItem, Entrada(idOrganization, "Polígrafo", isBlocking: false), Token));

        var releida = await LeerAsync(idOrganization, creada.IdCatalogItem);
        Assert.False(releida.IsRequired);
    }

    /// <summary>
    /// El control de la prueba anterior, en el otro sentido.
    ///
    /// <para>Sin él, «se guarda informativa» no distinguiría un guardado que funciona de un
    /// servidor que escribe <c>false</c> siempre. Son la misma operación con el valor contrario, y
    /// el defecto que hubo era exactamente de esa forma: uno de los dos sentidos no pasaba.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AndAlsoFromInformativeToBlocking()
    {
        var idOrganization = await SeedOrganizationAsync();

        var creada = await CatalogsAsync(idOrganization, catalogs => catalogs.CreateCatalogItemAsync(
            Entrada(idOrganization, "Examen toxicológico", isBlocking: false), Token));
        Assert.False(creada.IsRequired);

        await CatalogsAsync(idOrganization, catalogs => catalogs.UpdateCatalogItemAsync(
            creada.IdCatalogItem, Entrada(idOrganization, "Examen toxicológico", isBlocking: true), Token));

        var releida = await LeerAsync(idOrganization, creada.IdCatalogItem);
        Assert.True(releida.IsRequired);
    }

    /// <summary>
    /// Una entrada nueva de un catálogo con marca no puede nacer sin decidir.
    ///
    /// <para>Es lo que cierra el tercer estado: mientras se pudiera crear en nulo, la pantalla
    /// tendría que ofrecer otra vez la opción que no se podía guardar.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task ANewEntryCannotBeBornUndecided()
    {
        var idOrganization = await SeedOrganizationAsync();

        var error = await Assert.ThrowsAsync<RequestValidationException>(() =>
            CatalogsAsync(idOrganization, catalogs => catalogs.CreateCatalogItemAsync(
                Entrada(idOrganization, "Estudio socioeconómico", isBlocking: null), Token)));

        Assert.Contains(
            "impide asignar",
            string.Join(" ", error.Errors.SelectMany(entry => entry.Value)),
            StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Y el control del control: un catálogo que no participa en la elegibilidad sigue sin marca y
    /// se crea sin problema.
    ///
    /// <para>Sin esto, «pide la marca» podría significar que la pide en todos lados, que sería un
    /// defecto nuevo en los catorce catálogos restantes.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task ACatalogWithoutTheMarkIsStillCreatedWithoutOne()
    {
        var idOrganization = await SeedOrganizationAsync();

        var creada = await CatalogsAsync(idOrganization, catalogs => catalogs.CreateCatalogItemAsync(
            new CatalogItemInput(
                idOrganization, BusinessCatalogItemType.CoverageReason, "Incapacidad médica", null),
            Token));

        Assert.Null(creada.IsRequired);
        Assert.False(creada.SupportsRequiredMark);
    }

    private static CatalogItemInput Entrada(Guid idOrganization, string name, bool? isBlocking) =>
        new(idOrganization, BusinessCatalogItemType.EmployeeEvaluationCategory, name, null,
            Order: 1, Active: true, IdParentCatalogItem: null, IsRequired: isBlocking);

    private async Task<CatalogItemResponse> LeerAsync(Guid idOrganization, Guid idCatalogItem)
    {
        var todas = await CatalogsAsync(idOrganization, catalogs => catalogs.ListCatalogItemsAsync(
            idOrganization, BusinessCatalogItemType.EmployeeEvaluationCategory, Token));
        return todas.Single(item => item.IdCatalogItem == idCatalogItem);
    }

    private async Task<T> CatalogsAsync<T>(Guid idOrganization, Func<ICatalogService, Task<T>> action)
    {
        database.Organization.SetAuthorizedOrganization(idOrganization);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<ICatalogService>());
    }

    private async Task<Guid> SeedOrganizationAsync()
    {
        await using var context = database.Context();
        var organization = Organization.Create(
            $"MAR{Guid.NewGuid():N}"[..24], "Marca de bloqueo", null,
            TestActor.ActorId, TestActor.ActorName, Now);
        context.Add(organization);
        await context.SaveChangesAsync(Token);
        return organization.IdOrganization;
    }

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
        public string ActorName => "Pruebas de la marca de obligatorio";
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => new(2026, 9, 21);
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
