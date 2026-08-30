using GestIA.Api.Security;
using GestIA.Application.Common;
using GestIA.Application.Security;
using GestIA.Domain.Security;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Api.Endpoints;

public static class SecurityAdministrationEndpoints
{
    public static IEndpointRouteBuilder MapSecurityAdministrationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/security")
            .WithTags("Security");

        group.MapGet("/users", async (
            GestIaDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var users = await dbContext.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .OrderBy(user => user.DisplayName)
                .Select(user => new SecurityUserResponse(
                    user.IdUser,
                    user.Email,
                    user.DisplayName,
                    user.LastLoginAt,
                    user.Active,
                    dbContext.OrganizationMemberships
                        .Where(membership => membership.IdUser == user.IdUser)
                        .OrderBy(membership => membership.Organization.LegalName)
                        .Select(membership => new SecurityUserOrganizationResponse(
                            membership.IdOrganization,
                            membership.Organization.CodeOrganization,
                            membership.Organization.LegalName,
                            membership.Label))
                        .ToList(),
                    dbContext.UserRoles
                        .Where(userRole => userRole.IdUser == user.IdUser)
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
                        .ToList()))
                .ToListAsync(cancellationToken);

            return Results.Ok(users);
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ListSecurityUsers");

        group.MapPost("/users", async (
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

            var normalizedEmail = User.NormalizeEmail(request.Email);
            var emailInUse = await dbContext.Users
                .IgnoreQueryFilters()
                .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

            if (emailInUse)
            {
                return Results.Conflict(new { message = "Ya existe un usuario con ese correo." });
            }

            var organizationExists = await dbContext.Organizations
                .AnyAsync(organization => organization.IdOrganization == request.IdOrganization, cancellationToken);
            var roleExists = await dbContext.Roles
                .AnyAsync(role => role.IdRole == request.IdRole, cancellationToken);

            if (!organizationExists || !roleExists)
            {
                return Results.NotFound(new { message = "No se encontró la organización o el rol seleccionado." });
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

            var result = await FindUserResponseAsync(dbContext, user.IdUser, cancellationToken);
            return Results.Created($"/api/v1/security/users/{user.IdUser}", result);
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("CreateSecurityUser");

        group.MapPut("/users/{idUser:guid}", async (
            Guid idUser,
            UpdateSecurityUserRequest request,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var errors = ValidateUserProfileRequest(request.Email, request.DisplayName);
            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            var user = await dbContext.Users
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);

            if (user is null)
            {
                return Results.NotFound(new { message = "No se encontró el usuario." });
            }

            var normalizedEmail = User.NormalizeEmail(request.Email);
            var emailInUse = await dbContext.Users
                .IgnoreQueryFilters()
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
            return Results.Ok(await FindUserResponseAsync(dbContext, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("UpdateSecurityUser");

        group.MapPatch("/users/{idUser:guid}/access", async (
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

            var user = await dbContext.Users.SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);
            var organizationExists = await dbContext.Organizations
                .AnyAsync(organization => organization.IdOrganization == request.IdOrganization, cancellationToken);
            var roleExists = await dbContext.Roles
                .AnyAsync(role => role.IdRole == request.IdRole, cancellationToken);

            if (user is null || !organizationExists || !roleExists)
            {
                return Results.NotFound(new { message = "No se encontró el usuario, la organización o el rol seleccionado." });
            }

            var membership = await dbContext.OrganizationMemberships.SingleOrDefaultAsync(
                item => item.IdUser == idUser && item.IdOrganization == request.IdOrganization,
                cancellationToken);

            if (membership is null)
            {
                membership = OrganizationMembership.Create(
                    idUser,
                    request.IdOrganization,
                    string.IsNullOrWhiteSpace(request.MembershipLabel) ? "Acceso operativo" : request.MembershipLabel,
                    actorContext.ActorId,
                    actorContext.ActorName,
                    clock.UtcNow);
                await dbContext.OrganizationMemberships.AddAsync(membership, cancellationToken);
            }

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
            return Results.Ok(await FindUserResponseAsync(dbContext, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("AssignSecurityUserAccess");

        group.MapDelete("/users/{idUser:guid}/access", async (
            Guid idUser,
            Guid organizationId,
            Guid roleId,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
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
            return Results.Ok(await FindUserResponseAsync(dbContext, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("RemoveSecurityUserAccess");

        group.MapPatch("/users/{idUser:guid}/password", async (
            Guid idUser,
            ResetSecurityUserPasswordRequest request,
            GestIaDbContext dbContext,
            IPasswordHashService passwordHashService,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
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
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ResetSecurityUserPassword");

        group.MapDelete("/users/{idUser:guid}", async (
            Guid idUser,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var user = await dbContext.Users.SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);
            if (user is null)
            {
                return Results.NotFound(new { message = "No se encontró el usuario." });
            }

            user.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("DeactivateSecurityUser");

        group.MapPatch("/users/{idUser:guid}/activate", async (
            Guid idUser,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var user = await dbContext.Users
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.IdUser == idUser, cancellationToken);

            if (user is null)
            {
                return Results.NotFound(new { message = "No se encontró el usuario." });
            }

            user.Activate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(await FindUserResponseAsync(dbContext, idUser, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ActivateSecurityUser");

        group.MapGet("/roles", async (
            GestIaDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var roles = await dbContext.Roles
                .IgnoreQueryFilters()
                .AsNoTracking()
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
                        .ToList()))
                .ToListAsync(cancellationToken);

            return Results.Ok(roles);
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ListSecurityRoles");

        group.MapPost("/roles", async (
            CreateSecurityRoleRequest request,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
            var codeRole = ValidateRequired(request.CodeRole, nameof(request.CodeRole), 60, errors).ToUpperInvariant();
            var name = ValidateRequired(request.Name, nameof(request.Name), 120, errors);

            if (request.PermissionCodes.Count == 0)
            {
                errors[nameof(request.PermissionCodes)] = ["Selecciona al menos un permiso."];
            }

            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            var codeInUse = await dbContext.Roles
                .IgnoreQueryFilters()
                .AnyAsync(role => role.CodeRole == codeRole, cancellationToken);

            if (codeInUse)
            {
                return Results.Conflict(new { message = "Ya existe un rol con esa clave." });
            }

            if (request.IdOrganization.HasValue)
            {
                var organizationExists = await dbContext.Organizations
                    .AnyAsync(
                        organization => organization.IdOrganization == request.IdOrganization.Value,
                        cancellationToken);

                if (!organizationExists)
                {
                    return Results.NotFound(new { message = "No se encontró la organización seleccionada." });
                }
            }

            var permissionCodes = request.PermissionCodes
                .Select(permission => permission.Trim().ToUpperInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            var permissions = await dbContext.Permissions
                .Where(permission => permissionCodes.Contains(permission.CodePermission))
                .ToArrayAsync(cancellationToken);

            if (permissions.Length != permissionCodes.Length)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    [nameof(request.PermissionCodes)] = ["Uno o más permisos no existen."]
                });
            }

            var role = Role.CreateCustom(
                request.IdOrganization,
                codeRole,
                name,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);
            await dbContext.Roles.AddAsync(role, cancellationToken);

            foreach (var permission in permissions)
            {
                await dbContext.RolePermissions.AddAsync(
                    RolePermission.Create(role.IdRole, permission.IdPermission),
                    cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/v1/security/roles/{role.IdRole}", await FindRoleResponseAsync(dbContext, role.IdRole, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("CreateSecurityRole");

        group.MapPut("/roles/{idRole:guid}", async (
            Guid idRole,
            UpdateSecurityRoleRequest request,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
            var name = ValidateRequired(request.Name, nameof(request.Name), 120, errors);

            if (request.PermissionCodes.Count == 0)
            {
                errors[nameof(request.PermissionCodes)] = ["Selecciona al menos un permiso."];
            }

            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            var role = await dbContext.Roles
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.IdRole == idRole, cancellationToken);

            if (role is null)
            {
                return Results.NotFound(new { message = "No se encontró el rol." });
            }

            if (role.IsSystem)
            {
                return Results.Conflict(new { message = "No se puede editar un rol del sistema." });
            }

            var permissionCodes = request.PermissionCodes
                .Select(permission => permission.Trim().ToUpperInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            var permissions = await dbContext.Permissions
                .Where(permission => permissionCodes.Contains(permission.CodePermission))
                .ToArrayAsync(cancellationToken);

            if (permissions.Length != permissionCodes.Length)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    [nameof(request.PermissionCodes)] = ["Uno o más permisos no existen."]
                });
            }

            role.UpdateProfile(name, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            var currentPermissions = await dbContext.RolePermissions
                .Where(item => item.IdRole == role.IdRole)
                .ToArrayAsync(cancellationToken);
            dbContext.RolePermissions.RemoveRange(currentPermissions);

            foreach (var permission in permissions)
            {
                await dbContext.RolePermissions.AddAsync(
                    RolePermission.Create(role.IdRole, permission.IdPermission),
                    cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(await FindRoleResponseAsync(dbContext, role.IdRole, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("UpdateSecurityRole");

        group.MapDelete("/roles/{idRole:guid}", async (
            Guid idRole,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var role = await dbContext.Roles.SingleOrDefaultAsync(item => item.IdRole == idRole, cancellationToken);

            if (role is null)
            {
                return Results.NotFound(new { message = "No se encontró el rol." });
            }

            if (role.IsSystem)
            {
                return Results.Conflict(new { message = "No se puede desactivar un rol del sistema." });
            }

            role.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("DeactivateSecurityRole");

        group.MapPatch("/roles/{idRole:guid}/activate", async (
            Guid idRole,
            GestIaDbContext dbContext,
            IActorContext actorContext,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var role = await dbContext.Roles
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.IdRole == idRole, cancellationToken);

            if (role is null)
            {
                return Results.NotFound(new { message = "No se encontró el rol." });
            }

            if (role.IsSystem)
            {
                return Results.Conflict(new { message = "No se puede reactivar manualmente un rol del sistema." });
            }

            role.Activate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(await FindRoleResponseAsync(dbContext, role.IdRole, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ActivateSecurityRole");

        group.MapGet("/permissions", async (
            GestIaDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var permissions = await dbContext.Permissions
                .AsNoTracking()
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
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ListSecurityPermissions");

        return endpoints;
    }

    private static Dictionary<string, string[]> ValidateUserRequest(
        string email,
        string displayName,
        string password)
    {
        var errors = ValidatePassword(password);
        ValidateUserProfileRequest(email, displayName, errors);
        return errors;
    }

    private static Dictionary<string, string[]> ValidateUserProfileRequest(
        string email,
        string displayName)
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

    private static string ValidateRequired(
        string value,
        string field,
        int maximumLength,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[field] = ["El campo es obligatorio."];
            return string.Empty;
        }

        var normalized = value.Trim();
        if (normalized.Length > maximumLength)
        {
            errors[field] = [$"No puede exceder {maximumLength} caracteres."];
        }

        return normalized;
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

    private static async Task<SecurityUserResponse?> FindUserResponseAsync(
        GestIaDbContext dbContext,
        Guid idUser,
        CancellationToken cancellationToken) =>
        await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(user => user.IdUser == idUser)
            .Select(user => new SecurityUserResponse(
                user.IdUser,
                user.Email,
                user.DisplayName,
                user.LastLoginAt,
                user.Active,
                dbContext.OrganizationMemberships
                    .Where(membership => membership.IdUser == user.IdUser)
                    .OrderBy(membership => membership.Organization.LegalName)
                    .Select(membership => new SecurityUserOrganizationResponse(
                        membership.IdOrganization,
                        membership.Organization.CodeOrganization,
                        membership.Organization.LegalName,
                        membership.Label))
                    .ToList(),
                dbContext.UserRoles
                    .Where(userRole => userRole.IdUser == user.IdUser)
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
                    .ToList()))
            .SingleOrDefaultAsync(cancellationToken);

    private static async Task<SecurityRoleResponse?> FindRoleResponseAsync(
        GestIaDbContext dbContext,
        Guid idRole,
        CancellationToken cancellationToken) =>
        await dbContext.Roles
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(role => role.IdRole == idRole)
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
                    .ToList()))
            .SingleOrDefaultAsync(cancellationToken);
}

public sealed record CreateSecurityUserRequest(
    string Email,
    string DisplayName,
    string Password,
    Guid IdOrganization,
    string? MembershipLabel,
    Guid IdRole);

public sealed record UpdateSecurityUserRequest(
    string Email,
    string DisplayName);

public sealed record AssignSecurityUserAccessRequest(
    Guid IdOrganization,
    string? MembershipLabel,
    Guid IdRole);

public sealed record ResetSecurityUserPasswordRequest(string Password);

public sealed record CreateSecurityRoleRequest(
    Guid? IdOrganization,
    string CodeRole,
    string Name,
    IReadOnlyList<string> PermissionCodes);

public sealed record UpdateSecurityRoleRequest(
    string Name,
    IReadOnlyList<string> PermissionCodes);

public sealed record SecurityUserResponse(
    Guid IdUser,
    string Email,
    string DisplayName,
    DateTime? LastLoginAt,
    bool Active,
    IReadOnlyList<SecurityUserOrganizationResponse> Organizations,
    IReadOnlyList<SecurityUserRoleResponse> Roles);

public sealed record SecurityUserOrganizationResponse(
    Guid IdOrganization,
    string CodeOrganization,
    string LegalName,
    string Label);

public sealed record SecurityUserRoleResponse(
    Guid IdRole,
    string CodeRole,
    string Name,
    Guid? IdOrganization,
    string? OrganizationName);

public sealed record SecurityRoleResponse(
    Guid IdRole,
    Guid? IdOrganization,
    string CodeRole,
    string Name,
    bool IsSystem,
    bool Active,
    IReadOnlyList<SecurityPermissionResponse> Permissions);

public sealed record SecurityPermissionResponse(
    Guid IdPermission,
    string CodePermission,
    string Module,
    string Description);
