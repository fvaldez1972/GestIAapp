using GestIA.Domain.History;

namespace GestIA.Application.History;

public interface IOperationalHistoryService
{
    Task<IReadOnlyList<OperationalEventResponse>> ListAsync(
        OperationalEntityType entityType,
        Guid recordId,
        CancellationToken cancellationToken);
}
