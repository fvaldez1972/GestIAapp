using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Application.Assignments;

public interface IAssignmentRepository
{
    Task<ServiceEntity?> GetServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken);

    Task<Employee?> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<Position?> GetPositionAsync(
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeDocument>> ListEmployeeDocumentsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeEvaluation>> ListEmployeeEvaluationsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ServiceAssignment>> ListAssignmentsAsync(
        Guid idService,
        CancellationToken cancellationToken);

    Task<ServiceAssignment?> GetAssignmentAsync(
        Guid idService,
        Guid idServiceAssignment,
        CancellationToken cancellationToken);

    Task<bool> HasEmployeeAssignmentOverlapAsync(
        Guid idEmployee,
        DateOnly startDate,
        DateOnly? endDate,
        Guid? excludedAssignmentId,
        CancellationToken cancellationToken);

    Task AddAssignmentAsync(ServiceAssignment assignment, CancellationToken cancellationToken);
}
