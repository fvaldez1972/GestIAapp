using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public interface IClientRepository
{
    Task<(IReadOnlyList<ClientListItemResponse> Items, int TotalCount)> SearchAsync(
        ClientSearchCriteria criteria,
        CancellationToken cancellationToken);

    /// <summary>
    /// Los municipios donde la organización tiene sedes.
    ///
    /// <para>El filtro de municipio necesita opciones reales. Sacarlas de la página ya traída
    /// daría una lista distinta en cada página, que es la clase de filtro que miente.</para>
    /// </summary>
    Task<IReadOnlyList<string>> ListMunicipalitiesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>El número más alto ya usado en los códigos <c>CLI-NN</c> de la organización.</summary>
    Task<int> HighestClientCodeNumberAsync(
        Guid idOrganization,
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
