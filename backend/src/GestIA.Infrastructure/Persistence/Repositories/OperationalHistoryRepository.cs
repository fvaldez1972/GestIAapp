using GestIA.Application.History;
using GestIA.Domain.History;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

/// <summary>
/// Lee el historial de un registro.
///
/// <b>No filtra por organización a mano, y no es un olvido:</b> el guard del endpoint fija la
/// organización autorizada y el filtro global de <c>OperationalEvent</c> hace el resto. Pedir el
/// historial de un registro de otra organización devuelve lista vacía, no datos ajenos.
/// </summary>
public sealed class OperationalHistoryRepository(GestIaDbContext dbContext)
    : IOperationalHistoryRepository
{
    private const int MaximumEvents = 100;

    public async Task<IReadOnlyList<OperationalEvent>> ListAsync(
        OperationalEntityType entityType,
        Guid recordId,
        CancellationToken cancellationToken) =>
        await dbContext.OperationalEvents
            .AsNoTracking()
            .Where(item => item.EntityType == entityType && item.RecordId == recordId)
            .OrderByDescending(item => item.OccurredAt)
            .ThenByDescending(item => item.IdOperationalEvent)
            .Take(MaximumEvents)
            .ToArrayAsync(cancellationToken);
}
