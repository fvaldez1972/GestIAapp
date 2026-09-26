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

    public Task<bool> IsEvaluationInUseAsync(
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        DateOnly evaluatedDate,
        Guid? excludedEmployeeEvaluationId,
        CancellationToken cancellationToken) =>
        dbContext.EmployeeEvaluations
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                evaluation =>
                    evaluation.IdEmployee == idEmployee &&
                    evaluation.EvaluationType == evaluationType &&
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
