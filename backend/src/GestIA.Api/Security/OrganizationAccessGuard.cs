using GestIA.Application.Security;

namespace GestIA.Api.Security;

public static class OrganizationAccessGuard
{
    public static IResult? ForbidIfUnauthorized(HttpContext context, Guid organizationId)
    {
        if (CanAccess(context, organizationId))
        {
            return null;
        }

        return Results.Problem(
            title: "Sin acceso a organización",
            detail: "Tu usuario no tiene acceso a la organización solicitada.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    public static bool CanAccess(HttpContext context, Guid organizationId) =>
        IsPlatformAdmin(context) || UserOrganizationIds(context).Contains(organizationId);

    public static bool IsPlatformAdmin(HttpContext context) =>
        context.User.HasClaim("permission", SecurityPermissions.PlatformAdmin);

    public static HashSet<Guid> UserOrganizationIds(HttpContext context) =>
        context.User
            .FindAll("organization")
            .Select(claim => claim.Value)
            .Where(value => Guid.TryParse(value, out _))
            .Select(Guid.Parse)
            .ToHashSet();
}
