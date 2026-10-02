using GestIA.Domain.History;

namespace GestIA.Application.History;

public interface IOperationalHistoryRepository
{
    Task<IReadOnlyList<OperationalEvent>> ListAsync(
        OperationalEntityType entityType,
        Guid recordId,
        CancellationToken cancellationToken);
}
