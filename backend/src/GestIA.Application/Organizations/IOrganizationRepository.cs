using GestIA.Domain.Organizations;

namespace GestIA.Application.Organizations;

public interface IOrganizationRepository
{
    Task<IReadOnlyList<Organization>> ListAsync(CancellationToken cancellationToken);
    Task<Organization?> GetAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<Organization?> GetTrackedAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<bool> ExistsAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<bool> IsCodeInUseAsync(string codeOrganization, CancellationToken cancellationToken);

    /// <summary>
    /// El numero mas alto ya usado en los codigos con la forma <c>ORG-NN</c>.
    ///
    /// <para>Cuenta tambien las organizaciones inactivas: el codigo sigue ocupado aunque la
    /// organizacion este dada de baja, porque aqui los registros no se eliminan.</para>
    /// </summary>
    Task<int> HighestOrganizationCodeNumberAsync(CancellationToken cancellationToken);
    Task<bool> IsRfcInUseAsync(string rfc, CancellationToken cancellationToken);
    Task AddAsync(Organization organization, CancellationToken cancellationToken);
}
