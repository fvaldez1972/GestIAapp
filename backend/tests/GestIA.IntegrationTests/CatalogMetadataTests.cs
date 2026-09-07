using GestIA.Application;
using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Organizations;
using GestIA.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

public sealed class CatalogMetadataTests(OperationalSqlDatabase database) : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Actor TestActor = new();

    [OperationalSqlFact]
    public async Task MetadataPersistsInactiveValuesRemainManageableAndCanBeReactivated()
    {
        var organization = await SeedAsync();
        using var provider = Provider();
        Guid id;
        await using (var scope = provider.CreateAsyncScope())
        {
            var result = await scope.ServiceProvider.GetRequiredService<ICatalogService>().CreateCatalogItemAsync(
                new(organization, BusinessCatalogItemType.Skill, "  Guardia  ", null, 7, false), Token);
            id = result.IdCatalogItem;
            Assert.False(result.Active);
            // El nombre se recorta al guardar: es lo que sostiene la unicidad.
            Assert.Equal("Guardia", result.Name);
        }
        await using (var scope = provider.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
            var stored = Assert.Single(await service.ListCatalogItemsAsync(organization, null, Token));
            Assert.Equal(7, stored.Order);
            var updated = await service.UpdateCatalogItemAsync(id,
                new(organization, stored.Type, "Guardia actualizado", null, Active: true), Token);
            Assert.True(updated.Active);
            Assert.Equal(7, updated.Order);
        }
        await using var context = database.Context();
        var persisted = await context.BusinessCatalogItems.SingleAsync(item => item.IdBusinessCatalogItem == id);
        Assert.True(persisted.Active);
        Assert.Equal("Guardia actualizado", persisted.Name);
    }

    [OperationalSqlFact]
    public async Task RejectsCrossTenantChangesDuplicatesAndIdentityChanges()
    {
        var organization = await SeedAsync();
        var other = await SeedAsync();
        // Sembrar la segunda dejó el contexto ahí; la prueba opera desde la primera.
        database.Organization.SetAuthorizedOrganization(organization);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var input = new CatalogItemInput(organization, BusinessCatalogItemType.Skill, "Norte", null);
        var value = await service.CreateCatalogItemAsync(input, Token);
        await service.DeactivateCatalogItemAsync(organization, value.IdCatalogItem, Token);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCatalogItemAsync(input, Token));
        await Assert.ThrowsAsync<ResourceNotFoundException>(() => service.UpdateCatalogItemAsync(value.IdCatalogItem, input with { IdOrganization = other }, Token));
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.UpdateCatalogItemAsync(value.IdCatalogItem, input with { Type = BusinessCatalogItemType.IncidentReason }, Token));
        Assert.Empty(await service.ListCatalogItemsAsync(other, null, Token));
    }

    [OperationalSqlFact]
    public async Task RejectsUnsupportedTypesAndInvalidMetadata()
    {
        var organization = await SeedAsync();
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var input = new CatalogItemInput(organization, BusinessCatalogItemType.Skill, "Zona", null);
        foreach (var invalid in new[] { input with { Type = (BusinessCatalogItemType)999 }, input with { Order = 0 },
                     input with { Order = 100001 }, input with { Name = " " } })
        {
            await Assert.ThrowsAsync<RequestValidationException>(() => service.CreateCatalogItemAsync(invalid, Token));
        }
        Assert.Empty(await service.ListCatalogItemsAsync(organization, null, Token));
    }

    private async Task<Guid> SeedAsync()
    {
        await using var context = database.Context();
        var organization = Organization.Create(Guid.NewGuid().ToString("N")[..24], "Catalog test", null,
            TestActor.ActorId, TestActor.ActorName, DateTime.UtcNow);
        context.Add(organization);
        await context.SaveChangesAsync();
        // Como haría el guard al autorizar la petición: a partir de aquí se opera dentro de ella.
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);
        return organization.IdOrganization;
    }

    [OperationalSqlFact]
    public async Task GeographicParentsArePersistedScopedAndInactiveAncestorsExcludeChildren()
    {
        var org = await SeedAsync();
        var other = await SeedAsync();
        // Sembrar la segunda dejó el contexto ahí; la prueba opera desde la primera.
        database.Organization.SetAuthorizedOrganization(org);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var country = await service.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.Country, "Mexico", null), Token);
        var stateInput = new CatalogItemInput(org, BusinessCatalogItemType.State, "Nuevo Leon", null, IdParentCatalogItem: country.IdCatalogItem);
        var state = await service.CreateCatalogItemAsync(stateInput, Token);
        var city = await service.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.City, "Monterrey", null, IdParentCatalogItem: state.IdCatalogItem), Token);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCatalogItemAsync(stateInput with { IdOrganization = other }, Token));
        // El nombre repetido bajo el mismo padre es lo que ahora choca, y choca aunque cambie la
        // caja o los acentos: la unicidad la sostiene el nombre plegado.
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCatalogItemAsync(stateInput with { Name = "nuevo leon" }, Token));
        await service.DeactivateCatalogItemAsync(org, country.IdCatalogItem, Token);
        Assert.Empty(CatalogOptions.Active(await service.ListCatalogItemsAsync(org, null, Token)));
        await using var context = database.Context();
        Assert.Equal(state.IdCatalogItem, (await context.BusinessCatalogItems.SingleAsync(item => item.IdBusinessCatalogItem == city.IdCatalogItem)).IdParentCatalogItem);
    }

    // ── Dos pruebas retiradas el 7 de septiembre de 2026 ─────────────────────────────────────
    //
    // Se llamaban MigrationBackfillPreservesSiteAndBuildsGeographicHierarchy y
    // GeographyImportIsRepeatableAndDoesNotReactivateOrRenameExistingStates, y las dos hacian lo
    // mismo: tomar el SQL de una migracion YA DESPLEGADA y volver a ejecutarlo contra el esquema de
    // hoy. Eso solo funciona mientras el esquema no se mueva, y al retirarse la columna Code del
    // catalogo dejaron de poder correr: las dos migraciones insertan escribiendo Code.
    //
    // No se reescriben porque no se puede: una migracion desplegada no se toca, y su premisa ya no
    // existe. Lo que verificaban era un relleno de una sola vez que ya corrio en todas las bases
    // vivas, asi que su valor era historico. La siembra de geografia que si sigue viva la cubre
    // NewOrganizationsReceiveCompleteScopedDefaultsWithAndWithoutAdmin, que cuenta estados y
    // municipios.

    [OperationalSqlFact]
    public async Task NewOrganizationsReceiveCompleteScopedDefaultsWithAndWithoutAdmin()
    {
        await using (var context = database.Context())
        {
            if (!await context.Roles.AnyAsync(role => role.CodeRole == "ORGANIZATION_ADMIN"))
            {
                context.Roles.Add(GestIA.Domain.Security.Role.CreateSystem("ORGANIZATION_ADMIN", "Admin", TestActor.ActorId, TestActor.ActorName, DateTime.UtcNow));
                await context.SaveChangesAsync();
            }
        }
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var plain = await scope.ServiceProvider.GetRequiredService<GestIA.Application.Organizations.IOrganizationService>()
            .CreateAsync(new(Guid.NewGuid().ToString("N")[..24], "Default catalogs", null), Token);
        var provisioned = await scope.ServiceProvider.GetRequiredService<GestIA.Application.Organizations.IOrganizationProvisioningService>()
            .CreateWithAdminAsync(new(Guid.NewGuid().ToString("N")[..24], "With admin", null,
                new("Test admin", $"{Guid.NewGuid():N}@example.test", Guid.NewGuid().ToString("N"))), Token);
        await using var check = database.Context();
        foreach (var id in new[] { plain.IdOrganization, provisioned.Organization.IdOrganization })
        {
            // Se revisa una organización a la vez, como haría cualquier petición real. De paso
            // demuestra que cambiar de organización sobre el MISMO contexto cambia lo que ve.
            database.Organization.SetAuthorizedOrganization(id);
            var items = await check.BusinessCatalogItems.Where(item => item.IdOrganization == id).ToArrayAsync();
            // La geografia sigue viniendo cargada porque no se captura: se elige.
            Assert.Equal(32, items.Count(item => item.Type == BusinessCatalogItemType.State));
            Assert.Equal(2478, items.Count(item => item.Type == BusinessCatalogItemType.City));

            // Los motivos ya NO se siembran, y eso es el punto de la tanda: el administrador no
            // tiene que revisar once valores que no eligio antes de poder confiar en su catalogo.
            // Se crean al vuelo desde Incidencias y desde Cobertura, que es donde se necesitan.
            Assert.DoesNotContain(items, item => item.Type == BusinessCatalogItemType.CoverageReason);
            Assert.DoesNotContain(items, item => item.Type == BusinessCatalogItemType.IncidentReason);
            Assert.DoesNotContain(items, item => item.Type == BusinessCatalogItemType.JobPosition);
            Assert.All(items.Where(item => item.IdParentCatalogItem.HasValue), item => Assert.Contains(items, parent => parent.IdBusinessCatalogItem == item.IdParentCatalogItem));
        }
        Assert.True(await check.OrganizationMemberships.AnyAsync(m => m.IdUser == provisioned.IdAdminUser && m.IdOrganization == provisioned.Organization.IdOrganization));
    }

    [OperationalSqlFact]
    public async Task ContactJobTitleRejectsInactiveAndForeignCatalogsButRetainsHistory()
    {
        var org = await SeedAsync();
        var other = await SeedAsync();
        // Sembrar la segunda dejó el contexto ahí; la prueba opera desde la primera.
        database.Organization.SetAuthorizedOrganization(org);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var catalogs = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var position = await catalogs.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.JobPosition, "Supervisor", null), Token);
        await catalogs.CreateCatalogItemAsync(new(other, BusinessCatalogItemType.JobPosition, "Director", null), Token);
        Guid clientId;
        await using (var context = database.Context())
        {
            var client = GestIA.Domain.Clients.Client.Create(org, "CONTACT", "Client", "EXA010101AA1", TestActor.ActorId, TestActor.ActorName, DateTime.UtcNow);
            context.Add(client);
            await context.SaveChangesAsync();
            clientId = client.IdClient;
        }
        var service = scope.ServiceProvider.GetRequiredService<GestIA.Application.Clients.IClientContactService>();
        var input = new GestIA.Application.Clients.CreateClientContactRequest(org, clientId, null,
            GestIA.Domain.Clients.ClientContactPurpose.Operational, "Contact", "Supervisor", "contact@example.test", null, null, false);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateAsync(input with { JobTitle = "Director" }, Token));
        var contact = await service.CreateAsync(input, Token);
        await catalogs.DeactivateCatalogItemAsync(org, position.IdCatalogItem, Token);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateAsync(input, Token));
        var updated = await service.UpdateAsync(contact.IdClientContact, new(org, clientId, null, input.Purpose,
            "Contact edited", "Supervisor", input.Email, null, null, false), Token);
        Assert.Equal("Supervisor", updated.JobTitle);
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
        public string ActorName => "Catalog tests";
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => DateTime.UtcNow;

        // Doble de prueba: la fecha sale del instante simulado, sin huso.
        public DateOnly Today => DateOnly.FromDateTime(UtcNow);

        // Doble de prueba: sin huso, la hora local es la UTC.
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
