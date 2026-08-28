using GestIA.Domain.Requests;

namespace GestIA.Application.Requests;

public interface IOperationalRequestRepository
{
    Task<(IReadOnlyList<OperationalRequest> Items, int TotalCount)> SearchAsync(
        OperationalRequestSearchCriteria criteria,
        CancellationToken cancellationToken);

    Task<OperationalRequest?> GetAsync(
        Guid idOrganization,
        Guid idOperationalRequest,
        CancellationToken cancellationToken);

    Task<bool> IsCodeInUseAsync(
        Guid idOrganization,
        string codeOperationalRequest,
        Guid? excludedOperationalRequestId,
        CancellationToken cancellationToken);

    Task AddAsync(OperationalRequest request, CancellationToken cancellationToken);
}
