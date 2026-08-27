using GestIA.Application.Common;

namespace GestIA.Application.Clients;

public interface IClientService
{
    Task<PagedResult<ClientResponse>> ListAsync(
        ClientListQuery query,
        CancellationToken cancellationToken);

    Task<ClientResponse> GetAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);

    Task<ClientResponse> CreateAsync(
        CreateClientRequest request,
        CancellationToken cancellationToken);

    Task<ClientResponse> UpdateAsync(
        Guid idClient,
        UpdateClientRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);
}
