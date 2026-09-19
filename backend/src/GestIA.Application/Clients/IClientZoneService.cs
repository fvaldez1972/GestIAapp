namespace GestIA.Application.Clients;

public interface IClientSiteService
{
    Task<IReadOnlyList<ClientSiteResponse>> ListAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);

    Task<ClientSiteResponse> CreateAsync(
        CreateClientSiteRequest request,
        CancellationToken cancellationToken);

    Task<ClientSiteResponse> UpdateAsync(
        Guid idClientSite,
        UpdateClientSiteRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken);
}
