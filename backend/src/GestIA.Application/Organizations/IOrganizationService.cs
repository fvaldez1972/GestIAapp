namespace GestIA.Application.Organizations;

public interface IOrganizationService
{
    Task<IReadOnlyList<OrganizationResponse>> ListAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<OrganizationGovernanceSummaryResponse>> ListGovernanceAsync(CancellationToken cancellationToken);
    Task<OrganizationResponse> GetAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<OrganizationResponse> CreateAsync(
        CreateOrganizationRequest request,
        CancellationToken cancellationToken);
    Task<OrganizationResponse> UpdateAsync(
        Guid idOrganization,
        UpdateOrganizationRequest request,
        CancellationToken cancellationToken);
    Task DeactivateAsync(Guid idOrganization, CancellationToken cancellationToken);
    Task<OrganizationResponse> ActivateAsync(Guid idOrganization, CancellationToken cancellationToken);
}
