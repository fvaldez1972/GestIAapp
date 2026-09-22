namespace GestIA.Application.Clients;

public interface IClientZoneService
{
    Task<IReadOnlyList<ClientZoneResponse>> ListAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);

    /// <summary>Todas las zonas de la organización, con su cliente. Para verlas juntas.</summary>
    Task<IReadOnlyList<OrganizationClientZoneResponse>> ListForOrganizationAsync(
        Guid idOrganization,
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
