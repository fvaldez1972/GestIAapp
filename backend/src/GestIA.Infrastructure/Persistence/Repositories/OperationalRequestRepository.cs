using GestIA.Application.Requests;
using GestIA.Domain.Requests;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class OperationalRequestRepository(GestIaDbContext dbContext) : IOperationalRequestRepository
{
    public async Task<(IReadOnlyList<OperationalRequest> Items, int TotalCount)> SearchAsync(
        OperationalRequestSearchCriteria criteria,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Set<OperationalRequest>()
            .AsNoTracking()
            .Include(request => request.Organization)
            .Include(request => request.Client)
            .Include(request => request.Service)
            .Where(request => request.IdOrganization == criteria.IdOrganization);

        if (criteria.Status is not null)
        {
            query = query.Where(request => request.Status == criteria.Status);
        }

        if (criteria.RequestType is not null)
        {
            query = query.Where(request => request.RequestType == criteria.RequestType);
        }

        if (!string.IsNullOrWhiteSpace(criteria.Search))
        {
            var search = criteria.Search.Trim();
            query = query.Where(request =>
                request.CodeOperationalRequest.Contains(search) ||
                request.Title.Contains(search) ||
                request.Description.Contains(search) ||
                request.RequestedByName.Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(request => request.CreatedAt)
            .ThenBy(request => request.CodeOperationalRequest)
            .Skip(criteria.Skip)
            .Take(criteria.Take)
            .ToArrayAsync(cancellationToken);

        return (items, totalCount);
    }

    public Task<OperationalRequest?> GetAsync(
        Guid idOrganization,
        Guid idOperationalRequest,
        CancellationToken cancellationToken) =>
        dbContext.Set<OperationalRequest>()
            .Include(request => request.Organization)
            .Include(request => request.Client)
            .Include(request => request.Service)
            .SingleOrDefaultAsync(
                request => request.IdOrganization == idOrganization &&
                    request.IdOperationalRequest == idOperationalRequest,
                cancellationToken);

    public Task<bool> IsCodeInUseAsync(
        Guid idOrganization,
        string codeOperationalRequest,
        Guid? excludedOperationalRequestId,
        CancellationToken cancellationToken) =>
        dbContext.Set<OperationalRequest>()
            .IgnoreQueryFilters()
            .AnyAsync(
                request => request.IdOrganization == idOrganization &&
                    request.CodeOperationalRequest == codeOperationalRequest &&
                    (!excludedOperationalRequestId.HasValue ||
                        request.IdOperationalRequest != excludedOperationalRequestId.Value),
                cancellationToken);

    public Task AddAsync(OperationalRequest request, CancellationToken cancellationToken) =>
        dbContext.Set<OperationalRequest>().AddAsync(request, cancellationToken).AsTask();
}
