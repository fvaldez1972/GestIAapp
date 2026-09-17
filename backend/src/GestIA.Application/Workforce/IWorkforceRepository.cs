using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

public interface IWorkforceRepository
{
    Task<EmployeeListResult> ListEmployeesAsync(EmployeeQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// El listado con lo que la tabla necesita resuelto: puesto de catálogo, resumen documental y
    /// asignaciones. Los requisitos documentales salen de la organización, así que viajan aparte.
    /// </summary>
    Task<(IReadOnlyList<EmployeeListItemResponse> Items, int TotalCount)> SearchEmployeesAsync(
        EmployeeSearchCriteria criteria,
        IReadOnlyCollection<EmployeeDocumentType> requiredDocuments,
        CancellationToken cancellationToken);

    /// <summary>Los tipos de documento que esta organización exige, de EligibilityRequirement.</summary>
    Task<IReadOnlyList<EmployeeDocumentType>> ListRequiredDocumentTypesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>Los puestos de catálogo que alguien tiene, para el filtro. Sólo los usados.</summary>
    Task<IReadOnlyList<(Guid Id, string Name)>> ListUsedJobPositionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>Los municipios donde hay personal, para el filtro.</summary>
    Task<IReadOnlyList<string>> ListEmployeeMunicipalitiesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>
    /// Las asignaciones de una persona.
    ///
    /// <para>Hoy sólo se alcanzan por cliente y servicio, así que la pestaña tendría que recorrer
    /// todos los servicios de la organización para encontrar las de alguien.</para>
    /// </summary>
    Task<IReadOnlyList<EmployeeAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly today,
        CancellationToken cancellationToken);

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
