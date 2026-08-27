namespace GestIA.Application.Organizations;

public interface IOrganizationService
{
    Task<IReadOnlyList<OrganizationResponse>> ListAsync(CancellationToken cancellationToken);
    Task<OrganizationResponse> GetAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<OrganizationResponse> CreateAsync(
        CreateOrganizationRequest request,
        CancellationToken cancellationToken);
}
