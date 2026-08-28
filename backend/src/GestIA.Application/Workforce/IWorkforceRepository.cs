using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

public interface IWorkforceRepository
{
    Task<EmployeeListResult> ListEmployeesAsync(EmployeeQuery query, CancellationToken cancellationToken);

    Task<Employee?> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<bool> OrganizationExistsAsync(Guid idOrganization, CancellationToken cancellationToken);

    Task<bool> IsEmployeeCodeInUseAsync(
        Guid idOrganization,
        string codeEmployee,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task<bool> IsRfcInUseAsync(
        Guid idOrganization,
        string rfc,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task<bool> IsCurpInUseAsync(
        Guid idOrganization,
        string curp,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task<bool> IsSocialSecurityNumberInUseAsync(
        Guid idOrganization,
        string socialSecurityNumber,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task AddEmployeeAsync(Employee employee, CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeDocument>> ListDocumentsAsync(Guid idEmployee, CancellationToken cancellationToken);

    Task<EmployeeDocument?> GetDocumentAsync(
        Guid idEmployee,
        Guid idEmployeeDocument,
        CancellationToken cancellationToken);

    Task AddDocumentAsync(EmployeeDocument document, CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeEvaluation>> ListEvaluationsAsync(Guid idEmployee, CancellationToken cancellationToken);

    Task<EmployeeEvaluation?> GetEvaluationAsync(
        Guid idEmployee,
        Guid idEmployeeEvaluation,
        CancellationToken cancellationToken);

    Task<bool> IsEvaluationInUseAsync(
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        DateOnly evaluatedDate,
        Guid? excludedEmployeeEvaluationId,
        CancellationToken cancellationToken);

    Task AddEvaluationAsync(EmployeeEvaluation evaluation, CancellationToken cancellationToken);
}
