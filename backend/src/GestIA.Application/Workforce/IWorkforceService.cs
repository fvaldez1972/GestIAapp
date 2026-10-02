using GestIA.Application.Common;

namespace GestIA.Application.Workforce;

public interface IWorkforceService
{
    Task<PagedResult<EmployeeResponse>> ListEmployeesAsync(EmployeeQuery query, CancellationToken cancellationToken);

    /// <summary>Contrata a quien estaba en candidatura: abre su primer periodo laboral.</summary>
    Task<EmployeeResponse> HireEmployeeAsync(
        Guid idEmployee,
        HireEmployeeRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Registra la baja: cierra el periodo con su motivo, cierra las asignaciones vigentes y devuelve
    /// cuántos turnos ya proyectados quedan a nombre de la persona.
    /// </summary>
    Task<TerminateEmployeeResult> TerminateEmployeeAsync(
        Guid idEmployee,
        TerminateEmployeeRequest request,
        CancellationToken cancellationToken);

    /// <summary>Registra un reingreso: abre un periodo nuevo. Sin límite y sin espera mínima.</summary>
    Task<EmployeeResponse> RehireEmployeeAsync(
        Guid idEmployee,
        RehireEmployeeRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmploymentPeriodResponse>> ListEmploymentPeriodsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<PsychometricTestResponse> RegisterPsychometricTestAsync(
        Guid idEmployee,
        RegisterPsychometricTestRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<PsychometricTestResponse>> ListPsychometricTestsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    /// <summary>Lo que cada baja dejó vencido, para el historial de la ficha.</summary>
    Task<IReadOnlyList<TerminationExpirationGroup>> ListTerminationExpirationsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

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
