using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public interface IClientSiteRepository
{
    Task<IReadOnlyList<ClientSite>> ListAsync(
        Guid idClient,
        CancellationToken cancellationToken);

    Task<ClientSite?> GetAsync(
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken);

    Task<bool> ExistsAsync(
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken);

    Task<bool> IsCodeInUseAsync(
        Guid idClient,
        string codeClientSite,
        Guid? excludedClientSiteId,
        CancellationToken cancellationToken);

    Task AddAsync(ClientSite site, CancellationToken cancellationToken);
}
