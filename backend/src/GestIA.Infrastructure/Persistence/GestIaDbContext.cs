using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence;

public sealed class GestIaDbContext(DbContextOptions<GestIaDbContext> options)
    : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GestIaDbContext).Assembly);
    }
}
