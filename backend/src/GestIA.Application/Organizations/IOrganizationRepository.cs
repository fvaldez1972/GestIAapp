using GestIA.Domain.Organizations;

namespace GestIA.Application.Organizations;

public interface IOrganizationRepository
{
    Task<IReadOnlyList<Organization>> ListAsync(CancellationToken cancellationToken);
    Task<Organization?> GetAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<bool> IsCodeInUseAsync(string codeOrganization, CancellationToken cancellationToken);
    Task<bool> IsRfcInUseAsync(string rfc, CancellationToken cancellationToken);
    Task AddAsync(Organization organization, CancellationToken cancellationToken);
}
