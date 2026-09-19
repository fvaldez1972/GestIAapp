using GestIA.Application.Workforce;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Documents;
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
        IReadOnlyCollection<Guid> requiredDocuments,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(criteria);
        ArgumentNullException.ThrowIfNull(requiredDocuments);

        // Guid? y no Guid para poder compararlo directo contra la columna, que es nulable mientras
        // queden documentos anteriores a la conversion del catalogo. Un documento sin identificador
        // no cubre ningun requisito, que es justo lo que hace un Contains sobre un nulo.
        var required = requiredDocuments.Distinct().Select(item => (Guid?)item).ToArray();
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
            required.Contains(document.IdDocumentCategoryCatalogItem) &&
            (document.Status == EmployeeDocumentStatus.Expired ||
                (document.ExpiresDate != null && document.ExpiresDate < criteria.Today)));

        query = criteria.DocumentFilter switch
        {
            EmployeeDocumentFilter.Expired => query.Where(employee =>
                dbContext.EmployeeDocuments.Any(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.IdDocumentCategoryCatalogItem) &&
                    (document.Status == EmployeeDocumentStatus.Expired ||
                        (document.ExpiresDate != null && document.ExpiresDate < criteria.Today)))),

            EmployeeDocumentFilter.Expiring => query.Where(employee =>
                dbContext.EmployeeDocuments.Any(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.IdDocumentCategoryCatalogItem) &&
                    document.Status != EmployeeDocumentStatus.Expired &&
                    document.ExpiresDate != null &&
                    document.ExpiresDate >= criteria.Today &&
                    document.ExpiresDate <= limite)),

            // «Sin cargar» es un requisito de la organización sin ningún documento de ese tipo.
            EmployeeDocumentFilter.Missing => query.Where(employee =>
                dbContext.EmployeeDocuments
                    .Where(document =>
                        document.IdEmployee == employee.IdEmployee &&
                        required.Contains(document.IdDocumentCategoryCatalogItem))
                    .Select(document => document.DocumentType)
                    .Distinct()
                    .Count() < required.Length),

            // «Al día» exige que cada requisito esté **cubierto**, no sólo que haya un archivo del
            // tipo: con la comprobación por presencia, alguien con la carta rechazada y vencimiento
            // en 2028 salía en este filtro mientras el servidor le negaba la asignación.
            EmployeeDocumentFilter.UpToDate => query.Where(employee =>
                dbContext.EmployeeDocuments
                    .Where(document =>
                        document.IdEmployee == employee.IdEmployee &&
                        required.Contains(document.IdDocumentCategoryCatalogItem) &&
                        (document.Status == EmployeeDocumentStatus.Received ||
                            document.Status == EmployeeDocumentStatus.Validated) &&
                        (document.ExpiresDate == null || document.ExpiresDate >= criteria.Today))
                    .Select(document => document.DocumentType)
                    .Distinct()
                    .Count() == required.Length &&
                !dbContext.EmployeeDocuments.Any(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.IdDocumentCategoryCatalogItem) &&
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

                // El nombre del puesto ya no sale de aqui: se resuelve despues, en una consulta
                // aparte. Ver `NombresDePuestoAsync`.

                Expired = dbContext.EmployeeDocuments.Count(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.IdDocumentCategoryCatalogItem) &&
                    (document.Status == EmployeeDocumentStatus.Expired ||
                        (document.ExpiresDate != null && document.ExpiresDate < criteria.Today))),

                Expiring = dbContext.EmployeeDocuments.Count(document =>
                    document.IdEmployee == employee.IdEmployee &&
                    required.Contains(document.IdDocumentCategoryCatalogItem) &&
                    document.Status != EmployeeDocumentStatus.Expired &&
                    document.ExpiresDate != null &&
                    document.ExpiresDate >= criteria.Today &&
                    document.ExpiresDate <= limite),

                // Con algún documento del tipo exigido, sea cual sea su estado. De aquí sale
                // «sin cargar», que es literalmente eso: no hay archivo.
                Covered = dbContext.EmployeeDocuments
                    .Where(document =>
                        document.IdEmployee == employee.IdEmployee &&
                        required.Contains(document.IdDocumentCategoryCatalogItem))
                    .Select(document => document.DocumentType)
                    .Distinct()
                    .Count(),

                // Requisitos con archivo que **no cuenta**: rechazado, pendiente de validar o no
                // aplicable, y sin estar vencido —lo vencido ya tiene su propia cuenta—. Es el
                // hueco que la tabla no veía: la ficha decía «Rechazado» y la píldora «Al día».
                //
                // El criterio de cubierto es el mismo que aplica el servidor al comprobar la
                // elegibilidad: `Received` o `Validated`, y vigente.
                NotValid = dbContext.EmployeeDocuments
                    .Where(document =>
                        document.IdEmployee == employee.IdEmployee &&
                        required.Contains(document.IdDocumentCategoryCatalogItem))
                    .Select(document => document.DocumentType)
                    .Distinct()
                    .Count(tipo =>
                        !dbContext.EmployeeDocuments.Any(document =>
                            document.IdEmployee == employee.IdEmployee &&
                            document.DocumentType == tipo &&
                            (document.Status == EmployeeDocumentStatus.Received ||
                                document.Status == EmployeeDocumentStatus.Validated) &&
                            (document.ExpiresDate == null || document.ExpiresDate >= criteria.Today)) &&
                        !dbContext.EmployeeDocuments.Any(document =>
                            document.IdEmployee == employee.IdEmployee &&
                            document.DocumentType == tipo &&
                            (document.Status == EmployeeDocumentStatus.Expired ||
                                (document.ExpiresDate != null && document.ExpiresDate < criteria.Today)))),

                // El expediente: los archivos que la persona tiene, no los tipos que se le exigen.
                //
                // El `Active` va escrito, y no se hereda: si esta consulta llegara a apagar el
                // filtro global, un documento archivado seguiria contando y la pestaña diria un
                // numero que la lista de abajo no respalda.
                Documents = dbContext.BusinessDocuments.Count(document =>
                    document.Active &&
                    document.OwnerType == BusinessDocumentOwnerType.Employee &&
                    document.OwnerId == employee.IdEmployee),

                Assignments = dbContext.ServiceAssignments.Count(assignment =>
                    assignment.IdEmployee == employee.IdEmployee &&
                    assignment.StartDate <= criteria.Today &&
                    (assignment.EndDate == null || assignment.EndDate >= criteria.Today)),
            })
            .ToArrayAsync(cancellationToken);

        var nombresDePuesto = await NombresDePuestoAsync(
            filas.Select(fila => fila.IdJobPositionCatalogItem).ToArray(),
            cancellationToken);

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
                fila.IdJobPositionCatalogItem is { } idPuesto && nombresDePuesto.TryGetValue(idPuesto, out var nombre)
                    ? nombre
                    : null,
                fila.JobTitle,
                fila.State,
                fila.Municipality,
                required.Length,
                fila.Expired,
                fila.Expiring,
                required.Length - fila.Covered,
                fila.NotValid,
                fila.Assignments,
                fila.Documents,
                Health(fila.Expired, fila.Expiring, required.Length - fila.Covered, fila.NotValid)))
            .ToArray();

        return (items, totalCount);
    }

    /// <summary>
    /// El peor manda. Un vencido pesa más que un hueco, y un hueco más que algo por caducar: los
    /// tres son problemas, pero el primero ya está bloqueando.
    /// </summary>
    /// <summary>
    /// Los nombres de los puestos, incluidos los desactivados.
    ///
    /// <para><b>Va en su propia consulta y no como subconsulta, y esa es toda la razón de que
    /// exista.</b> <c>IgnoreQueryFilters</c> no se aplica a la subconsulta donde se escribe: es un
    /// operador de <b>toda</b> la consulta. Puesto dentro de la proyección apagaba el filtro
    /// <c>Active</c> del listado entero, y los documentos dados de baja volvían a contarse como
    /// vigentes. Aquí el apagado queda confinado a leer nombres de catálogo.</para>
    ///
    /// <para>Se resuelven aunque el valor esté desactivado porque es historia: la persona tuvo ese
    /// puesto, y que el catálogo cambie después no borra el hecho. Antes el nombre llegaba nulo y
    /// la pantalla lo escribía como el texto «NULL».</para>
    ///
    /// <para>Sólo se apaga <c>Active</c>. El aislamiento por organización sigue puesto.</para>
    /// </summary>
    private async Task<Dictionary<Guid, string>> NombresDePuestoAsync(
        IReadOnlyCollection<Guid?> identificadores,
        CancellationToken cancellationToken)
    {
        var buscados = identificadores.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();

        if (buscados.Length == 0)
        {
            return [];
        }

        return await dbContext.BusinessCatalogItems
            .IgnoreQueryFilters(QueryFilterNames.ActiveOnly)
            .Where(item => buscados.Contains(item.IdBusinessCatalogItem))
            .Select(item => new { item.IdBusinessCatalogItem, item.Name })
            .ToDictionaryAsync(item => item.IdBusinessCatalogItem, item => item.Name, cancellationToken);
    }

    /// <summary>
    /// El peor manda, y «no cuenta» pesa más que «falta».
    ///
    /// <para>Un requisito con un documento rechazado está más cerca de bloquear que uno sin
    /// documento: el segundo se resuelve subiendo un archivo, el primero hay que revisarlo con
    /// quien lo rechazó.</para>
    /// </summary>
    private static EmployeeDocumentHealth Health(int expired, int expiring, int missing, int notValid) =>
        expired > 0 ? EmployeeDocumentHealth.Expired
        : notValid > 0 ? EmployeeDocumentHealth.NotValid
        : missing > 0 ? EmployeeDocumentHealth.Missing
        : expiring > 0 ? EmployeeDocumentHealth.Expiring
        : EmployeeDocumentHealth.UpToDate;

    /// <summary>
    /// Las categorias de documento que la organizacion exige, por identificador del catalogo.
    ///
    /// <para><b>Sale del identificador y ya no del enum.</b> Una regla creada despues de la
    /// conversion del 19 de septiembre de 2026 apunta a una fila del catalogo y puede no llevar
    /// enum —el suyo quiza no exista, porque la lista ya se puede ampliar—, asi que leer el enum
    /// habria dejado fuera del conteo justo a los requisitos nuevos.</para>
    /// </summary>
    public async Task<IReadOnlyList<Guid>> ListRequiredDocumentTypesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken) =>
        await dbContext.EligibilityRequirements
            .AsNoTracking()
            .Where(requirement =>
                requirement.IdOrganization == idOrganization &&
                requirement.RequirementType == EligibilityRequirementType.Document &&
                requirement.TargetType == EligibilityRequirementTargetType.Organization &&
                requirement.IdRequiredCatalogItem != null)
            .Select(requirement => requirement.IdRequiredCatalogItem!.Value)
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
