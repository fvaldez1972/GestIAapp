using GestIA.Application.Common;

namespace GestIA.Infrastructure.Persistence;

/// <inheritdoc cref="IConcurrencyGuard"/>
public sealed class EfConcurrencyGuard(GestIaDbContext dbContext) : IConcurrencyGuard
{
    public void Expect<T>(T entity, byte[]? expectedRowVersion)
        where T : class
    {
        ArgumentNullException.ThrowIfNull(entity);

        if (expectedRowVersion is null || expectedRowVersion.Length == 0)
        {
            return;
        }

        // El valor ORIGINAL es el que EF pone en el WHERE del UPDATE. Sustituirlo por el que
        // trajo la petición es lo que hace que la escritura falle si alguien más ya guardó.
        dbContext.Entry(entity).Property("RowVersion").OriginalValue = expectedRowVersion;
    }
}
