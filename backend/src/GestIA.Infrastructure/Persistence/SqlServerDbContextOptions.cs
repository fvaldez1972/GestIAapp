using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence;

internal static class SqlServerDbContextOptions
{
    public static void Configure(DbContextOptionsBuilder options, string connectionString)
    {
        var migrationsAssembly = typeof(GestIaDbContext).Assembly.GetName().Name
            ?? throw new InvalidOperationException("Could not resolve the migrations assembly name.");

        options.UseSqlServer(
            connectionString,
            sqlServerOptions =>
            {
                sqlServerOptions.MigrationsAssembly(migrationsAssembly);
                sqlServerOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(10),
                    errorNumbersToAdd: null);
            });
    }
}
