namespace GestIA.Application.Workforce;

public interface IEmployeeSearchService
{
    Task<EmployeeSearchResponse> SearchAsync(EmployeeSearchQuery query, CancellationToken cancellationToken);

    Task<EmployeeFilterOptionsResponse> GetFilterOptionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);
}
