using GestIA.Domain.History;

namespace GestIA.Application.History;

public sealed class OperationalHistoryService(IOperationalHistoryRepository repository)
    : IOperationalHistoryService
{
    public async Task<IReadOnlyList<OperationalEventResponse>> ListAsync(
        OperationalEntityType entityType,
        Guid recordId,
        CancellationToken cancellationToken)
    {
        var events = await repository.ListAsync(entityType, recordId, cancellationToken);
        return [.. events.Select(Map)];
    }

    private static OperationalEventResponse Map(OperationalEvent item) =>
        new(
            item.IdOperationalEvent,
            item.EntityType,
            item.RecordId,
            item.Action,
            item.Reason,
            item.IsReasonRequired,
            item.ActorName,
            item.OccurredAt,
            item.BeforeSnapshot,
            item.AfterSnapshot);
}
