using GestIA.Application.Support;
using GestIA.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class SupportSessionRepository(GestIaDbContext dbContext) : ISupportSessionRepository
{
    public Task<SupportSession?> GetAsync(Guid idSupportSession, CancellationToken cancellationToken) =>
        dbContext.SupportSessions
            .IgnoreQueryFilters()
            .Include(session => session.Organization)
            .SingleOrDefaultAsync(session => session.IdSupportSession == idSupportSession, cancellationToken);

    public async Task<IReadOnlyList<SupportSession>> ListOpenForActorAsync(
        Guid actorId,
        CancellationToken cancellationToken) =>
        await dbContext.SupportSessions
            .IgnoreQueryFilters()
            .Include(session => session.Organization)
            .Where(session => session.CreatedBy == actorId && session.Active && session.EndedAt == null)
            .OrderByDescending(session => session.StartsAt)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<SupportSession>> ListRecentAsync(
        int take,
        CancellationToken cancellationToken) =>
        await dbContext.SupportSessions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(session => session.Organization)
            .OrderByDescending(session => session.StartsAt)
            .Take(take)
            .ToArrayAsync(cancellationToken);

    public Task AddAsync(SupportSession session, CancellationToken cancellationToken) =>
        dbContext.SupportSessions.AddAsync(session, cancellationToken).AsTask();
}
