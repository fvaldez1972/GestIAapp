using GestIA.Application.Common;

namespace GestIA.Application.Clients;

public interface IClientService
{
    Task<PagedResult<ClientListItemResponse>> ListAsync(
        ClientListQuery query,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<string>> ListMunicipalitiesAsync(
        Guid idOrganization,
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

    /// <summary>
    /// Vuelve a poner en activo un cliente desactivado.
    ///
    /// <para>El diálogo de desactivar promete que «se puede reactivar». Durante un tiempo esa
    /// promesa no tenía nada detrás: no existía ni endpoint ni caso de uso, así que desactivar un
    /// cliente era, en la práctica, definitivo.</para>
    /// </summary>
    Task<ClientResponse> ActivateAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);
}
