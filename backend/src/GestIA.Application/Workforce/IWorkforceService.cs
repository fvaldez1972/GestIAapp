using GestIA.Application.Common;

namespace GestIA.Application.Workforce;

public interface IWorkforceService
{
    Task<PagedResult<EmployeeResponse>> ListEmployeesAsync(EmployeeQuery query, CancellationToken cancellationToken);

    Task<EmployeeDetailResponse> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<EmployeeResponse> CreateEmployeeAsync(
        CreateEmployeeRequest request,
        CancellationToken cancellationToken);

    Task<EmployeeResponse> UpdateEmployeeAsync(
        Guid idEmployee,
        UpdateEmployeeRequest request,
        CancellationToken cancellationToken);

    Task<EmployeeResponse> ChangeStatusAsync(
        Guid idEmployee,
        ChangeEmployeeStatusRequest request,
        CancellationToken cancellationToken);

    Task DeactivateEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeDocumentResponse>> ListDocumentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<EmployeeDocumentResponse> CreateDocumentAsync(
        CreateEmployeeDocumentRequest request,
        CancellationToken cancellationToken);

    Task<EmployeeDocumentResponse> UpdateDocumentAsync(
        Guid idEmployeeDocument,
        UpdateEmployeeDocumentRequest request,
        CancellationToken cancellationToken);

    Task DeactivateDocumentAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idEmployeeDocument,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeEvaluationResponse>> ListEvaluationsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<EmployeeEvaluationResponse> CreateEvaluationAsync(
        CreateEmployeeEvaluationRequest request,
        CancellationToken cancellationToken);

    Task<EmployeeEvaluationResponse> UpdateEvaluationAsync(
        Guid idEmployeeEvaluation,
        UpdateEmployeeEvaluationRequest request,
        CancellationToken cancellationToken);

    Task DeactivateEvaluationAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idEmployeeEvaluation,
        CancellationToken cancellationToken);
}
