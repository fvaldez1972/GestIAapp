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
    private static readonly string[] ExpectedSynonyms = ["Vigilante", "Custodio"];

    [OperationalSqlFact]
    public async Task MetadataPersistsInactiveValuesRemainManageableAndCanBeReactivated()
    {
        var organization = await SeedAsync();
        using var provider = Provider();
        Guid id;
        await using (var scope = provider.CreateAsyncScope())
        {
            var result = await scope.ServiceProvider.GetRequiredService<ICatalogService>().CreateCatalogItemAsync(
                new(organization, BusinessCatalogItemType.Skill, " guard ", "Guardia", null, "Seguridad", 7,
                    [" Vigilante ", "vigilante", "Custodio"], false), Token);
            id = result.IdCatalogItem;
            Assert.False(result.Active);
            Assert.Equal("GUARD", result.Code);
        }
        await using (var scope = provider.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
            var stored = Assert.Single(await service.ListCatalogItemsAsync(organization, null, Token));
            Assert.Equal("Seguridad", stored.Group);
            Assert.Equal(7, stored.Order);
            Assert.Equal(ExpectedSynonyms, stored.Synonyms);
            var updated = await service.UpdateCatalogItemAsync(id,
                new(organization, stored.Type, stored.Code, "Guardia actualizado", null, Active: true), Token);
            Assert.True(updated.Active);
            Assert.Equal(7, updated.Order);
            Assert.Equal(stored.Synonyms, updated.Synonyms);
        }
        await using var context = database.Context();
        var persisted = await context.BusinessCatalogItems.SingleAsync(item => item.IdBusinessCatalogItem == id);
        Assert.True(persisted.Active);
        Assert.Equal("Seguridad", persisted.Group);
    }

    [OperationalSqlFact]
    public async Task RejectsCrossTenantChangesDuplicatesAndIdentityChanges()
    {
        var organization = await SeedAsync();
        var other = await SeedAsync();
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var input = new CatalogItemInput(organization, BusinessCatalogItemType.Zone, "NORTH", "Norte", null);
        var value = await service.CreateCatalogItemAsync(input, Token);
        await service.DeactivateCatalogItemAsync(organization, value.IdCatalogItem, Token);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCatalogItemAsync(input, Token));
        await Assert.ThrowsAsync<ResourceNotFoundException>(() => service.UpdateCatalogItemAsync(value.IdCatalogItem, input with { IdOrganization = other }, Token));
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.UpdateCatalogItemAsync(value.IdCatalogItem, input with { Code = "SOUTH" }, Token));
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.UpdateCatalogItemAsync(value.IdCatalogItem, input with { Type = BusinessCatalogItemType.Skill }, Token));
        Assert.Empty(await service.ListCatalogItemsAsync(other, null, Token));
    }

    [OperationalSqlFact]
    public async Task RejectsUnsupportedTypesAndInvalidMetadata()
    {
        var organization = await SeedAsync();
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var input = new CatalogItemInput(organization, BusinessCatalogItemType.Zone, "Z", "Zona", null);
        foreach (var invalid in new[] { input with { Type = (BusinessCatalogItemType)999 }, input with { Order = 0 },
                     input with { Order = 100001 }, input with { Group = " " }, input with { Synonyms = [new string('x', 81)] },
                     input with { Synonyms = Enumerable.Repeat("alias", 21).ToArray() } })
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
        return organization.IdOrganization;
    }

    [OperationalSqlFact]
    public async Task GeographicParentsArePersistedScopedAndInactiveAncestorsExcludeChildren()
    {
        var org = await SeedAsync();
        var other = await SeedAsync();
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var country = await service.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.Country, "MX", "Mexico", null), Token);
        var stateInput = new CatalogItemInput(org, BusinessCatalogItemType.State, "NL", "Nuevo Leon", null, IdParentCatalogItem: country.IdCatalogItem);
        var state = await service.CreateCatalogItemAsync(stateInput, Token);
        var city = await service.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.City, "MTY", "Monterrey", null, IdParentCatalogItem: state.IdCatalogItem), Token);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCatalogItemAsync(stateInput with { IdOrganization = other }, Token));
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCatalogItemAsync(stateInput with { Code = "DUP" }, Token));
        await service.DeactivateCatalogItemAsync(org, country.IdCatalogItem, Token);
        Assert.Empty(CatalogOptions.Active(await service.ListCatalogItemsAsync(org, null, Token)));
        await using var context = database.Context();
        Assert.Equal(state.IdCatalogItem, (await context.BusinessCatalogItems.SingleAsync(item => item.IdBusinessCatalogItem == city.IdCatalogItem)).IdParentCatalogItem);
    }

    [OperationalSqlFact]
    public async Task MigrationBackfillPreservesSiteAndBuildsGeographicHierarchy()
    {
        var org = await SeedAsync();
        await using var context = database.Context();
        var client = GestIA.Domain.Clients.Client.Create(org, "BACKFILL", "Client", "EXA010101AA1", TestActor.ActorId, TestActor.ActorName, DateTime.UtcNow);
        var site = GestIA.Domain.Clients.ClientSite.Create(client.IdClient, "SITE", "Site", "Street", "Monterrey", "Nuevo Leon", "64000", TestActor.ActorId, TestActor.ActorName, DateTime.UtcNow);
        context.AddRange(client, site);
        await context.SaveChangesAsync();
        var migration = new GestIA.Infrastructure.Persistence.Migrations.GeographicCatalogRelations();
        foreach (var operation in migration.UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.SqlOperation>())
            await context.Database.ExecuteSqlRawAsync(operation.Sql, Token);
        var values = await context.BusinessCatalogItems.Where(item => item.IdOrganization == org).ToArrayAsync();
        var country = Assert.Single(values, item => item.Type == BusinessCatalogItemType.Country);
        var state = Assert.Single(values, item => item.Type == BusinessCatalogItemType.State);
        var city = Assert.Single(values, item => item.Type == BusinessCatalogItemType.City);
        Assert.Equal(country.IdBusinessCatalogItem, state.IdParentCatalogItem);
        Assert.Equal(state.IdBusinessCatalogItem, city.IdParentCatalogItem);
        Assert.Equal("Monterrey", city.Name);
        Assert.Equal("Monterrey", (await context.ClientSites.SingleAsync(item => item.IdClientSite == site.IdClientSite)).Municipality);
    }

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
            var items = await check.BusinessCatalogItems.Where(item => item.IdOrganization == id).ToArrayAsync();
            Assert.Equal(32, items.Count(item => item.Type == BusinessCatalogItemType.State));
            Assert.Equal(2478, items.Count(item => item.Type == BusinessCatalogItemType.City));
            Assert.Equal(6, items.Count(item => item.Type == BusinessCatalogItemType.CoverageReason));
            Assert.All(items.Where(item => item.IdParentCatalogItem.HasValue), item => Assert.Contains(items, parent => parent.IdBusinessCatalogItem == item.IdParentCatalogItem));
        }
        Assert.True(await check.OrganizationMemberships.AnyAsync(m => m.IdUser == provisioned.IdAdminUser && m.IdOrganization == provisioned.Organization.IdOrganization));
    }

    [OperationalSqlFact]
    public async Task ContactJobTitleRejectsInactiveAndForeignCatalogsButRetainsHistory()
    {
        var org = await SeedAsync();
        var other = await SeedAsync();
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var catalogs = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var position = await catalogs.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.JobPosition, "JOB", "Supervisor", null), Token);
        await catalogs.CreateCatalogItemAsync(new(other, BusinessCatalogItemType.JobPosition, "JOB", "Director", null), Token);
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

    [OperationalSqlFact]
    public async Task GeographyImportIsRepeatableAndDoesNotReactivateOrRenameExistingStates()
    {
        var org = await SeedAsync();
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var country = await service.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.Country, "MX", "Mexico", null), Token);
        var state = await service.CreateCatalogItemAsync(new(org, BusinessCatalogItemType.State, "LEGACY", "Nuevo Leon", null, Active: false, IdParentCatalogItem: country.IdCatalogItem), Token);
        await using var context = database.Context();
        var migration = new GestIA.Infrastructure.Persistence.Migrations.CoverageCatalogReference();
        var sql = migration.UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.SqlOperation>().Last().Sql;
        await context.Database.OpenConnectionAsync(Token);
        await using var command = context.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(Token);
        var firstCount = await context.BusinessCatalogItems.CountAsync(item => item.IdOrganization == org);
        await command.ExecuteNonQueryAsync(Token);
        Assert.Equal(firstCount, await context.BusinessCatalogItems.CountAsync(item => item.IdOrganization == org));
        var preserved = await context.BusinessCatalogItems.IgnoreQueryFilters().SingleAsync(item => item.IdBusinessCatalogItem == state.IdCatalogItem);
        Assert.False(preserved.Active);
        Assert.Equal("Nuevo Leon", preserved.Name);
        Assert.Equal(2478, await context.BusinessCatalogItems.CountAsync(item => item.IdOrganization == org && item.Type == BusinessCatalogItemType.City));
    }

    private ServiceProvider Provider()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:GestIa"] = database.ConnectionString }).Build();
        var services = new ServiceCollection().AddLogging().AddApplication().AddInfrastructure(configuration);
        services.AddSingleton<IActorContext>(TestActor);
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
    }
}
