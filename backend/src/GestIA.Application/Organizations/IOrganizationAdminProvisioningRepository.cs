using GestIA.Domain.Security;

namespace GestIA.Application.Organizations;

public interface IOrganizationAdminProvisioningRepository
{
    Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<Role?> GetOrganizationAdminRoleAsync(CancellationToken cancellationToken);
    Task AddAsync(User user, OrganizationMembership membership, UserRole userRole, CancellationToken cancellationToken);
}
