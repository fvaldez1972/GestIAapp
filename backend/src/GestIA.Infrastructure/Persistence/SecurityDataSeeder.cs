using GestIA.Application.Security;
using GestIA.Domain.Organizations;
using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GestIA.Infrastructure.Persistence;

public sealed class SecurityDataSeeder(
    GestIaDbContext dbContext,
    IPasswordHashService passwordHashService,
    IConfiguration configuration,
    ILogger<SecurityDataSeeder> logger,
    GestIA.Application.Catalogs.OrganizationCatalogDefaults catalogDefaults)
{
    private static readonly Guid SeedActorId =
        Guid.Parse("00000000-0000-0000-0000-000000000001");
    private const string SeedActorName = "GestIA Bootstrap";

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var occurredAt = DateTime.UtcNow;
        var organization = await EnsureOrganizationAsync(occurredAt, cancellationToken);
        var permissions = await EnsurePermissionsAsync(cancellationToken);
        var role = await EnsureAdministratorRoleAsync(occurredAt, cancellationToken);
        var organizationAdminRole = await EnsureOrganizationAdminRoleAsync(occurredAt, cancellationToken);
        var supervisorRole = await EnsureOperationalRoleAsync("ORG_SUPERVISOR", "Supervisor operativo", occurredAt, cancellationToken);
        var operatorRole = await EnsureOperationalRoleAsync("ORG_OPERATOR", "Operador", occurredAt, cancellationToken);
        var viewerRole = await EnsureOperationalRoleAsync("ORG_VIEWER", "Consulta operativa", occurredAt, cancellationToken);
        await EnsureRolePermissionsAsync(role, permissions, cancellationToken);
        await EnsureRolePermissionsAsync(organizationAdminRole, permissions.Where(IsOrganizationAdminPermission).ToArray(), cancellationToken);
        await EnsureRolePermissionsAsync(supervisorRole, permissions.Where(IsSupervisorPermission).ToArray(), cancellationToken);
        await EnsureRolePermissionsAsync(operatorRole, permissions.Where(IsOperatorPermission).ToArray(), cancellationToken);
        await EnsureRolePermissionsAsync(viewerRole, permissions.Where(IsViewerPermission).ToArray(), cancellationToken);
        var user = await EnsureAdministratorUserAsync(occurredAt, cancellationToken);
        var membership = await EnsureMembershipAsync(user, organization, occurredAt, cancellationToken);
        await EnsureUserRoleAsync(user, role, membership, occurredAt, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        SecuritySeedLog.Completed(logger, user.Email);
    }

    private async Task<Organization> EnsureOrganizationAsync(
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var organization = await dbContext.Organizations
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(item => item.CodeOrganization == "GESTIA", cancellationToken);

        if (organization is not null)
        {
            return organization;
        }

        organization = Organization.Create(
            "GESTIA",
            "GestIA Operadora Local",
            null,
            SeedActorId,
            SeedActorName,
            occurredAt);
        await dbContext.Organizations.AddAsync(organization, cancellationToken);
        await catalogDefaults.StageAsync(organization.IdOrganization, cancellationToken);
        return organization;
    }

    private async Task<IReadOnlyList<Permission>> EnsurePermissionsAsync(CancellationToken cancellationToken)
    {
        var definitions = new[]
        {
            (SecurityPermissions.PlatformAdmin, "Plataforma", "Administrar plataforma local"),
            (SecurityPermissions.OrganizationsRead, "Organizaciones", "Consultar organizaciones"),
            (SecurityPermissions.OrganizationsWrite, "Organizaciones", "Administrar organizaciones"),
            (SecurityPermissions.UsersRead, "Usuarios", "Consultar usuarios de la organización"),
            (SecurityPermissions.UsersWrite, "Usuarios", "Administrar usuarios de la organización"),
            (SecurityPermissions.ClientsRead, "Clientes", "Consultar clientes"),
            (SecurityPermissions.ClientsWrite, "Clientes", "Administrar clientes"),
            (SecurityPermissions.DocumentsRead, "Documentos", "Consultar documentos de clientes, servicios y personal"),
            (SecurityPermissions.DocumentsWrite, "Documentos", "Administrar documentos de clientes, servicios y personal"),
            (SecurityPermissions.DocumentsSensitiveRead, "Documentos", "Consultar documentos sensibles dentro de la organizacion autorizada"),
            (SecurityPermissions.DocumentsSensitiveWrite, "Documentos", "Administrar documentos sensibles dentro de la organizacion autorizada"),
            (SecurityPermissions.CatalogsRead, "Catálogos", "Consultar catálogos y reglas de elegibilidad"),
            (SecurityPermissions.CatalogsWrite, "Catálogos", "Administrar catálogos y reglas de elegibilidad"),
            (SecurityPermissions.WorkforceRead, "Personal", "Consultar personal operativo"),
            (SecurityPermissions.WorkforceWrite, "Personal", "Administrar personal operativo"),
            (SecurityPermissions.PlanningRead, "Planeación", "Consultar posiciones y turnos"),
            (SecurityPermissions.PlanningWrite, "Planeación", "Administrar posiciones y turnos"),
            (SecurityPermissions.OperationsRead, "Operación", "Consultar asistencia, incidencias y coberturas"),
            (SecurityPermissions.OperationsWrite, "Operación", "Administrar asistencia, incidencias y coberturas"),
            (SecurityPermissions.ReportsRead, "Reportes", "Consultar reportes operativos"),
            (SecurityPermissions.AuditRead, "Auditoría", "Consultar trazabilidad de cambios"),
            (SecurityPermissions.RequestsRead, "Solicitudes", "Consultar solicitudes operativas"),
            (SecurityPermissions.RequestsWrite, "Solicitudes", "Administrar solicitudes operativas")
        };

        var result = new List<Permission>(definitions.Length);

        foreach (var (code, module, description) in definitions)
        {
            var permission = await dbContext.Permissions
                .SingleOrDefaultAsync(item => item.CodePermission == code, cancellationToken);

            if (permission is null)
            {
                permission = Permission.Create(code, module, description);
                await dbContext.Permissions.AddAsync(permission, cancellationToken);
            }

            result.Add(permission);
        }

        return result;
    }

    private async Task<Role> EnsureAdministratorRoleAsync(
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var role = await dbContext.Roles
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(item => item.CodeRole == "ADMINISTRATOR", cancellationToken);

        if (role is not null)
        {
            return role;
        }

        role = Role.CreateSystem("ADMINISTRATOR", "Administrador", SeedActorId, SeedActorName, occurredAt);
        await dbContext.Roles.AddAsync(role, cancellationToken);
        return role;
    }

    private async Task<Role> EnsureOrganizationAdminRoleAsync(
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var role = await dbContext.Roles
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(item => item.CodeRole == "ORGANIZATION_ADMIN", cancellationToken);

        if (role is not null)
        {
            return role;
        }

        role = Role.CreateSystem("ORGANIZATION_ADMIN", "Admin de organización", SeedActorId, SeedActorName, occurredAt);
        await dbContext.Roles.AddAsync(role, cancellationToken);
        return role;
    }

    private async Task<Role> EnsureOperationalRoleAsync(
        string codeRole,
        string name,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var role = await dbContext.Roles
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(item => item.CodeRole == codeRole, cancellationToken);

        if (role is not null)
        {
            return role;
        }

        role = Role.CreateSystem(codeRole, name, SeedActorId, SeedActorName, occurredAt);
        await dbContext.Roles.AddAsync(role, cancellationToken);
        return role;
    }

    private async Task EnsureRolePermissionsAsync(
        Role role,
        IReadOnlyList<Permission> permissions,
        CancellationToken cancellationToken)
    {
        foreach (var permission in permissions)
        {
            var exists = await dbContext.RolePermissions.AnyAsync(
                item => item.IdRole == role.IdRole && item.IdPermission == permission.IdPermission,
                cancellationToken);

            if (!exists)
            {
                await dbContext.RolePermissions.AddAsync(
                    RolePermission.Create(role.IdRole, permission.IdPermission),
                    cancellationToken);
            }
        }
    }

    private static bool IsOrganizationAdminPermission(Permission permission) =>
        permission.CodePermission != SecurityPermissions.PlatformAdmin &&
        permission.CodePermission != SecurityPermissions.OrganizationsWrite;

    private static bool IsSupervisorPermission(Permission permission) =>
        permission.CodePermission is SecurityPermissions.ClientsRead
            or SecurityPermissions.DocumentsRead
            or SecurityPermissions.DocumentsWrite
            or SecurityPermissions.CatalogsRead
            or SecurityPermissions.WorkforceRead
            or SecurityPermissions.WorkforceWrite
            or SecurityPermissions.PlanningRead
            or SecurityPermissions.PlanningWrite
            or SecurityPermissions.OperationsRead
            or SecurityPermissions.OperationsWrite
            or SecurityPermissions.RequestsRead
            or SecurityPermissions.RequestsWrite
            or SecurityPermissions.ReportsRead
            or SecurityPermissions.AuditRead;

    private static bool IsOperatorPermission(Permission permission) =>
        permission.CodePermission is SecurityPermissions.ClientsRead
            or SecurityPermissions.DocumentsRead
            or SecurityPermissions.CatalogsRead
            or SecurityPermissions.WorkforceRead
            or SecurityPermissions.PlanningRead
            or SecurityPermissions.OperationsRead
            or SecurityPermissions.OperationsWrite
            or SecurityPermissions.RequestsRead
            or SecurityPermissions.RequestsWrite
            or SecurityPermissions.ReportsRead;

    private static bool IsViewerPermission(Permission permission) =>
        permission.CodePermission is SecurityPermissions.ClientsRead
            or SecurityPermissions.DocumentsRead
            or SecurityPermissions.CatalogsRead
            or SecurityPermissions.WorkforceRead
            or SecurityPermissions.PlanningRead
            or SecurityPermissions.OperationsRead
            or SecurityPermissions.RequestsRead
            or SecurityPermissions.ReportsRead;

    private async Task<User> EnsureAdministratorUserAsync(
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var email = configuration["BootstrapAdmin:Email"] ?? "admin@gestia.local";
        var password = configuration["BootstrapAdmin:Password"] ?? "GestIA.Local.2026!";
        var normalizedEmail = User.NormalizeEmail(email);
        var user = await dbContext.Users
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(item => item.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user is not null)
        {
            return user;
        }

        var passwordHash = passwordHashService.Hash(password);
        user = User.Create(
            email,
            "Administrador GestIA",
            passwordHash.Hash,
            passwordHash.Salt,
            passwordHash.Iterations,
            SeedActorId,
            SeedActorName,
            occurredAt);
        await dbContext.Users.AddAsync(user, cancellationToken);
        SecuritySeedLog.AdminCreated(logger, email);
        return user;
    }

    private async Task<OrganizationMembership> EnsureMembershipAsync(
        User user,
        Organization organization,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var membership = await dbContext.OrganizationMemberships
            .IgnoreQueryFilters(["Active"])
            .SingleOrDefaultAsync(
                item => item.IdUser == user.IdUser && item.IdOrganization == organization.IdOrganization,
                cancellationToken);

        if (membership is not null)
        {
            return membership;
        }

        membership = OrganizationMembership.Create(
            user.IdUser,
            organization.IdOrganization,
            "Administrador local",
            SeedActorId,
            SeedActorName,
            occurredAt);
        await dbContext.OrganizationMemberships.AddAsync(membership, cancellationToken);
        return membership;
    }

    private async Task EnsureUserRoleAsync(
        User user,
        Role role,
        OrganizationMembership membership,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var exists = await dbContext.UserRoles
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                item =>
                    item.IdUser == user.IdUser &&
                    item.IdRole == role.IdRole &&
                    item.IdOrganizationMembership == membership.IdOrganizationMembership,
                cancellationToken);

        if (!exists)
        {
            await dbContext.UserRoles.AddAsync(
                UserRole.Create(
                    user.IdUser,
                    role.IdRole,
                    membership.IdOrganizationMembership,
                    SeedActorId,
                    SeedActorName,
                    occurredAt),
                cancellationToken);
        }
    }
}

internal static partial class SecuritySeedLog
{
    [LoggerMessage(
        EventId = 3001,
        Level = LogLevel.Information,
        Message = "Security seed completed for administrator {Email}.")]
    public static partial void Completed(ILogger logger, string email);

    [LoggerMessage(
        EventId = 3002,
        Level = LogLevel.Warning,
        Message = "Local administrator {Email} was created. Change BootstrapAdmin__Password outside local MVP environments.")]
    public static partial void AdminCreated(ILogger logger, string email);
}
