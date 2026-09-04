using GestIA.Application.Organizations;
using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class OrganizationAdminProvisioningRepository(GestIaDbContext dbContext)
    : IOrganizationAdminProvisioningRepository
{
    public Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken cancellationToken) =>
        dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

    public Task<Role?> GetOrganizationAdminRoleAsync(CancellationToken cancellationToken) =>
        dbContext.Roles.SingleOrDefaultAsync(role => role.CodeRole == "ORGANIZATION_ADMIN", cancellationToken);

    public async Task AddAsync(
        User user,
        OrganizationMembership membership,
        UserRole userRole,
        CancellationToken cancellationToken)
    {
        await dbContext.Users.AddAsync(user, cancellationToken);
        await dbContext.OrganizationMemberships.AddAsync(membership, cancellationToken);
        await dbContext.UserRoles.AddAsync(userRole, cancellationToken);
    }
}
