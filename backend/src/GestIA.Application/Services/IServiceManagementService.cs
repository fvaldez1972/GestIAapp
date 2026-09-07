using GestIA.Application.Common;

namespace GestIA.Application.Services;

public interface IServiceManagementService
{
    Task<IReadOnlyList<ServiceContractResponse>> ListContractsAsync(Guid idOrganization, Guid idClient, CancellationToken cancellationToken);
    Task<ServiceContractResponse> CreateContractAsync(CreateServiceContractRequest request, CancellationToken cancellationToken);
    Task<ServiceContractResponse> UpdateContractAsync(Guid idServiceContract, UpdateServiceContractRequest request, CancellationToken cancellationToken);
    Task DeactivateContractAsync(Guid idOrganization, Guid idClient, Guid idServiceContract, CancellationToken cancellationToken);

    /// <summary>
    /// Lista los servicios de una organización sin pasar por el cliente. El cliente, la sede y el
    /// contrato quedan como filtros opcionales.
    /// </summary>
    Task<PagedResult<ServiceListItemResponse>> SearchServicesAsync(ServiceListQuery query, CancellationToken cancellationToken);

    Task<IReadOnlyList<ServiceResponse>> ListServicesAsync(Guid idOrganization, Guid idClient, CancellationToken cancellationToken);
    Task<ServiceResponse> CreateServiceAsync(CreateServiceRequest request, CancellationToken cancellationToken);
    Task<ServiceResponse> UpdateServiceAsync(Guid idService, UpdateServiceRequest request, CancellationToken cancellationToken);
    Task DeactivateServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken);

    Task<IReadOnlyList<ServiceConfigurationResponse>> ListConfigurationsAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken);
    Task<ServiceConfigurationResponse> CreateConfigurationAsync(CreateServiceConfigurationRequest request, CancellationToken cancellationToken);
    Task<ServiceConfigurationResponse> UpdateConfigurationAsync(Guid idServiceConfiguration, UpdateServiceConfigurationRequest request, CancellationToken cancellationToken);
    Task DeactivateConfigurationAsync(Guid idOrganization, Guid idClient, Guid idService, Guid idServiceConfiguration, byte[] rowVersion, CancellationToken cancellationToken);
}
