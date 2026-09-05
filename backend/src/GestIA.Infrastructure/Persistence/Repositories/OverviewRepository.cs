using GestIA.Application.Overview;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

/// <summary>
/// Los hechos que sostienen la pantalla de Inicio.
///
/// <para>Todo se cuenta en SQL. Traer las filas y contarlas en memoria haría de la portada la
/// pantalla más cara del producto, y es la que abre cada sesión.</para>
///
/// <para>El filtro global de organización ya está fijado por el guard; el
/// <c>IdOrganization</c> explícito de cada consulta es redundante a propósito, igual que en el
/// resto de los repositorios, para que la intención se lea en el archivo.</para>
/// </summary>
public sealed class OverviewRepository(GestIaDbContext dbContext) : IOverviewRepository
{
    public async Task<OverviewFacts> GetFactsAsync(
        Guid idOrganization,
        DateOnly operationDate,
        DateOnly previousOperationDate,
        DateOnly weekStartDate,
        DateOnly weekEndDate,
        DateOnly nextWeekStartDate,
        DateOnly nextWeekEndDate,
        CancellationToken cancellationToken)
    {
        var counts = await CountCatalogsAsync(idOrganization, cancellationToken);

        var clients = dbContext.Clients.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var sites = dbContext.ClientSites.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var contacts = dbContext.ClientContacts.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var services = dbContext.Services.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var positions = dbContext.Positions.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var employees = dbContext.Employees.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var assignments = dbContext.ServiceAssignments.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var versions = dbContext.ScheduleVersions.AsNoTracking().Where(item => item.IdOrganization == idOrganization);
        var shifts = dbContext.ScheduledShifts.AsNoTracking().Where(item => item.IdOrganization == idOrganization);

        var clientCount = await clients.CountAsync(cancellationToken);
        var siteCount = await sites.CountAsync(cancellationToken);
        var contactCount = await contacts.CountAsync(cancellationToken);

        var clientsWithoutContact = clients.Where(client =>
            !contacts.Any(contact => contact.IdClient == client.IdClient));
        var clientsWithoutContactCount = await clientsWithoutContact.CountAsync(cancellationToken);
        var clientWithoutContactName = await clientsWithoutContact
            .OrderBy(client => client.LegalName)
            .Select(client => client.TradeName ?? client.LegalName)
            .FirstOrDefaultAsync(cancellationToken);

        var serviceCount = await services.CountAsync(cancellationToken);
        var servicesWithConfiguration = await services
            .CountAsync(
                service => dbContext.ServiceConfigurations.Any(item => item.IdService == service.IdService),
                cancellationToken);
        var servicesWithoutPositions = await services
            .CountAsync(
                service => !positions.Any(position => position.IdService == service.IdService),
                cancellationToken);
        var firstServiceName = await services
            .OrderBy(service => service.Name)
            .Select(service => service.Name)
            .FirstOrDefaultAsync(cancellationToken);

        // Un patrón sin segmentos no proyecta nada, así que no cuenta como patrón.
        var positionsWithPattern = positions.Where(position =>
            dbContext.ShiftPatterns.Any(pattern =>
                pattern.IdPosition == position.IdPosition
                && dbContext.ShiftSegments.Any(segment => segment.IdShiftPattern == pattern.IdShiftPattern)));

        var positionCount = await positions.CountAsync(cancellationToken);
        var positionsWithPatternCount = await positionsWithPattern.CountAsync(cancellationToken);

        var activeEmployees = employees.Where(employee => employee.Status == EmployeeStatus.Active);
        var activeEmployeeCount = await activeEmployees.CountAsync(cancellationToken);

        // El expediente mínimo del paso 5 es puesto de catálogo más fecha de ingreso. La fecha no
        // es nula en el modelo, así que lo único que se comprueba es el puesto.
        var employeesWithFile = await activeEmployees
            .CountAsync(employee => employee.IdJobPositionCatalogItem != null, cancellationToken);

        var assignmentsInForce = assignments.Where(assignment =>
            assignment.StartDate <= operationDate
            && (assignment.EndDate == null || assignment.EndDate >= operationDate));

        var primaryAssignments = await assignmentsInForce
            .CountAsync(assignment => assignment.IsPrimary, cancellationToken);
        var reliefAssignments = await assignmentsInForce
            .CountAsync(assignment => assignment.AssignmentType == ServiceAssignmentType.Relief, cancellationToken);

        var publishedVersions = versions.Where(version => version.Status == ScheduleVersionStatus.Published);
        var publishedVersionCount = await publishedVersions.CountAsync(cancellationToken);

        var setupCounts = counts with
        {
            Clients = clientCount,
            ClientSites = siteCount,
            ClientContacts = contactCount,
            ClientsWithoutContact = clientsWithoutContactCount,
            Services = serviceCount,
            ServicesWithConfiguration = servicesWithConfiguration,
            ServicesWithoutPositions = servicesWithoutPositions,
            Positions = positionCount,
            PositionsWithPattern = positionsWithPatternCount,
            Employees = activeEmployeeCount,
            EmployeesWithFile = employeesWithFile,
            PrimaryAssignments = primaryAssignments,
            ReliefAssignments = reliefAssignments,
            PublishedVersions = publishedVersionCount,
        };

        // ── La semana operativa ──────────────────────────────────────────────────────────────
        var weekShifts = shifts.Where(shift =>
            shift.ShiftDate >= weekStartDate
            && shift.ShiftDate <= weekEndDate
            && shift.ScheduleVersion.Status == ScheduleVersionStatus.Published);

        var plannedShiftsInWeek = await weekShifts.CountAsync(cancellationToken);

        // Cuántos de los siete días tienen al menos un turno. Sin esto, una versión que cubre el
        // lunes hace que la semana entera parezca planeada.
        var plannedDaysInWeek = await weekShifts
            .Select(shift => shift.ShiftDate)
            .Distinct()
            .CountAsync(cancellationToken);
        var servicesPlannedInWeek = await weekShifts
            .Select(shift => shift.ScheduleVersion.IdService)
            .Distinct()
            .CountAsync(cancellationToken);
        var positionsPlannedInWeek = await weekShifts
            .Select(shift => shift.IdPosition)
            .Distinct()
            .CountAsync(cancellationToken);

        // «Hay planeación» es que exista una versión publicada que cubra la semana, no que tenga
        // turnos: una semana publicada y vacía es un cero real, no un dato que falta.
        var weekHasPublishedPlan = await publishedVersions.AnyAsync(
            version => version.PeriodStartDate <= weekEndDate && version.PeriodEndDate >= weekStartDate,
            cancellationToken);

        var nextWeekIsPublished = await publishedVersions.AnyAsync(
            version => version.PeriodStartDate <= nextWeekEndDate && version.PeriodEndDate >= nextWeekStartDate,
            cancellationToken);

        // ── El día anterior ──────────────────────────────────────────────────────────────────
        var previousDayHasPublishedPlan = await publishedVersions.AnyAsync(
            version => version.PeriodStartDate <= previousOperationDate
                && version.PeriodEndDate >= previousOperationDate,
            cancellationToken);

        var previousDayShiftQuery = shifts.Where(shift =>
            shift.ShiftDate == previousOperationDate
            && shift.ScheduleVersion.Status == ScheduleVersionStatus.Published);

        var previousDayShifts = await previousDayShiftQuery.CountAsync(cancellationToken);

        // Un turno queda al descubierto cuando hubo falta y ninguna cobertura la resolvió. Una
        // cobertura cancelada no cuenta: cancelarla es justamente dejar el turno sin cubrir.
        var uncoveredShifts = previousDayShiftQuery.Where(shift =>
            dbContext.AttendanceRecords.Any(record =>
                record.IdScheduledShift == shift.IdScheduledShift
                && record.Status == AttendanceStatus.Absent)
            && !dbContext.CoverageRecords.Any(coverage =>
                coverage.IdScheduledShift == shift.IdScheduledShift
                && (coverage.Status == CoverageStatus.Confirmed || coverage.Status == CoverageStatus.Completed)));

        var previousDayUncovered = await uncoveredShifts.CountAsync(cancellationToken);
        var previousDayUncoveredServices = await uncoveredShifts
            .Select(shift => shift.ScheduleVersion.IdService)
            .Distinct()
            .CountAsync(cancellationToken);

        var absencesWithoutIncident = dbContext.AttendanceRecords
            .AsNoTracking()
            .Where(record => record.IdOrganization == idOrganization
                && record.AttendanceDate == previousOperationDate
                && record.Status == AttendanceStatus.Absent
                && !dbContext.Incidents.Any(incident =>
                    incident.IdScheduledShift == record.IdScheduledShift));

        var previousDayAbsencesWithoutIncident = await absencesWithoutIncident.CountAsync(cancellationToken);
        var previousDayAbsenceServices = await absencesWithoutIncident
            .Select(record => record.ScheduledShift.ScheduleVersion.IdService)
            .Distinct()
            .CountAsync(cancellationToken);

        // ── Vacantes y patrones ──────────────────────────────────────────────────────────────
        var vacantPositions = positions.Where(position =>
            !assignments.Any(assignment =>
                assignment.IdPosition == position.IdPosition
                && assignment.IsPrimary
                && assignment.StartDate <= operationDate
                && (assignment.EndDate == null || assignment.EndDate >= operationDate)));

        var positionsWithoutPrimary = await vacantPositions.CountAsync(cancellationToken);
        var positionsWithoutPrimaryServices = await vacantPositions
            .Select(position => position.IdService)
            .Distinct()
            .CountAsync(cancellationToken);

        // Desde cuándo está vacante: el día siguiente al último titular que terminó. Una posición
        // que nunca tuvo titular no aporta fecha, y se dice sin fecha en lugar de inventar una.
        var vacantPositionIds = await vacantPositions
            .Select(position => position.IdPosition)
            .ToListAsync(cancellationToken);

        var lastPrimaryEnd = vacantPositionIds.Count == 0
            ? null
            : await assignments
                .Where(assignment => assignment.IsPrimary
                    && assignment.EndDate != null
                    && assignment.IdPosition != null
                    && vacantPositionIds.Contains(assignment.IdPosition.Value))
                .MinAsync(assignment => (DateOnly?)assignment.EndDate, cancellationToken);

        var positionsWithoutPattern = positions.Where(position =>
            !dbContext.ShiftPatterns.Any(pattern =>
                pattern.IdPosition == position.IdPosition
                && dbContext.ShiftSegments.Any(segment => segment.IdShiftPattern == pattern.IdShiftPattern)));

        var positionsWithoutPatternCount = await positionsWithoutPattern.CountAsync(cancellationToken);
        var positionsWithoutPatternServices = await positionsWithoutPattern
            .Select(position => position.IdService)
            .Distinct()
            .CountAsync(cancellationToken);

        // ── Documentos vencidos ──────────────────────────────────────────────────────────────
        // Dos formas de estar vencido: que alguien lo haya marcado, o que la fecha ya pasó. La
        // segunda no espera a que nadie revise nada, y es la que de verdad bloquea la asignación.
        var expiredDocuments = dbContext.EmployeeDocuments
            .AsNoTracking()
            .Where(document => document.IdOrganization == idOrganization
                && (document.Status == EmployeeDocumentStatus.Expired
                    || (document.ExpiresDate != null && document.ExpiresDate < operationDate))
                && document.Employee.Status == EmployeeStatus.Active);

        var employeesWithExpiredDocuments = await expiredDocuments
            .Select(document => document.IdEmployee)
            .Distinct()
            .CountAsync(cancellationToken);

        var oldestDocumentExpiry = await expiredDocuments
            .Where(document => document.ExpiresDate != null)
            .MinAsync(document => document.ExpiresDate, cancellationToken);

        return new OverviewFacts(
            setupCounts,
            clientWithoutContactName,
            firstServiceName,
            plannedShiftsInWeek,
            plannedDaysInWeek,
            servicesPlannedInWeek,
            positionsPlannedInWeek,
            weekHasPublishedPlan,
            previousDayHasPublishedPlan,
            previousDayShifts,
            previousDayUncovered,
            previousDayUncoveredServices,
            previousDayAbsencesWithoutIncident,
            previousDayAbsenceServices,
            positionsWithoutPrimary,
            positionsWithoutPrimaryServices,
            lastPrimaryEnd?.AddDays(1),
            positionsWithoutPatternCount,
            positionsWithoutPatternServices,
            activeEmployeeCount,
            employeesWithExpiredDocuments,
            oldestDocumentExpiry,
            nextWeekIsPublished);
    }

    /// <summary>
    /// Los cinco catálogos mínimos, en una sola agrupación.
    ///
    /// <para>Se piden los cinco juntos porque el paso 1 se cierra con los cinco: preguntarlos por
    /// separado serían cinco viajes para una sola respuesta.</para>
    /// </summary>
    private async Task<OverviewSetupCounts> CountCatalogsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var byType = await dbContext.BusinessCatalogItems
            .AsNoTracking()
            .Where(item => item.IdOrganization == idOrganization)
            .GroupBy(item => item.Type)
            .Select(group => new { Type = group.Key, Total = group.Count() })
            .ToListAsync(cancellationToken);

        int Total(BusinessCatalogItemType type) =>
            byType.FirstOrDefault(entry => entry.Type == type)?.Total ?? 0;

        return new OverviewSetupCounts(
            Total(BusinessCatalogItemType.JobPosition),
            Total(BusinessCatalogItemType.Skill),
            Total(BusinessCatalogItemType.Zone),
            Total(BusinessCatalogItemType.IncidentReason),
            Total(BusinessCatalogItemType.CoverageReason),
            0, 0, 0, 0,
            0, 0, 0,
            0, 0,
            0, 0,
            0, 0,
            0);
    }
}
