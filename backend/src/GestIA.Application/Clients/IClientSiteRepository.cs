using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public interface IClientSiteRepository
{
    Task<IReadOnlyList<ClientSite>> ListAsync(
        Guid idClient,
        CancellationToken cancellationToken);

    /// <summary>
    /// Todas las zonas de la organización, con el nombre de su cliente al lado.
    ///
    /// <para>Existe para poder verlas juntas. Hasta el 22 de septiembre de 2026 sólo se podían
    /// listar las de un cliente, así que para saber qué zonas hay en la organización había que
    /// entrar cliente por cliente —37 de ellos— y ninguna pantalla las enseñaba de corrido.</para>
    ///
    /// <para>Devuelve el nombre del cliente y no sólo su identificador porque una zona sin cliente
    /// no se puede leer: hay cinco nombres de zona repetidos entre clientes distintos, y sin el
    /// cliente al lado dos filas idénticas serían indistinguibles.</para>
    /// </summary>
    Task<IReadOnlyList<(ClientSite Zone, string ClientName)>> ListForOrganizationAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    Task<ClientSite?> GetAsync(
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken);

    Task<bool> ExistsAsync(
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken);

    Task<bool> IsCodeInUseAsync(
        Guid idClient,
        string codeClientSite,
        Guid? excludedClientSiteId,
        CancellationToken cancellationToken);

    Task AddAsync(ClientSite site, CancellationToken cancellationToken);
}
