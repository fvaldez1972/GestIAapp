using GestIA.Application.Security;
using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class UserAccessRepository(GestIaDbContext dbContext) : IUserAccessRepository
{
    public async Task<AuthenticatedUserAccess?> FindByEmailAsync(
        string email,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = User.NormalizeEmail(email);
        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (user is null)
        {
            return null;
        }

        var organizations = await (
            from membership in dbContext.OrganizationMemberships.AsNoTracking()
            join organization in dbContext.Organizations.AsNoTracking()
                on membership.IdOrganization equals organization.IdOrganization
            where membership.IdUser == user.IdUser
            orderby organization.CodeOrganization
            select new OrganizationAccessResponse(
                organization.IdOrganization,
                organization.CodeOrganization,
                organization.LegalName))
            .ToArrayAsync(cancellationToken);

        var permissions = await (
            from userRole in dbContext.UserRoles.AsNoTracking()
            join rolePermission in dbContext.RolePermissions.AsNoTracking()
                on userRole.IdRole equals rolePermission.IdRole
            join permission in dbContext.Permissions.AsNoTracking()
                on rolePermission.IdPermission equals permission.IdPermission
            where userRole.IdUser == user.IdUser
            select permission.CodePermission)
            .Distinct()
            .OrderBy(item => item)
            .ToArrayAsync(cancellationToken);

        return new AuthenticatedUserAccess(
            user.IdUser,
            user.Email,
            user.DisplayName,
            user.PasswordHash,
            user.PasswordSalt,
            user.PasswordIterations,
            organizations,
            permissions);
    }

    public async Task RegisterLoginAsync(
        Guid idUser,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.SingleAsync(
            item => item.IdUser == idUser,
            cancellationToken);
        user.RegisterLogin(occurredAt);
    }
}
