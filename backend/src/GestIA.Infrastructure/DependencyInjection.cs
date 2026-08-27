using GestIA.Application.Clients;
using GestIA.Application.Common;
using GestIA.Application.Organizations;
using GestIA.Infrastructure.Persistence;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace GestIA.Infrastructure;

public static class DependencyInjection
{
    public const string DatabaseConnectionName = "GestIa";

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(DatabaseConnectionName);

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string '{DatabaseConnectionName}' is required. " +
                "Configure it through ConnectionStrings__GestIa or user secrets.");
        }

        services.AddDbContext<GestIaDbContext>(options =>
            SqlServerDbContextOptions.Configure(options, connectionString));

        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IClientRepository, ClientRepository>();

        services
            .AddHealthChecks()
            .AddDbContextCheck<GestIaDbContext>(
                name: "sqlserver",
                failureStatus: HealthStatus.Unhealthy,
                tags: ["ready", "database"],
                customTestQuery: async (dbContext, cancellationToken) =>
                {
                    await dbContext.Database.OpenConnectionAsync(cancellationToken);
                    await dbContext.Database.CloseConnectionAsync();
                    return true;
                });

        return services;
    }
}
