using GestIA.Application.Common;
using GestIA.Application.Security;

namespace GestIA.Api.Security;

/// <summary>
/// Decide si el actor de la petición puede operar sobre la organización solicitada.
///
/// Hay exactamente dos reglas, y son deliberadamente distintas:
///
/// <list type="bullet">
/// <item><b>Admin de organización y roles operativos.</b> Sólo las organizaciones donde el
/// usuario tiene membresía, que viajan como claims <c>organization</c> del token. Esta regla
/// es el aislamiento entre organizaciones y no cambia nunca sin una decisión explícita.</item>
/// <item><b>Super admin.</b> Cualquier organización. El alcance lo da el permiso
/// <c>PLATFORM.ADMIN</c> por sí solo.</item>
/// </list>
///
/// La rama de super admin se autoriza de forma explícita y no por caída al caso general:
/// los claims <c>organization</c> salen de <c>OrganizationMemberships</c>, y el super admin
/// sólo tiene membresía en su propia organización, así que el caso general lo dejaría
/// encerrado ahí.
///
/// Nota sobre el alcance de esta comprobación: no existe noción de servidor de "en qué
/// organización está parado" el super admin. La organización activa es una selección de la
/// interfaz que viaja en cada petición; aquí sólo se valida que tenga derecho a pedirla.
/// </summary>
public static class OrganizationAccessGuard
{
    /// <summary>
    /// Autoriza la petición y, si pasa, fija la organización en
    /// <see cref="IOrganizationContext"/>. Las dos cosas van juntas a propósito: el filtro de
    /// consulta usa exactamente el identificador que se acaba de validar, así que no existe la
    /// posibilidad de consultar una organización distinta de la autorizada.
    /// </summary>
    public static IResult? ForbidIfUnauthorized(HttpContext context, Guid organizationId)
    {
        if (CanAccess(context, organizationId))
        {
            context.RequestServices.GetRequiredService<IOrganizationContext>().SetAuthorizedOrganization(organizationId);
            return null;
        }

        return Results.Problem(
            title: "Sin acceso a organización",
            detail: "Tu usuario no tiene acceso a la organización solicitada.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    public static bool CanAccess(HttpContext context, Guid organizationId)
    {
        if (IsPlatformAdmin(context))
        {
            return true;
        }

        return UserOrganizationIds(context).Contains(organizationId);
    }

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
