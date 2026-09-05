using System.Data;
using GestIA.Application.Common;
using GestIA.Domain.History;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GestIA.Infrastructure.Persistence.Repositories;

internal static class OperationalTransaction
{
    public static async Task<T> ExecuteAsync<T>(
        GestIaDbContext dbContext,
        TimeZoneInfo operationalTimeZone,
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.CurrentTransaction is { } current)
        {
            if (current.GetDbTransaction().IsolationLevel != IsolationLevel.Serializable)
            {
                throw new InvalidOperationException("Operational writes require a serializable transaction.");
            }

            return await action(cancellationToken);
        }

        if (dbContext.ChangeTracker.HasChanges())
        {
            throw new InvalidOperationException("Operational transactions must start without pending changes.");
        }

        // A preview or earlier operation in this scope may have tracked an obsolete status.
        dbContext.ChangeTracker.Clear();

        // The whole business action, including nested SaveChanges, is the retry unit.
        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            var committed = false;
            try
            {
                var result = await action(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                committed = true;
                return result;
            }
            catch (DbUpdateConcurrencyException exception)
            {
                throw new ConcurrencyConflictException(
                    await ConcurrencyConflictDescription.BuildAsync(
                        dbContext, operationalTimeZone, exception, cancellationToken));
            }
            finally
            {
                // Failed saves may have accepted tracked state. Never reuse it on a retry.
                if (!committed)
                {
                    dbContext.ChangeTracker.Clear();
                }
            }
        });
    }

}
