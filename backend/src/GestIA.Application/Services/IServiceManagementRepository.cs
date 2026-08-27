using GestIA.Domain.Services;
using ServiceEntity = GestIA.Domain.Services.Service;
using ServiceConfigurationEntity = GestIA.Domain.Services.ServiceConfiguration;

namespace GestIA.Application.Services;

public interface IServiceManagementRepository
{
    Task<IReadOnlyList<ServiceContract>> ListContractsAsync(Guid idClient, CancellationToken cancellationToken);
    Task<ServiceContract?> GetContractAsync(Guid idClient, Guid idServiceContract, CancellationToken cancellationToken);
    Task<bool> IsContractCodeInUseAsync(Guid idClient, string codeServiceContract, Guid? excludedServiceContractId, CancellationToken cancellationToken);
    Task AddContractAsync(ServiceContract contract, CancellationToken cancellationToken);

    Task<IReadOnlyList<ServiceEntity>> ListServicesAsync(Guid idClient, CancellationToken cancellationToken);
    Task<ServiceEntity?> GetServiceAsync(Guid idClient, Guid idService, CancellationToken cancellationToken);
    Task<bool> IsServiceCodeInUseAsync(Guid idClient, string codeService, Guid? excludedServiceId, CancellationToken cancellationToken);
    Task AddServiceAsync(ServiceEntity service, CancellationToken cancellationToken);

    Task<IReadOnlyList<ServiceConfigurationEntity>> ListConfigurationsAsync(Guid idService, CancellationToken cancellationToken);
    Task<ServiceConfigurationEntity?> GetConfigurationAsync(Guid idService, Guid idServiceConfiguration, CancellationToken cancellationToken);
    Task<bool> IsConfigurationDateInUseAsync(Guid idService, DateOnly effectiveFromDate, Guid? excludedServiceConfigurationId, CancellationToken cancellationToken);
    Task AddConfigurationAsync(ServiceConfigurationEntity configuration, CancellationToken cancellationToken);
}
