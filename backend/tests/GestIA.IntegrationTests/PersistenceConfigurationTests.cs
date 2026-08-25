using GestIA.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

public sealed class PersistenceConfigurationTests : IClassFixture<GestIaApiFactory>
{
    private readonly GestIaApiFactory _factory;

    public PersistenceConfigurationTests(GestIaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public void DbContextUsesSqlServerProvider()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GestIaDbContext>();

        Assert.Equal("Microsoft.EntityFrameworkCore.SqlServer", dbContext.Database.ProviderName);
    }
}
