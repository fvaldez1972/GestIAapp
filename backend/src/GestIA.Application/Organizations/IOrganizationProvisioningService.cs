namespace GestIA.Application.Organizations;

public interface IOrganizationProvisioningService
{
    Task<OrganizationProvisioningResponse> CreateWithAdminAsync(
        CreateOrganizationWithAdminRequest request,
        CancellationToken cancellationToken);
}
