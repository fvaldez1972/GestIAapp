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
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                contract =>
                    contract.IdClient == idClient &&
                    contract.CodeServiceContract == codeServiceContract &&
                    (!excludedServiceContractId.HasValue ||
                        contract.IdServiceContract != excludedServiceContractId.Value),
                cancellationToken);

    public Task AddContractAsync(ServiceContract contract, CancellationToken cancellationToken) =>
        dbContext.ServiceContracts.AddAsync(contract, cancellationToken).AsTask();

    /// <summary>
    /// Servicios de la organización, proyectados directamente a la respuesta.
    ///
    /// <para><b>No hay join a <c>Clients</c> para acotar por organización</b>: desde la tanda A
    /// <c>Service</c> guarda la suya, y el filtro global de la tanda B ya la aplica. El join al
    /// cliente que sí queda es sólo para traer su nombre.</para>
    ///
    /// <para><b>Sobre el filtro de estado.</b> Omitirlo devuelve sólo los activos, como el resto
    /// de las listas. Pedir los inactivos, o los dos juntos, exige apagar el borrado lógico —y
    /// sólo ése: el aislamiento entre organizaciones sigue en pie—. El listado de Servicios pinta
    /// activos, inactivos y vencidos en una sola tabla, y por eso existe <c>All</c>.</para>
    ///
    /// <para><b>Sobre la cobertura.</b> Los dos números agregados existen para que el hueco se vea
    /// desde el listado, sin abrir la ficha. Salen de dos subconsultas correlacionadas, no de
    /// catorce llamadas: la vacancia por posición ya existe aparte, y ésta es la misma definición
    /// sumada por servicio. Una asignación cuenta si empezó en o antes de la fecha y no había
    /// terminado; el día en que termina todavía cuenta.</para>
    /// </summary>
    public async Task<(IReadOnlyList<ServiceListItemResponse> Items, int TotalCount)> SearchServicesAsync(
        ServiceSearchCriteria criteria,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(criteria);

        var query = dbContext.Services.AsNoTracking();

        query = criteria.Status switch
        {
            ServiceStatusFilter.Inactive => query.IgnoreQueryFilters(["Active"]).Where(service => !service.Active),
            ServiceStatusFilter.All => query.IgnoreQueryFilters(["Active"]),
            _ => query,
        };

        if (criteria.IdClient is { } idClient)
        {
            query = query.Where(service => service.IdClient == idClient);
        }

        if (criteria.IdClientSite is { } idClientSite)
        {
            query = query.Where(service => service.IdClientSite == idClientSite);
        }

        if (criteria.IdServiceContract is { } idServiceContract)
        {
            query = query.Where(service => service.IdServiceContract == idServiceContract);
        }

        if (!string.IsNullOrWhiteSpace(criteria.Search))
        {
            var search = criteria.Search.Trim();
            query = query.Where(service =>
                service.CodeService.Contains(search) ||
                service.Name.Contains(search) ||
                service.Description.Contains(search) ||
                service.Client.LegalName.Contains(search) ||
                (service.Client.TradeName != null && service.Client.TradeName.Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(service => service.Name)
            .ThenBy(service => service.CodeService)
            .Skip(criteria.Skip)
            .Take(criteria.Take)
            .Select(service => new ServiceListItemResponse(
                service.IdService,
                service.IdClient,
                service.Client.TradeName ?? service.Client.LegalName,
                service.IdClientSite,
                service.ClientSite.Name,
                service.IdServiceContract,
                service.ServiceContract != null ? service.ServiceContract.CodeServiceContract : null,
                service.CodeService,
                service.Name,
                service.Description,
                service.InvoiceDescription,
                service.StartDate,
                service.EndDate,
                // Subconsulta correlacionada: una sola sentencia, sin materializar posiciones.
                // Cuenta las activas, porque Positions conserva aquí sus propios filtros.
                dbContext.Positions.Count(position => position.IdService == service.IdService),
                dbContext.Positions
                    .Where(position => position.IdService == service.IdService)
                    .Sum(position => (int?)position.RequiredWorkerCount) ?? 0,
                dbContext.Positions
                    .Where(position => position.IdService == service.IdService)
                    .Sum(position => (int?)dbContext.ServiceAssignments.Count(assignment =>
                        assignment.IdPosition == position.IdPosition &&
                        assignment.StartDate <= criteria.CoverageDate &&
                        (assignment.EndDate == null || assignment.EndDate >= criteria.CoverageDate))) ?? 0,
                criteria.CoverageDate,
                service.Active))
            .ToArrayAsync(cancellationToken);

        return (items, totalCount);
    }

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
            .IgnoreQueryFilters(["Active"])
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
            .IgnoreQueryFilters(["Active"])
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
