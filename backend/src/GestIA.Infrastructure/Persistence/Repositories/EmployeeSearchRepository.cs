using GestIA.Application.Workforce;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Operations;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

/// <summary>
/// La parte del repositorio de personal que sostiene la pantalla: el listado con su resumen
/// documental, los filtros y las asignaciones por persona.
///
/// <para>Va en su propio archivo porque <c>WorkforceRepository</c> ya tenía el alta, la edición,
/// los documentos y las evaluaciones. Es la misma clase parcial, no un repositorio nuevo: el
/// contrato de la aplicación sigue siendo uno solo.</para>
/// </summary>
public sealed partial class WorkforceRepository
{
    /// <summary>
    /// El listado con lo que la tabla muestra, resuelto en una consulta.
    ///
    /// <para>Los requisitos documentales llegan ya traducidos a tipos del enum. Se pasan como
    /// parámetro y no se leen aquí porque son los mismos para todas las filas: leerlos por fila
    /// sería una consulta por empleado para un dato de la organización.</para>
    /// </summary>
    public async Task<(IReadOnlyList<EmployeeListItemResponse> Items, int TotalCount)> SearchEmployeesAsync(
        EmployeeSearchCriteria criteria,
        IReadOnlyCollection<EmployeeDocumentType> requiredDocuments,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(criteria);
        ArgumentNullException.ThrowIfNull(requiredDocuments);

        var required = requiredDocuments.Distinct().ToArray();
        var limite = criteria.Today.AddDays(criteria.ExpiringWithinDays);

        var query = dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.IdOrganization == criteria.IdOrganization);

        if (criteria.Status is { } status)
        {
            query = query.Where(employee => employee.Status == status);
        }

        if (criteria.IdJobPositionCatalogItem is { } idJobPosition)
        {
            query = query.Where(employee => employee.IdJobPositionCatalogItem == idJobPosition);
        }

        if (!string.IsNullOrWhiteSpace(criteria.Municipality))
        {
            var municipality = criteria.Municipality.Trim();
            query = query.Where(employee => employee.Municipality == municipality);
        }

        if (!string.IsNullOrWhiteSpace(criteria.Search))
        {
            var search = criteria.Search.Trim();
            query = query.Where(employee =>
                employee.CodeEmployee.Contains(search) ||
                employee.FullName.Contains(search) ||
                (employee.Curp != null && employee.Curp.Contains(search)) ||
                (employee.JobTitle != null && employee.JobTitle.Contains(search)) ||
                dbContext.BusinessCatalogItems.Any(item =>
                    item.IdBusinessCatalogItem == employee.IdJobPositionCatalogItem &&
                    item.Name.Contains(search)));
        }

        // Las tres cuentas que deciden la píldora. Un documento vencido lo está por su fecha o
        // porque alguien lo marcó: esperar a que alguien revise el expediente es esperar a que el
        // bloqueo aparezca al asignar.
        var vencidos = (Employee employee) => dbContext.EmployeeDocuments.Count(document =>
            document.IdEmployee == employee.IdEmployee &&
            required.Contains(document.DocumentType) &&
            (document.Status == EmployeeDocumentStatus.Expired ||
                (document.ExpiresDate != null && document.ExpiresDate < criteria.Today)));

        query = criteria.DocumentFilter switch
        {
            EmployeeDocumentFilter.Expired => query.Where(employee =>
                dbContext.EmployeeDocuments.Any(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.DocumentType) &&
                    (document.Status == EmployeeDocumentStatus.Expired ||
                        (document.ExpiresDate != null && document.ExpiresDate < criteria.Today)))),

