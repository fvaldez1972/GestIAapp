using System.Security.Claims;
using GestIA.Api.Security;
using GestIA.Application.Security;
using Microsoft.AspNetCore.Http;

namespace GestIA.IntegrationTests;

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
    }

    [Fact]
    public void OrganizationAdminCannotAccessAnotherOrganization()
    {
        var context = CreateContext(
            permissions: [SecurityPermissions.ClientsRead],
            organizations: [BktOrganizationId]);

        Assert.False(OrganizationAccessGuard.CanAccess(context, OtherOrganizationId));
        Assert.NotNull(OrganizationAccessGuard.ForbidIfUnauthorized(context, OtherOrganizationId));
    }

    [Fact]
    public void PlatformAdminCanAccessAnyOrganization()
    {
        var context = CreateContext(
            permissions: [SecurityPermissions.PlatformAdmin],
            organizations: [BktOrganizationId]);

        Assert.True(OrganizationAccessGuard.CanAccess(context, OtherOrganizationId));
        Assert.Null(OrganizationAccessGuard.ForbidIfUnauthorized(context, OtherOrganizationId));
    }

    private static DefaultHttpContext CreateContext(
        IEnumerable<string> permissions,
        IEnumerable<Guid> organizations)
    {
        var claims = permissions
            .Select(permission => new Claim("permission", permission))
            .Concat(organizations.Select(organization => new Claim("organization", organization.ToString())));

        return new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "GestIATest"))
        };
    }
}
