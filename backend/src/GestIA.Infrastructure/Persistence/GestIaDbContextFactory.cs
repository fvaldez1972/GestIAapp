using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GestIA.Infrastructure.Persistence;

public sealed class GestIaDbContextFactory : IDesignTimeDbContextFactory<GestIaDbContext>
{
    private const string DesignTimeConnectionVariable = "GESTIA_SQL_CONNECTION";

    public GestIaDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(DesignTimeConnectionVariable);

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Set {DesignTimeConnectionVariable} before using dotnet ef. " +
                "The value must be a development SQL Server connection string.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<GestIaDbContext>();
        SqlServerDbContextOptions.Configure(optionsBuilder, connectionString);

        return new GestIaDbContext(optionsBuilder.Options);
    }
}
