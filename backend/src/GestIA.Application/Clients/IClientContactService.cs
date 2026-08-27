namespace GestIA.Application.Clients;

public interface IClientContactService
{
    Task<IReadOnlyList<ClientContactResponse>> ListAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);

    Task<ClientContactResponse> CreateAsync(
        CreateClientContactRequest request,
        CancellationToken cancellationToken);

    Task<ClientContactResponse> UpdateAsync(
        Guid idClientContact,
        UpdateClientContactRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idClientContact,
        CancellationToken cancellationToken);
}
