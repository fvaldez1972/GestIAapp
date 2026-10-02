using GestIA.Domain.Services;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Application.Services;

public interface IServiceManagementRepository
{
    Task<IReadOnlyList<ServiceContract>> ListContractsAsync(Guid idClient, CancellationToken cancellationToken);
    Task<ServiceContract?> GetContractAsync(Guid idClient, Guid idServiceContract, CancellationToken cancellationToken);
    Task<bool> IsContractCodeInUseAsync(Guid idClient, string codeServiceContract, Guid? excludedServiceContractId, CancellationToken cancellationToken);
    Task AddContractAsync(ServiceContract contract, CancellationToken cancellationToken);

    /// <summary>
    /// Servicios de una organización, con el nombre del cliente y el conteo de posiciones ya
    /// resueltos en la misma consulta. Devuelve la proyección y no la entidad porque materializar
    /// servicios para después contar posiciones una por una es lo que esta consulta evita.
    /// </summary>
    Task<(IReadOnlyList<ServiceListItemResponse> Items, int TotalCount)> SearchServicesAsync(
        ServiceSearchCriteria criteria,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ServiceEntity>> ListServicesAsync(Guid idClient, CancellationToken cancellationToken);
    Task<ServiceEntity?> GetServiceAsync(Guid idClient, Guid idService, CancellationToken cancellationToken);
    Task<bool> IsServiceCodeInUseAsync(Guid idClient, string codeService, Guid? excludedServiceId, CancellationToken cancellationToken);

    /// <summary>
    /// El numero mas alto ya usado en los codigos <c>SRV-NN</c> de ese cliente.
    ///
    /// <para>Cuenta tambien los servicios inactivos: el codigo sigue ocupado aunque el servicio
    /// este dado de baja, porque aqui los registros no se eliminan.</para>
    /// </summary>
    Task<int> HighestServiceCodeNumberAsync(Guid idClient, CancellationToken cancellationToken);
    Task AddServiceAsync(ServiceEntity service, CancellationToken cancellationToken);

}