            EmployeeDocumentFilter.Expiring => query.Where(employee =>
                dbContext.EmployeeDocuments.Any(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.DocumentType) &&
                    document.Status != EmployeeDocumentStatus.Expired &&
                    document.ExpiresDate != null &&
                    document.ExpiresDate >= criteria.Today &&
                    document.ExpiresDate <= limite)),

            // «Sin cargar» es un requisito de la organización sin ningún documento de ese tipo.
            EmployeeDocumentFilter.Missing => query.Where(employee =>
                dbContext.EmployeeDocuments
                    .Where(document =>
                        document.IdEmployee == employee.IdEmployee &&
                        required.Contains(document.DocumentType))
                    .Select(document => document.DocumentType)
                    .Distinct()
                    .Count() < required.Length),

            EmployeeDocumentFilter.UpToDate => query.Where(employee =>
                dbContext.EmployeeDocuments
                    .Where(document =>
                        document.IdEmployee == employee.IdEmployee &&
                        required.Contains(document.DocumentType))
                    .Select(document => document.DocumentType)
                    .Distinct()
                    .Count() == required.Length &&
                !dbContext.EmployeeDocuments.Any(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.DocumentType) &&
                    (document.Status == EmployeeDocumentStatus.Expired ||
                        (document.ExpiresDate != null && document.ExpiresDate <= limite)))),

            _ => query,
        };

        var totalCount = await query.CountAsync(cancellationToken);

        var filas = await query
            .OrderBy(employee => employee.FullName)
            .ThenBy(employee => employee.CodeEmployee)
            .Skip(criteria.Skip)
            .Take(criteria.Take)
            .Select(employee => new
            {
                employee.IdEmployee,
                employee.IdOrganization,
                employee.CodeEmployee,
                employee.FullName,
                employee.Status,
                employee.HireDate,
                employee.Curp,
                employee.IdJobPositionCatalogItem,
                employee.JobTitle,
                employee.State,
                employee.Municipality,

                JobPositionName = dbContext.BusinessCatalogItems
                    .Where(item => item.IdBusinessCatalogItem == employee.IdJobPositionCatalogItem)
                    .Select(item => item.Name)
                    .FirstOrDefault(),

                Expired = dbContext.EmployeeDocuments.Count(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.DocumentType) &&
                    (document.Status == EmployeeDocumentStatus.Expired ||
                        (document.ExpiresDate != null && document.ExpiresDate < criteria.Today))),

                Expiring = dbContext.EmployeeDocuments.Count(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.DocumentType) &&
                    document.Status != EmployeeDocumentStatus.Expired &&
                    document.ExpiresDate != null &&
                    document.ExpiresDate >= criteria.Today &&
                    document.ExpiresDate <= limite),

                Covered = dbContext.EmployeeDocuments
                    .Where(document =>
                        document.IdEmployee == employee.IdEmployee &&
                        required.Contains(document.DocumentType))
                    .Select(document => document.DocumentType)
                    .Distinct()
                    .Count(),

                Assignments = dbContext.ServiceAssignments.Count(assignment =>
                    assignment.IdEmployee == employee.IdEmployee &&
                    assignment.StartDate <= criteria.Today &&
                    (assignment.EndDate == null || assignment.EndDate >= criteria.Today)),
            })
            .ToArrayAsync(cancellationToken);

        var items = filas
            .Select(fila => new EmployeeListItemResponse(
                fila.IdEmployee,
                fila.IdOrganization,
                fila.CodeEmployee,
                fila.FullName,
                fila.Status,
                fila.HireDate,
                fila.Curp,
                fila.IdJobPositionCatalogItem,
                fila.JobPositionName,
                fila.JobTitle,
                fila.State,
                fila.Municipality,
                required.Length,
                fila.Expired,
                fila.Expiring,
                required.Length - fila.Covered,
                fila.Assignments,
                Health(fila.Expired, fila.Expiring, required.Length - fila.Covered)))
            .ToArray();

        return (items, totalCount);
    }

    /// <summary>
    /// El peor manda. Un vencido pesa más que un hueco, y un hueco más que algo por caducar: los
    /// tres son problemas, pero el primero ya está bloqueando.
    /// </summary>
    private static EmployeeDocumentHealth Health(int expired, int expiring, int missing) =>
        expired > 0 ? EmployeeDocumentHealth.Expired
        : missing > 0 ? EmployeeDocumentHealth.Missing
        : expiring > 0 ? EmployeeDocumentHealth.Expiring
        : EmployeeDocumentHealth.UpToDate;

    public async Task<IReadOnlyList<string>> ListRequiredDocumentCodesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken) =>
        await dbContext.EligibilityRequirements
            .AsNoTracking()
            .Where(requirement =>
                requirement.IdOrganization == idOrganization &&
                requirement.RequirementType == EligibilityRequirementType.Document &&
                requirement.TargetType == EligibilityRequirementTargetType.Organization)
            .Select(requirement => requirement.RequiredCode)
            .Distinct()
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<(Guid Id, string Name)>> ListUsedJobPositionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var filas = await dbContext.BusinessCatalogItems
            .AsNoTracking()
            .Where(item =>
                item.IdOrganization == idOrganization &&
                item.Type == BusinessCatalogItemType.JobPosition &&
                dbContext.Employees.Any(employee =>
                    employee.IdJobPositionCatalogItem == item.IdBusinessCatalogItem))
            .OrderBy(item => item.Name)
            .Select(item => new { item.IdBusinessCatalogItem, item.Name })
            .ToArrayAsync(cancellationToken);

        return filas.Select(fila => (fila.IdBusinessCatalogItem, fila.Name)).ToArray();
    }

    public async Task<IReadOnlyList<string>> ListEmployeeMunicipalitiesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken) =>
        await dbContext.Employees
            .AsNoTracking()
            .Where(employee =>
                employee.IdOrganization == idOrganization &&
                employee.Municipality != null &&
                employee.Municipality != "")
            .Select(employee => employee.Municipality!)
            .Distinct()
            .OrderBy(municipality => municipality)
            .ToArrayAsync(cancellationToken);

    /// <summary>
    /// Las asignaciones de una persona, con el turno en curso marcado.
    ///
    /// <para>«En curso» se deriva de que exista asistencia con entrada y sin salida, hoy o ayer.
    /// Se mira también el día anterior porque un turno nocturno empieza un día y termina al
    /// siguiente, y mirando sólo hoy se leería como si nadie hubiera llegado.</para>
    /// </summary>
    public async Task<IReadOnlyList<EmployeeAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly today,
        CancellationToken cancellationToken)
    {
        var ayer = today.AddDays(-1);

        var filas = await dbContext.ServiceAssignments
            .AsNoTracking()
            .Where(assignment =>
                assignment.IdOrganization == idOrganization &&
                assignment.IdEmployee == idEmployee)
            .OrderByDescending(assignment => assignment.StartDate)
            .Select(assignment => new
            {
                assignment.IdServiceAssignment,
                assignment.IdService,
                ServiceName = assignment.Service.Name,
                ClientName = assignment.Service.Client.TradeName ?? assignment.Service.Client.LegalName,
                assignment.IdPosition,
                PositionName = dbContext.Positions
                    .Where(position => position.IdPosition == assignment.IdPosition)
                    .Select(position => position.Name)
                    .FirstOrDefault(),
                assignment.AssignmentType,
                assignment.IsPrimary,
                assignment.StartDate,
                assignment.EndDate,

                ShiftInProgress = dbContext.AttendanceRecords
                    .Where(record =>
                        record.IdEmployee == idEmployee &&
                        (record.AttendanceDate == today || record.AttendanceDate == ayer) &&
                        record.ActualStartTime != null &&
                        record.ActualEndTime == null &&
                        record.ScheduledShift.ScheduleVersion.IdService == assignment.IdService)
                    .Select(record => (DateOnly?)record.AttendanceDate)
                    .FirstOrDefault(),
            })
            .ToArrayAsync(cancellationToken);

        return filas
            .Select(fila => new EmployeeAssignmentResponse(
                fila.IdServiceAssignment,
                fila.IdService,
                fila.ServiceName,
                fila.ClientName,
                fila.IdPosition,
                fila.PositionName,
                fila.AssignmentType,
                fila.IsPrimary,
                fila.StartDate,
                fila.EndDate,
                fila.StartDate <= today && (fila.EndDate == null || fila.EndDate >= today),
                fila.ShiftInProgress is not null,
                fila.ShiftInProgress))
            .ToArray();
    }
}
