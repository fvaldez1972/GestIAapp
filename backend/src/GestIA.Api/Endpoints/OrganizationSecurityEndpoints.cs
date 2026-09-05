using GestIA.Api.Security;
using GestIA.Application.Common;
using GestIA.Application.Security;
using GestIA.Domain.Security;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Api.Endpoints;

public static class OrganizationSecurityEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationSecurityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/organization-security")
            .WithTags("Organization security");

        group.MapGet("/users", async (
            HttpContext context,
            Guid organizationId,
            GestIaDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var users = await QueryOrganizationUsers(dbContext, organizationId)
                .ToListAsync(cancellationToken);
            return Results.Ok(users);
        })
            .RequirePermission(SecurityPermissions.UsersRead)
            .WithName("ListOrganizationSecurityUsers");

        group.MapGet("/roles", async (
            HttpContext context,
            Guid organizationId,
            GestIaDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var roles = await QueryAssignableRoles(dbContext, organizationId)
                .ToListAsync(cancellationToken);
            return Results.Ok(roles);
        })
            .RequirePermission(SecurityPermissions.UsersRead)
            .WithName("ListOrganizationAssignableRoles");

        group.MapGet("/permissions", async (
            HttpContext context,
            Guid organizationId,
            GestIaDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var assignableRoleIds = QueryAssignableRoleEntities(dbContext, organizationId)
                .Select(role => role.IdRole);
            var permissions = await dbContext.RolePermissions
                .AsNoTracking()
                .Where(rolePermission => assignableRoleIds.Contains(rolePermission.IdRole))
                .Select(rolePermission => rolePermission.Permission)
                .Distinct()
                .OrderBy(permission => permission.Module)
                .ThenBy(permission => permission.CodePermission)
                .Select(permission => new SecurityPermissionResponse(
                    permission.IdPermission,
                    permission.CodePermission,
                    permission.Module,
                    permission.Description))
                .ToListAsync(cancellationToken);

            return Results.Ok(permissions);
        })
            .RequirePermission(SecurityPermissions.UsersRead)
            .WithName("ListOrganizationSecurityPermissions");

        group.MapPost("/users", async (
            HttpContext context,
            CreateSecurityUserRequest request,
            GestIaDbContext dbContext,
            IPasswordHashService passwordHashService,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var errors = ValidateUserRequest(request.Email, request.DisplayName, request.Password);
            if (request.IdOrganization == Guid.Empty)
            {
                errors[nameof(request.IdOrganization)] = ["La organización es obligatoria."];
            }

            if (request.IdRole == Guid.Empty)
            {
                errors[nameof(request.IdRole)] = ["El rol es obligatorio."];
            }

            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            if (!await CanAssignRoleAsync(dbContext, request.IdOrganization, request.IdRole, cancellationToken))
            {
                return Results.Problem(
                    title: "Rol no permitido",
                    detail: "Sólo puedes asignar roles operativos de tu organización.",
                    statusCode: StatusCodes.Status403Forbidden);
            }

            var normalizedEmail = User.NormalizeEmail(request.Email);
            var emailInUse = await dbContext.Users
                .IgnoreQueryFilters(["Active"])
                .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

            if (emailInUse)
            {
                return Results.Conflict(new { message = "Ya existe un usuario con ese correo." });
            }

            var organizationExists = await dbContext.Organizations
                .AnyAsync(organization => organization.IdOrganization == request.IdOrganization, cancellationToken);

            if (!organizationExists)
            {
                return Results.NotFound(new { message = "No se encontró la organización seleccionada." });
            }

            var passwordHash = passwordHashService.Hash(request.Password);
            var user = User.Create(
                request.Email,
                request.DisplayName,
                passwordHash.Hash,
                passwordHash.Salt,
                passwordHash.Iterations,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);

            await dbContext.Users.AddAsync(user, cancellationToken);
            var membership = OrganizationMembership.Create(
                user.IdUser,
                request.IdOrganization,
                string.IsNullOrWhiteSpace(request.MembershipLabel) ? "Acceso operativo" : request.MembershipLabel,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);
            await dbContext.OrganizationMemberships.AddAsync(membership, cancellationToken);
            await dbContext.UserRoles.AddAsync(
                UserRole.Create(
                    user.IdUser,
                    request.IdRole,
                    membership.IdOrganizationMembership,
                    actorContext.ActorId,
                    actorContext.ActorName,
                    clock.UtcNow),
                cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Created(
                $"/api/v1/organization-security/users/{user.IdUser}?organizationId={request.IdOrganization}",
                await FindOrganizationUserResponseAsync(dbContext, request.IdOrganization, user.IdUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.UsersWrite)
            .WithName("CreateOrganizationSecurityUser");

        group.MapPut("/users/{idUser:guid}", async (
            HttpContext context,
            Guid idUser,
            Guid organizationId,
            UpdateSecurityUserRequest request,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            if (!await UserBelongsToOrganizationAsync(dbContext, organizationId, idUser, cancellationToken))
            {
                return Results.NotFound(new { message = "No se encontró el usuario en tu organización." });
            }

            var errors = ValidateUserProfileRequest(request.Email, request.DisplayName);
            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            var user = await dbContext.Users
                .IgnoreQueryFilters(["Active"])
                .SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);

            if (user is null)
            {
                return Results.NotFound(new { message = "No se encontró el usuario." });
            }

            var normalizedEmail = User.NormalizeEmail(request.Email);
            var emailInUse = await dbContext.Users
                .IgnoreQueryFilters(["Active"])
                .AnyAsync(
                    item => item.NormalizedEmail == normalizedEmail && item.IdUser != idUser,
                    cancellationToken);

            if (emailInUse)
            {
                return Results.Conflict(new { message = "Ya existe otro usuario con ese correo." });
            }

            user.UpdateProfile(
                request.Email,
                request.DisplayName,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(await FindOrganizationUserResponseAsync(dbContext, organizationId, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.UsersWrite)
            .WithName("UpdateOrganizationSecurityUser");

        group.MapPatch("/users/{idUser:guid}/access", async (
            HttpContext context,
            Guid idUser,
            AssignSecurityUserAccessRequest request,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            if (request.IdOrganization == Guid.Empty || request.IdRole == Guid.Empty)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    [nameof(request.IdOrganization)] = ["La organización es obligatoria."],
                    [nameof(request.IdRole)] = ["El rol es obligatorio."]
                });
            }

            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            if (!await UserBelongsToOrganizationAsync(dbContext, request.IdOrganization, idUser, cancellationToken) ||
                !await CanAssignRoleAsync(dbContext, request.IdOrganization, request.IdRole, cancellationToken))
            {
                return Results.Problem(
                    title: "Acceso no permitido",
                    detail: "No puedes asignar accesos fuera de tu organización ni roles de plataforma.",
                    statusCode: StatusCodes.Status403Forbidden);
            }

            var membership = await dbContext.OrganizationMemberships.SingleAsync(
                item => item.IdUser == idUser && item.IdOrganization == request.IdOrganization,
                cancellationToken);
            var alreadyAssigned = await dbContext.UserRoles.AnyAsync(
                item =>
                    item.IdUser == idUser &&
                    item.IdRole == request.IdRole &&
                    item.IdOrganizationMembership == membership.IdOrganizationMembership,
                cancellationToken);

            if (!alreadyAssigned)
            {
                await dbContext.UserRoles.AddAsync(
                    UserRole.Create(
                        idUser,
                        request.IdRole,
                        membership.IdOrganizationMembership,
                        actorContext.ActorId,
                        actorContext.ActorName,
                        clock.UtcNow),
                    cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(await FindOrganizationUserResponseAsync(dbContext, request.IdOrganization, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.UsersWrite)
            .WithName("AssignOrganizationSecurityUserAccess");

        group.MapPatch("/users/{idUser:guid}/password", async (
            HttpContext context,
            Guid idUser,
            Guid organizationId,
            ResetSecurityUserPasswordRequest request,
            GestIaDbContext dbContext,
            IPasswordHashService passwordHashService,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            if (!await UserBelongsToOrganizationAsync(dbContext, organizationId, idUser, cancellationToken))
            {
                return Results.NotFound(new { message = "No se encontró el usuario en tu organización." });
            }

            var errors = ValidatePassword(request.Password);
            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            var user = await dbContext.Users.SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);
            if (user is null)
            {
                return Results.NotFound(new { message = "No se encontró el usuario." });
            }

            var passwordHash = passwordHashService.Hash(request.Password);
            user.ResetPassword(
                passwordHash.Hash,
                passwordHash.Salt,
                passwordHash.Iterations,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.UsersWrite)
            .WithName("ResetOrganizationSecurityUserPassword");

        group.MapDelete("/users/{idUser:guid}/access", async (
            HttpContext context,
            Guid idUser,
            Guid organizationId,
            Guid roleId,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            if (!await CanAssignRoleAsync(dbContext, organizationId, roleId, cancellationToken))
            {
                return Results.Problem(
                    title: "Rol no permitido",
                    detail: "No puedes retirar roles de plataforma desde el alcance de organización.",
                    statusCode: StatusCodes.Status403Forbidden);
            }

            var membership = await dbContext.OrganizationMemberships
                .SingleOrDefaultAsync(
                    item => item.IdUser == idUser && item.IdOrganization == organizationId,
                    cancellationToken);

            if (membership is null)
            {
                return Results.NotFound(new { message = "No se encontró el acceso del usuario a esa organización." });
            }

            var userRole = await dbContext.UserRoles.SingleOrDefaultAsync(
                item =>
                    item.IdUser == idUser &&
                    item.IdRole == roleId &&
                    item.IdOrganizationMembership == membership.IdOrganizationMembership,
                cancellationToken);

            if (userRole is null)
            {
                return Results.NotFound(new { message = "No se encontró el rol asignado al usuario." });
            }

            userRole.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(await FindOrganizationUserResponseAsync(dbContext, organizationId, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.UsersWrite)
            .WithName("RemoveOrganizationSecurityUserAccess");

        group.MapDelete("/users/{idUser:guid}", async (
            HttpContext context,
            Guid idUser,
            Guid organizationId,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            if (!await UserBelongsToOrganizationAsync(dbContext, organizationId, idUser, cancellationToken))
            {
                return Results.NotFound(new { message = "No se encontró el usuario en tu organización." });
            }

            var user = await dbContext.Users.SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);
            if (user is null)
            {
                return Results.NotFound(new { message = "No se encontró el usuario." });
            }

            user.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.UsersWrite)
            .WithName("DeactivateOrganizationSecurityUser");

        group.MapPatch("/users/{idUser:guid}/activate", async (
            HttpContext context,
            Guid idUser,
            Guid organizationId,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            if (!await UserBelongsToOrganizationAsync(dbContext, organizationId, idUser, cancellationToken))
            {
                return Results.NotFound(new { message = "No se encontró el usuario en tu organización." });
            }

            var user = await dbContext.Users
                .IgnoreQueryFilters(["Active"])
                .SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);

            if (user is null)
            {
                return Results.NotFound(new { message = "No se encontró el usuario." });
            }

            user.Activate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(await FindOrganizationUserResponseAsync(dbContext, organizationId, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.UsersWrite)
            .WithName("ActivateOrganizationSecurityUser");

        return endpoints;
    }

    private static IQueryable<SecurityUserResponse> QueryOrganizationUsers(GestIaDbContext dbContext, Guid organizationId) =>
        dbContext.Users
            .IgnoreQueryFilters(["Active"])
            .AsNoTracking()
            .Where(user => dbContext.OrganizationMemberships.Any(membership =>
                membership.IdUser == user.IdUser &&
                membership.IdOrganization == organizationId))
            .OrderBy(user => user.DisplayName)
            .Select(user => new SecurityUserResponse(
                user.IdUser,
                user.Email,
                user.DisplayName,
                user.LastLoginAt,
                user.Active,
                dbContext.OrganizationMemberships
                    .Where(membership => membership.IdUser == user.IdUser && membership.IdOrganization == organizationId)
                    .OrderBy(membership => membership.Organization.LegalName)
                    .Select(membership => new SecurityUserOrganizationResponse(
                        membership.IdOrganization,
                        membership.Organization.CodeOrganization,
                        membership.Organization.LegalName,
                        membership.Label))
                    .ToList(),
                dbContext.UserRoles
                    .Where(userRole =>
                        userRole.IdUser == user.IdUser &&
                        userRole.OrganizationMembership != null &&
                        userRole.OrganizationMembership.IdOrganization == organizationId &&
                        !dbContext.RolePermissions.Any(rolePermission =>
                            rolePermission.IdRole == userRole.IdRole &&
                            rolePermission.Permission.CodePermission == SecurityPermissions.PlatformAdmin))
                    .OrderBy(userRole => userRole.Role.Name)
                    .Select(userRole => new SecurityUserRoleResponse(
                        userRole.IdRole,
                        userRole.Role.CodeRole,
                        userRole.Role.Name,
                        userRole.OrganizationMembership == null
                            ? null
                            : userRole.OrganizationMembership.IdOrganization,
                        userRole.OrganizationMembership == null
                            ? null
                            : userRole.OrganizationMembership.Organization.LegalName))
                    .ToList()));

    private static IQueryable<GestIA.Domain.Security.Role> QueryAssignableRoleEntities(GestIaDbContext dbContext, Guid organizationId) =>
        dbContext.Roles
            .AsNoTracking()
            .Where(role =>
                role.Active &&
                (role.IdOrganization == null || role.IdOrganization == organizationId) &&
                role.CodeRole != "ADMINISTRATOR" &&
                role.CodeRole != "ORGANIZATION_ADMIN" &&
                !dbContext.RolePermissions.Any(rolePermission =>
                    rolePermission.IdRole == role.IdRole &&
                    rolePermission.Permission.CodePermission == SecurityPermissions.PlatformAdmin));

    private static IQueryable<SecurityRoleResponse> QueryAssignableRoles(GestIaDbContext dbContext, Guid organizationId) =>
        QueryAssignableRoleEntities(dbContext, organizationId)
            .OrderBy(role => role.Name)
            .Select(role => new SecurityRoleResponse(
                role.IdRole,
                role.IdOrganization,
                role.CodeRole,
                role.Name,
                role.IsSystem,
                role.Active,
                dbContext.RolePermissions
                    .Where(rolePermission => rolePermission.IdRole == role.IdRole)
                    .OrderBy(rolePermission => rolePermission.Permission.Module)
                    .ThenBy(rolePermission => rolePermission.Permission.CodePermission)
                    .Select(rolePermission => new SecurityPermissionResponse(
                        rolePermission.Permission.IdPermission,
                        rolePermission.Permission.CodePermission,
                        rolePermission.Permission.Module,
                        rolePermission.Permission.Description))
                    .ToList()));

    private static async Task<SecurityUserResponse?> FindOrganizationUserResponseAsync(
        GestIaDbContext dbContext,
        Guid organizationId,
        Guid idUser,
        CancellationToken cancellationToken) =>
        await QueryOrganizationUsers(dbContext, organizationId)
            .SingleOrDefaultAsync(user => user.IdUser == idUser, cancellationToken);

    private static async Task<bool> UserBelongsToOrganizationAsync(
        GestIaDbContext dbContext,
        Guid organizationId,
        Guid idUser,
        CancellationToken cancellationToken) =>
        await dbContext.OrganizationMemberships.AnyAsync(
            membership => membership.IdUser == idUser && membership.IdOrganization == organizationId,
            cancellationToken);

    private static async Task<bool> CanAssignRoleAsync(
        GestIaDbContext dbContext,
        Guid organizationId,
        Guid idRole,
        CancellationToken cancellationToken)
    {
        var role = await dbContext.Roles
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.IdRole == idRole, cancellationToken);

        if (role is null ||
            !role.Active ||
            IsAdministrativeRole(role.CodeRole) ||
            (role.IdOrganization.HasValue && role.IdOrganization != organizationId))
        {
            return false;
        }

        return !await dbContext.RolePermissions.AnyAsync(
            rolePermission =>
                rolePermission.IdRole == idRole &&
                rolePermission.Permission.CodePermission == SecurityPermissions.PlatformAdmin,
            cancellationToken);
    }

    private static bool IsAdministrativeRole(string codeRole) =>
        string.Equals(codeRole, "ADMINISTRATOR", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(codeRole, "ORGANIZATION_ADMIN", StringComparison.OrdinalIgnoreCase);

    private static Dictionary<string, string[]> ValidateUserRequest(
        string email,
        string displayName,
        string password)
    {
        var errors = ValidatePassword(password);
        ValidateUserProfileRequest(email, displayName, errors);
        return errors;
    }

    private static Dictionary<string, string[]> ValidateUserProfileRequest(string email, string displayName)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateUserProfileRequest(email, displayName, errors);
        return errors;
    }

    private static void ValidateUserProfileRequest(
        string email,
        string displayName,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 255 || !email.Contains('@', StringComparison.Ordinal))
        {
            errors[nameof(email)] = ["Captura un correo válido."];
        }

        if (string.IsNullOrWhiteSpace(displayName) || displayName.Length > 120)
        {
            errors[nameof(displayName)] = ["El nombre es obligatorio y no debe exceder 120 caracteres."];
        }
    }

    private static Dictionary<string, string[]> ValidatePassword(string password)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(password) || password.Length < 12 || password.Length > 200)
        {
            errors[nameof(password)] = ["La contraseña debe tener entre 12 y 200 caracteres."];
        }

        return errors;
    }
}
