using GestIA.Application.Services;
using GestIA.Domain.Services;
using Microsoft.EntityFrameworkCore;
using ServiceEntity = GestIA.Domain.Services.Service;
using ServiceConfigurationEntity = GestIA.Domain.Services.ServiceConfiguration;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class ServiceManagementRepository(GestIaDbContext dbContext) : IServiceManagementRepository
{
    public async Task<IReadOnlyList<ServiceContract>> ListContractsAsync(
        Guid idClient,
        CancellationToken cancellationToken) =>
        await dbContext.ServiceContracts
            .AsNoTracking()
            .Where(contract => contract.IdClient == idClient)
            .OrderByDescending(contract => contract.EffectiveFromDate)
            .ThenBy(contract => contract.CodeServiceContract)
            .ToArrayAsync(cancellationToken);

    public Task<ServiceContract?> GetContractAsync(
        Guid idClient,
        Guid idServiceContract,
        CancellationToken cancellationToken) =>
        dbContext.ServiceContracts.SingleOrDefaultAsync(
            contract => contract.IdClient == idClient && contract.IdServiceContract == idServiceContract,
            cancellationToken);

    public Task<bool> IsContractCodeInUseAsync(
        Guid idClient,
        string codeServiceContract,
        Guid? excludedServiceContractId,
        CancellationToken cancellationToken) =>
        dbContext.ServiceContracts
            .IgnoreQueryFilters()
            .AnyAsync(
                contract =>
                    contract.IdClient == idClient &&
                    contract.CodeServiceContract == codeServiceContract &&
                    (!excludedServiceContractId.HasValue ||
                        contract.IdServiceContract != excludedServiceContractId.Value),
                cancellationToken);

    public Task AddContractAsync(ServiceContract contract, CancellationToken cancellationToken) =>
        dbContext.ServiceContracts.AddAsync(contract, cancellationToken).AsTask();

    public async Task<IReadOnlyList<ServiceEntity>> ListServicesAsync(
        Guid idClient,
        CancellationToken cancellationToken) =>
        await dbContext.Services
            .AsNoTracking()
            .Include(service => service.ClientSite)
            .Include(service => service.ServiceContract)
            .Where(service => service.IdClient == idClient)
            .OrderBy(service => service.Name)
            .ThenBy(service => service.CodeService)
            .ToArrayAsync(cancellationToken);

    public Task<ServiceEntity?> GetServiceAsync(
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken) =>
        dbContext.Services
            .Include(service => service.ClientSite)
            .Include(service => service.ServiceContract)
            .SingleOrDefaultAsync(
                service => service.IdClient == idClient && service.IdService == idService,
                cancellationToken);

    public Task<bool> IsServiceCodeInUseAsync(
        Guid idClient,
        string codeService,
        Guid? excludedServiceId,
        CancellationToken cancellationToken) =>
        dbContext.Services
            .IgnoreQueryFilters()
            .AnyAsync(
                service =>
                    service.IdClient == idClient &&
                    service.CodeService == codeService &&
                    (!excludedServiceId.HasValue || service.IdService != excludedServiceId.Value),
                cancellationToken);

    public Task AddServiceAsync(ServiceEntity service, CancellationToken cancellationToken) =>
        dbContext.Services.AddAsync(service, cancellationToken).AsTask();

    public async Task<IReadOnlyList<ServiceConfigurationEntity>> ListConfigurationsAsync(
        Guid idService,
        CancellationToken cancellationToken) =>
        await dbContext.ServiceConfigurations
            .AsNoTracking()
            .Where(configuration => configuration.IdService == idService)
            .OrderByDescending(configuration => configuration.EffectiveFromDate)
            .ToArrayAsync(cancellationToken);

    public Task<ServiceConfigurationEntity?> GetConfigurationAsync(
        Guid idService,
        Guid idServiceConfiguration,
        CancellationToken cancellationToken) =>
        dbContext.ServiceConfigurations.SingleOrDefaultAsync(
            configuration =>
                configuration.IdService == idService &&
                configuration.IdServiceConfiguration == idServiceConfiguration,
            cancellationToken);

    public Task<bool> IsConfigurationDateInUseAsync(
        Guid idService,
        DateOnly effectiveFromDate,
        Guid? excludedServiceConfigurationId,
        CancellationToken cancellationToken) =>
        dbContext.ServiceConfigurations
            .IgnoreQueryFilters()
            .AnyAsync(
                configuration =>
                    configuration.IdService == idService &&
                    configuration.EffectiveFromDate == effectiveFromDate &&
                    (!excludedServiceConfigurationId.HasValue ||
                        configuration.IdServiceConfiguration != excludedServiceConfigurationId.Value),
                cancellationToken);

    public Task AddConfigurationAsync(ServiceConfigurationEntity configuration, CancellationToken cancellationToken) =>
        dbContext.ServiceConfigurations.AddAsync(configuration, cancellationToken).AsTask();
}
