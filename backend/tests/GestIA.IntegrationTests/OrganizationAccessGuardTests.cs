using System.Security.Claims;
using GestIA.Api.Security;
using GestIA.Application.Common;
using GestIA.Application.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

/// <summary>
/// Las dos primeras pruebas son la red de seguridad del cambio que eliminó el modo soporte:
/// el aislamiento entre organizaciones para el admin de organización NO cambió, y estas
/// pruebas lo demuestran contra el guard nuevo.
/// </summary>
public sealed class OrganizationAccessGuardTests
{
    private static readonly Guid BktOrganizationId = Guid.Parse("31af45eb-ef8a-43ed-ad65-cea41fb8114c");
    private static readonly Guid OtherOrganizationId = Guid.Parse("caa71e02-dae6-4c01-a647-3c20ac7e0945");

    [Fact]
    public void OrganizationAdminCanAccessAssignedOrganization()
    {
        var context = CreateContext(
            permissions: [SecurityPermissions.ClientsRead],
            organizations: [BktOrganizationId]);

        Assert.True(OrganizationAccessGuard.CanAccess(context, BktOrganizationId));
        Assert.Null(OrganizationAccessGuard.ForbidIfUnauthorized(context, BktOrganizationId));

        // Autorizar y fijar la organización son el mismo acto: el filtro de consulta va a usar
        // exactamente el identificador que se acaba de validar.
        Assert.Equal(BktOrganizationId, AuthorizedOrganization(context));
    }

    [Fact]
    public void OrganizationAdminCannotAccessAnotherOrganization()
    {
        var context = CreateContext(
            permissions: [SecurityPermissions.ClientsRead],
            organizations: [BktOrganizationId]);

        Assert.False(OrganizationAccessGuard.CanAccess(context, OtherOrganizationId));
        Assert.NotNull(OrganizationAccessGuard.ForbidIfUnauthorized(context, OtherOrganizationId));

        // Denegar no deja nada fijado: sin organización, el filtro no devuelve filas.
        Assert.Null(AuthorizedOrganization(context));
    }

    /// <summary>
    /// Red de seguridad pedida al aprobar el cambio: un admin de organización con
    /// <c>CLIENTS.READ</c> sigue recibiendo 403 contra otra organización después de que el
    /// guard dejó de exigir sesión de soporte al super admin.
    /// </summary>
    [Fact]
    public void OrganizationAdminStillGetsForbiddenAgainstAnotherOrganization()
    {
        var context = CreateContext(
            permissions: [SecurityPermissions.ClientsRead, SecurityPermissions.ClientsWrite],
            organizations: [BktOrganizationId]);

        var result = OrganizationAccessGuard.ForbidIfUnauthorized(context, OtherOrganizationId);

        var problem = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, problem.StatusCode);
    }

    [Fact]
    public void PlatformAdminCanAccessAnyOrganization()
    {
        var context = CreateContext(
            permissions: [SecurityPermissions.PlatformAdmin],
            organizations: [BktOrganizationId]);

        Assert.True(OrganizationAccessGuard.CanAccess(context, BktOrganizationId));
        Assert.True(OrganizationAccessGuard.CanAccess(context, OtherOrganizationId));
        Assert.Null(OrganizationAccessGuard.ForbidIfUnauthorized(context, OtherOrganizationId));
    }

    /// <summary>
    /// El super admin se autoriza por permiso, no por membresía: sus claims
    /// <c>organization</c> salen de OrganizationMemberships y sólo contienen su propia
    /// organización, así que caer al caso general lo dejaría encerrado ahí.
    /// </summary>
    [Fact]
    public void PlatformAdminIsAuthorizedByPermissionNotByMembership()
    {
        var context = CreateContext(
            permissions: [SecurityPermissions.PlatformAdmin],
            organizations: []);

        Assert.True(OrganizationAccessGuard.CanAccess(context, OtherOrganizationId));
        Assert.Empty(OrganizationAccessGuard.UserOrganizationIds(context));
    }

    private static DefaultHttpContext CreateContext(
        IEnumerable<string> permissions,
        IEnumerable<Guid> organizations)
    {
        var claims = permissions
            .Select(permission => new Claim("permission", permission))
            .Concat(organizations.Select(organization => new Claim("organization", organization.ToString())));

        var services = new ServiceCollection()
            .AddScoped<IOrganizationContext>(_ => FixedOrganizationContext.None())
            .BuildServiceProvider();

        return new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "GestIATest")),
            RequestServices = services
        };
    }

    private static Guid? AuthorizedOrganization(HttpContext context) =>
        context.RequestServices.GetRequiredService<IOrganizationContext>().CurrentOrganizationId;
}
