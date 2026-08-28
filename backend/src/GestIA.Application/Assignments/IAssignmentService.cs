namespace GestIA.Application.Assignments;

public interface IAssignmentService
{
    Task<IReadOnlyList<ServiceAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken);

    Task<ServiceAssignmentResponse> CreateAssignmentAsync(
        CreateServiceAssignmentRequest request,
        CancellationToken cancellationToken);

    Task<ServiceAssignmentResponse> UpdateAssignmentAsync(
        Guid idServiceAssignment,
        UpdateServiceAssignmentRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAssignmentAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idServiceAssignment,
        CancellationToken cancellationToken);
}
