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

    /// <summary>
    /// El contacto principal activo del cliente, si lo hay y no es el que se está editando.
    ///
    /// <para>Devuelve la entidad y no un booleano porque el aviso nombra a quien ya tiene la marca:
    /// «ya hay un contacto principal» obliga a ir a buscar cuál, y son cuatro nombres en una lista
    /// que ya está en pantalla.</para>
    /// </summary>
    Task<ClientContact?> GetPrimaryAsync(
        Guid idClient,
        Guid? exceptIdClientContact,
        CancellationToken cancellationToken);

    Task AddAsync(ClientContact contact, CancellationToken cancellationToken);
}
