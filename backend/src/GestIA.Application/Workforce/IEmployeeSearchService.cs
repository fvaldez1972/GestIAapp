namespace GestIA.Application.Workforce;

public interface IEmployeeSearchService
{
    Task<EmployeeSearchResponse> SearchAsync(EmployeeSearchQuery query, CancellationToken cancellationToken);

    Task<EmployeeFilterOptionsResponse> GetFilterOptionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>Con qué clientes está ocupada cada persona hoy, para la lista de candidatos.</summary>
    Task<IReadOnlyList<EmployeeCurrentAssignmentsResponse>> ListCurrentAssignmentsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);
}
