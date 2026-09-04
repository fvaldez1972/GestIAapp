using GestIA.Domain.Support;

namespace GestIA.Application.Support;

public interface ISupportSessionRepository
{
    Task<SupportSession?> GetAsync(Guid idSupportSession, CancellationToken cancellationToken);
    Task<IReadOnlyList<SupportSession>> ListOpenForActorAsync(Guid actorId, CancellationToken cancellationToken);
    Task<IReadOnlyList<SupportSession>> ListRecentAsync(int take, CancellationToken cancellationToken);
    Task AddAsync(SupportSession session, CancellationToken cancellationToken);
}
