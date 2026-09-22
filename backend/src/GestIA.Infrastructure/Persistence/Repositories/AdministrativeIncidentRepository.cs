using GestIA.Application.Workforce;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class AdministrativeIncidentRepository(GestIaDbContext dbContext) : IAdministrativeIncidentRepository
{
    public async Task<IReadOnlyList<AdministrativeIncident>> ListAsync(
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.AdministrativeIncidents
            .AsNoTracking()
            // El tipo viene resuelto porque la pantalla enseña su nombre y su marca de bloqueo, y
            // sin esto cada renglon costaria una consulta mas.
            .Include(incident => incident.IncidentTypeCatalogItem)
            // Las inactivas tambien: aqui los registros no se borran, y una incidencia retirada
            // sigue siendo parte del expediente. La pantalla decide como la ensena.
            .IgnoreQueryFilters(["Active"])
            .Where(incident => incident.IdEmployee == idEmployee)
            .OrderByDescending(incident => incident.OccurredDate)
            .ThenByDescending(incident => incident.CreatedAt)
            .ToArrayAsync(cancellationToken);

    public Task<AdministrativeIncident?> GetAsync(
        Guid idEmployee,
        Guid idAdministrativeIncident,
        CancellationToken cancellationToken) =>
        dbContext.AdministrativeIncidents
            .Include(incident => incident.IncidentTypeCatalogItem)
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(
                incident => incident.IdEmployee == idEmployee &&
                    incident.IdAdministrativeIncident == idAdministrativeIncident,
                cancellationToken);

    public Task AddAsync(AdministrativeIncident incident, CancellationToken cancellationToken) =>
        dbContext.AdministrativeIncidents.AddAsync(incident, cancellationToken).AsTask();

    public Task<BusinessCatalogItem?> GetIncidentTypeAsync(
        Guid idOrganization,
        Guid idCatalogItem,
        CancellationToken cancellationToken) =>
        dbContext.BusinessCatalogItems
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.IdOrganization == idOrganization &&
                    item.IdBusinessCatalogItem == idCatalogItem &&
                    item.Type == BusinessCatalogItemType.AdministrativeIncidentType &&
                    item.Active,
                cancellationToken);

    public Task<bool> EmployeeExistsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        dbContext.Employees.AnyAsync(
            employee => employee.IdOrganization == idOrganization && employee.IdEmployee == idEmployee,
            cancellationToken);
}
