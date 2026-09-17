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

    /// <summary>
    /// El cliente sin mirar si está activo.
    ///
    /// <para>Existe sólo para reactivar. <c>GetAsync</c> respeta el filtro global <c>Active</c>, así
    /// que un cliente desactivado no se encuentra por ahí —que es lo correcto para todo lo demás—
    /// y reactivarlo con él sería imposible por construcción.</para>
    /// </summary>
    Task<Client?> GetIncludingInactiveAsync(
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
