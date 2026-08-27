using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public interface IClientContactRepository
{
    Task<IReadOnlyList<ClientContact>> ListAsync(
        Guid idClient,
        CancellationToken cancellationToken);

    Task<ClientContact?> GetAsync(
        Guid idClient,
        Guid idClientContact,
        CancellationToken cancellationToken);

    Task AddAsync(ClientContact contact, CancellationToken cancellationToken);
}
