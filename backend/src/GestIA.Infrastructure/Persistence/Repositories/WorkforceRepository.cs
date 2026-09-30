using GestIA.Application.Workforce;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed partial class WorkforceRepository(GestIaDbContext dbContext) : IWorkforceRepository
{
    public async Task<EmployeeListResult> ListEmployeesAsync(
        EmployeeQuery query,
        CancellationToken cancellationToken)
    {
        var employees = dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.IdOrganization == query.IdOrganization);

        if (query.Status.HasValue)
        {
            employees = employees.Where(employee => employee.Status == query.Status.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            employees = employees.Where(employee =>
                employee.CodeEmployee.Contains(search) ||
                employee.FullName.Contains(search) ||
                (employee.Rfc != null && employee.Rfc.Contains(search)) ||
                (employee.Curp != null && employee.Curp.Contains(search)) ||
                (employee.SocialSecurityNumber != null && employee.SocialSecurityNumber.Contains(search)));
        }

        var totalCount = await employees.CountAsync(cancellationToken);
        var items = await employees
            .OrderBy(employee => employee.FullName)
            .ThenBy(employee => employee.CodeEmployee)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToArrayAsync(cancellationToken);

        return new EmployeeListResult(items.Select(Map).ToArray(), totalCount, query.Page, query.PageSize);
    }

    public Task<Employee?> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        dbContext.Employees.SingleOrDefaultAsync(
            employee => employee.IdOrganization == idOrganization && employee.IdEmployee == idEmployee,
            cancellationToken);

    /// <summary>
    /// El expediente con sus periodos laborales cargados, para las operaciones que los gobiernan.
    ///
    /// <para>No es <c>AsNoTracking</c>: ingreso, baja y reingreso escriben.</para>
    /// </summary>
    public Task<Employee?> GetEmployeeWithPeriodsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        dbContext.Employees
            .Include(employee => employee.EmploymentPeriods)
            .Include(employee => employee.PsychometricTests)
            .SingleOrDefaultAsync(
                employee => employee.IdOrganization == idOrganization && employee.IdEmployee == idEmployee,
                cancellationToken);

    /// <summary>
    /// El historial laboral, del más reciente al más antiguo: así se lee una ficha.
    /// </summary>
    public async Task<IReadOnlyList<EmploymentPeriodResponse>> ListEmploymentPeriodsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmploymentPeriods
            .AsNoTracking()
            .Where(periodo => periodo.IdOrganization == idOrganization && periodo.IdEmployee == idEmployee)
            .OrderByDescending(periodo => periodo.StartDate)
            .Select(periodo => new EmploymentPeriodResponse(
                periodo.IdEmploymentPeriod,
                periodo.IdEmployee,
                periodo.StartDate,
                periodo.EndDate,
                periodo.TerminationReason,
                periodo.EndDate == null,
                periodo.Active,
                periodo.CreatedAt,
                periodo.CreatedByName,
                periodo.UpdatedAt,
                periodo.UpdatedByName))
            .ToArrayAsync(cancellationToken);

    /// <summary>
    /// Las asignaciones que siguen vigentes a la fecha de la baja.
    ///
    /// <para>Vigente es activa y sin fin, o con fin posterior a esa fecha. Una que ya terminó no se
    /// toca: adelantarle el fin sería reescribir un hecho.</para>
    /// </summary>
    public async Task<IReadOnlyList<ServiceAssignment>> ListOpenAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly onDate,
        CancellationToken cancellationToken) =>
        await dbContext.ServiceAssignments
            .Where(asignacion =>
                asignacion.IdOrganization == idOrganization &&
                asignacion.IdEmployee == idEmployee &&
                asignacion.Active &&
                (asignacion.EndDate == null || asignacion.EndDate > onDate))
            .ToArrayAsync(cancellationToken);

    /// <summary>
    /// Los turnos ya proyectados que quedan a nombre de la persona desde la fecha de la baja.
    ///
    /// <para>Se cuentan, no se borran: una versión publicada de la planeación es inmutable.</para>
    /// </summary>
    public async Task<IReadOnlyList<PsychometricTestResponse>> ListPsychometricTestsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeePsychometricTests
            .AsNoTracking()
            .Where(prueba => prueba.IdOrganization == idOrganization && prueba.IdEmployee == idEmployee)
            .OrderByDescending(prueba => prueba.ApprovedDate)
            .Select(prueba => new PsychometricTestResponse(
                prueba.IdEmployeePsychometricTest,
                prueba.IdEmployee,
                prueba.ApprovedDate,
                prueba.ExpiredOnDate,
                prueba.ExpiredOnDate == null,
                prueba.CreatedAt,
                prueba.CreatedByName))
            .ToArrayAsync(cancellationToken);

    /// <summary>
    /// Lo que cada baja dejo vencido, agrupado por la fecha de esa baja.
    ///
    /// <para>Los documentos y las evaluaciones se reconocen por tener vigencia original guardada y
    /// vencimiento igual a la fecha de la baja: es exactamente lo que el corte les hizo.</para>
    /// </summary>
    public async Task<IReadOnlyList<TerminationExpirationGroup>> ListTerminationExpirationsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        var bajas = await dbContext.EmploymentPeriods
            .AsNoTracking()
            .Where(periodo =>
                periodo.IdOrganization == idOrganization &&
                periodo.IdEmployee == idEmployee &&
                periodo.EndDate != null)
            .OrderByDescending(periodo => periodo.EndDate)
            .Select(periodo => new { periodo.EndDate, periodo.TerminationReason })
            .ToArrayAsync(cancellationToken);

        if (bajas.Length == 0)
        {
            return [];
        }

        var documentos = await dbContext.EmployeeDocuments
            .AsNoTracking()
            .Where(documento =>
                documento.IdOrganization == idOrganization &&
                documento.IdEmployee == idEmployee &&
                documento.OriginalExpiresDate != null)
            .Select(documento => new
            {
                documento.IdEmployeeDocument,
                Nombre = documento.DocumentCategoryCatalogItem != null
                    ? documento.DocumentCategoryCatalogItem.Name
                    : documento.DocumentType.ToString(),
                documento.ExpiresDate,
                documento.OriginalExpiresDate,
            })
            .ToArrayAsync(cancellationToken);

        var evaluaciones = await dbContext.EmployeeEvaluations
            .AsNoTracking()
            .Where(evaluacion =>
                evaluacion.IdOrganization == idOrganization &&
                evaluacion.IdEmployee == idEmployee &&
                evaluacion.OriginalExpiresDate != null)
            .Select(evaluacion => new
            {
                evaluacion.IdEmployeeEvaluation,
                Nombre = evaluacion.EvaluationCategoryCatalogItem != null
                    ? evaluacion.EvaluationCategoryCatalogItem.Name
                    : evaluacion.EvaluationType.ToString(),
                evaluacion.ExpiresDate,
                evaluacion.OriginalExpiresDate,
            })
            .ToArrayAsync(cancellationToken);

        var pruebas = await dbContext.EmployeePsychometricTests
            .AsNoTracking()
            .Where(prueba =>
                prueba.IdOrganization == idOrganization &&
                prueba.IdEmployee == idEmployee &&
                prueba.ExpiredOnDate != null)
            .Select(prueba => new { prueba.ExpiredOnDate, prueba.ApprovedDate })
            .ToArrayAsync(cancellationToken);

        return bajas
            .Select(baja =>
            {
                var prueba = pruebas.FirstOrDefault(item => item.ExpiredOnDate == baja.EndDate);

                return new TerminationExpirationGroup(
                    baja.EndDate!.Value,
                    baja.TerminationReason,
                    documentos
                        .Where(documento => documento.ExpiresDate == baja.EndDate)
                        .Select(documento => new TerminationExpirationItem(
                            documento.IdEmployeeDocument, documento.Nombre, documento.OriginalExpiresDate))
                        .ToArray(),
                    evaluaciones
                        .Where(evaluacion => evaluacion.ExpiresDate == baja.EndDate)
                        .Select(evaluacion => new TerminationExpirationItem(
                            evaluacion.IdEmployeeEvaluation, evaluacion.Nombre, evaluacion.OriginalExpiresDate))
                        .ToArray(),
                    prueba is not null,
                    prueba?.ApprovedDate);
            })
            .ToArray();
    }

    public async Task<IReadOnlyList<EmployeeDocument>> ListDocumentsExpiringOnTerminationAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeDocuments
            .Where(documento =>
                documento.IdOrganization == idOrganization &&
                documento.IdEmployee == idEmployee &&
                documento.Active &&
                documento.IdDocumentCategoryCatalogItem != null &&
                dbContext.BusinessCatalogItems.Any(tipo =>
                    tipo.IdBusinessCatalogItem == documento.IdDocumentCategoryCatalogItem &&
                    tipo.IsExpiredOnTermination == true))
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<EmployeeEvaluation>> ListEvaluationsExpiringOnTerminationAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeEvaluations
            .Where(evaluacion =>
                evaluacion.IdOrganization == idOrganization &&
                evaluacion.IdEmployee == idEmployee &&
                evaluacion.Active &&
                evaluacion.IdEvaluationCategoryCatalogItem != null &&
                dbContext.BusinessCatalogItems.Any(tipo =>
                    tipo.IdBusinessCatalogItem == evaluacion.IdEvaluationCategoryCatalogItem &&
                    tipo.IsExpiredOnTermination == true))
            .ToArrayAsync(cancellationToken);

    public async Task<(int Count, DateOnly? FirstDate, DateOnly? LastDate)> CountFutureShiftsAsync(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly fromDate,
        CancellationToken cancellationToken)
    {
        var turnos = dbContext.ScheduledShifts
            .AsNoTracking()
            .Where(turno =>
                turno.IdOrganization == idOrganization &&
                turno.IdEmployee == idEmployee &&
                turno.ShiftDate > fromDate);

        var total = await turnos.CountAsync(cancellationToken);

        if (total == 0)
        {
            return (0, null, null);
        }

        return (
            total,
            await turnos.MinAsync(turno => (DateOnly?)turno.ShiftDate, cancellationToken),
            await turnos.MaxAsync(turno => (DateOnly?)turno.ShiftDate, cancellationToken));
    }

    public Task<bool> OrganizationExistsAsync(Guid idOrganization, CancellationToken cancellationToken) =>
        dbContext.Organizations.AnyAsync(
            organization => organization.IdOrganization == idOrganization,
            cancellationToken);

    public Task<bool> IsEmployeeCodeInUseAsync(
        Guid idOrganization,
        string codeEmployee,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken) =>
        dbContext.Employees
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                employee =>
                    employee.IdOrganization == idOrganization &&
                    employee.CodeEmployee == codeEmployee &&
                    (!excludedEmployeeId.HasValue || employee.IdEmployee != excludedEmployeeId.Value),
                cancellationToken);

    public Task<bool> IsRfcInUseAsync(
        Guid idOrganization,
        string rfc,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken) =>
        dbContext.Employees
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                employee =>
                    employee.IdOrganization == idOrganization &&
                    employee.Rfc == rfc &&
                    (!excludedEmployeeId.HasValue || employee.IdEmployee != excludedEmployeeId.Value),
                cancellationToken);

    public Task<bool> IsCurpInUseAsync(
        Guid idOrganization,
        string curp,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken) =>
        dbContext.Employees
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                employee =>
                    employee.IdOrganization == idOrganization &&
                    employee.Curp == curp &&
                    (!excludedEmployeeId.HasValue || employee.IdEmployee != excludedEmployeeId.Value),
                cancellationToken);

    public Task<bool> IsSocialSecurityNumberInUseAsync(
        Guid idOrganization,
        string socialSecurityNumber,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken) =>
        dbContext.Employees
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                employee =>
                    employee.IdOrganization == idOrganization &&
                    employee.SocialSecurityNumber == socialSecurityNumber &&
                    (!excludedEmployeeId.HasValue || employee.IdEmployee != excludedEmployeeId.Value),
                cancellationToken);

    public Task AddEmployeeAsync(Employee employee, CancellationToken cancellationToken) =>
        dbContext.Employees.AddAsync(employee, cancellationToken).AsTask();

    public async Task<IReadOnlyList<EmployeeDocument>> ListDocumentsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeDocuments
            .AsNoTracking()
            .Where(document => document.IdEmployee == idEmployee)
            .OrderBy(document => document.DocumentType)
            .ThenByDescending(document => document.ReceivedDate)
            .ToArrayAsync(cancellationToken);

    public Task<EmployeeDocument?> GetDocumentAsync(
        Guid idEmployee,
        Guid idEmployeeDocument,
        CancellationToken cancellationToken) =>
        dbContext.EmployeeDocuments.SingleOrDefaultAsync(
            document => document.IdEmployee == idEmployee && document.IdEmployeeDocument == idEmployeeDocument,
            cancellationToken);

    public Task AddDocumentAsync(EmployeeDocument document, CancellationToken cancellationToken) =>
        dbContext.EmployeeDocuments.AddAsync(document, cancellationToken).AsTask();

    public async Task<IReadOnlyList<EmployeeEvaluation>> ListEvaluationsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeEvaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.IdEmployee == idEmployee)
            .OrderByDescending(evaluation => evaluation.EvaluatedDate)
            .ThenBy(evaluation => evaluation.EvaluationType)
            .ToArrayAsync(cancellationToken);

    public Task<EmployeeEvaluation?> GetEvaluationAsync(
        Guid idEmployee,
        Guid idEmployeeEvaluation,
        CancellationToken cancellationToken) =>
        dbContext.EmployeeEvaluations.SingleOrDefaultAsync(
            evaluation =>
                evaluation.IdEmployee == idEmployee &&
                evaluation.IdEmployeeEvaluation == idEmployeeEvaluation,
            cancellationToken);

    /// <summary>
    /// Si ya hay una evaluación <b>de ese tipo</b> en esa fecha para esa persona.
    ///
    /// <para><b>El tipo es la categoría del catálogo cuando la hay</b>, no el enum heredado. La
    /// pantalla manda <c>Other</c> en el enum desde que el tipo se elige del catálogo, así que
    /// comparar por el enum hacía chocar entre sí a evaluaciones de tipos distintos: registrada una,
    /// cualquier otra del mismo día se rechazaba con «ya existe una evaluación del mismo tipo».</para>
    ///
    /// <para>Sin categoría —los registros anteriores a la conversión del catálogo— se compara por el
    /// enum, que es lo único que esos tienen.</para>
    /// </summary>
    public Task<bool> IsEvaluationInUseAsync(
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        Guid? idEvaluationCategoryCatalogItem,
        DateOnly evaluatedDate,
        Guid? excludedEmployeeEvaluationId,
        CancellationToken cancellationToken) =>
        dbContext.EmployeeEvaluations
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                evaluation =>
                    evaluation.IdEmployee == idEmployee &&
                    (idEvaluationCategoryCatalogItem.HasValue
                        ? evaluation.IdEvaluationCategoryCatalogItem == idEvaluationCategoryCatalogItem
                        : evaluation.IdEvaluationCategoryCatalogItem == null &&
                            evaluation.EvaluationType == evaluationType) &&
                    evaluation.EvaluatedDate == evaluatedDate &&
                    (!excludedEmployeeEvaluationId.HasValue ||
                        evaluation.IdEmployeeEvaluation != excludedEmployeeEvaluationId.Value),
                cancellationToken);

    public Task AddEvaluationAsync(EmployeeEvaluation evaluation, CancellationToken cancellationToken) =>
        dbContext.EmployeeEvaluations.AddAsync(evaluation, cancellationToken).AsTask();

    private static EmployeeResponse Map(Employee employee) =>
        new(
            employee.IdEmployee,
            employee.IdOrganization,
            employee.CodeEmployee,
            employee.Status,
            employee.FirstName,
            employee.LastNamePaternal,
            employee.LastNameMaternal,
            employee.FullName,
            employee.JobTitle,
            employee.HireDate,
            employee.BirthDate,
            employee.BirthPlace,
            employee.Sex,
            employee.MaritalStatus,
            employee.Rfc,
            employee.Curp,
            employee.SocialSecurityNumber,
            employee.VoterIdNumber,
            employee.DriverLicenseNumber,
            employee.MilitaryServiceCardNumber,
            employee.Email,
            employee.MobilePhone,
            employee.HomePhone,
            employee.EmergencyContactName,
            employee.EmergencyContactPhone,
            employee.EmergencyContactRelationship,
            employee.Address,
            employee.Street,
            employee.StreetNumber,
            employee.Neighborhood,
            employee.Municipality,
            employee.State,
            employee.PostalCode,
            employee.HousingType,
            employee.ResidenceSinceDate,
            employee.Active,
            employee.CreatedAt,
            employee.UpdatedAt,
            employee.CountryCode,
            employee.IdJobPositionCatalogItem,
            employee.IdEducationLevelCatalogItem);
}
