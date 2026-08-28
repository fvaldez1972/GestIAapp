using GestIA.Application.Workforce;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class WorkforceRepository(GestIaDbContext dbContext) : IWorkforceRepository
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
            .IgnoreQueryFilters()
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
            .IgnoreQueryFilters()
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
            .IgnoreQueryFilters()
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
            .IgnoreQueryFilters()
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
            .IgnoreQueryFilters()
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
            employee.Address,
            employee.Municipality,
            employee.State,
            employee.PostalCode,
            employee.HousingType,
            employee.ResidenceSinceDate,
            employee.Active,
            employee.CreatedAt,
            employee.UpdatedAt);
}
