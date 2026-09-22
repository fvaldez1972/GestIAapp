namespace GestIA.Application.Clients;

public interface IClientZoneService
{
    Task<IReadOnlyList<ClientZoneResponse>> ListAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);

    Task<ClientZoneResponse> CreateAsync(
        CreateClientZoneRequest request,
        CancellationToken cancellationToken);

    Task<ClientZoneResponse> UpdateAsync(
        Guid idClientZone,
        UpdateClientZoneRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idClientZone,
        CancellationToken cancellationToken);
}
