using GestIA.Application.Common;

namespace GestIA.Infrastructure.Persistence;

public sealed class EfUnitOfWork(GestIaDbContext dbContext) : IUnitOfWork
{
    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
