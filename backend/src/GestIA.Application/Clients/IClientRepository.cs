using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public interface IClientRepository
{
    Task<(IReadOnlyList<Client> Items, int TotalCount)> SearchAsync(
        ClientSearchCriteria criteria,
        CancellationToken cancellationToken);

    Task<Client?> GetAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken);

    Task<bool> IsCodeInUseAsync(
        Guid idOrganization,
        string codeClient,
        Guid? excludedClientId,
        CancellationToken cancellationToken);

    Task<bool> IsRfcInUseAsync(
        Guid idOrganization,
        string rfc,
        Guid? excludedClientId,
        CancellationToken cancellationToken);

    Task AddAsync(Client client, CancellationToken cancellationToken);
}
