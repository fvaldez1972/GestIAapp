using GestIA.Application.Security;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GestIA.Api.Security;

public sealed class PermissionEndpointFilter(string permission) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var user = context.HttpContext.User;

        if (user.Identity?.IsAuthenticated != true)
        {
            return TypedResults.Problem(
                title: "No autenticado",
                detail: "Inicia sesión para continuar.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var hasPermission = user.HasClaim("permission", permission) ||
            user.HasClaim("permission", SecurityPermissions.PlatformAdmin);

        if (!hasPermission)
        {
            return TypedResults.Problem(
                title: "Sin permiso",
                detail: "Tu usuario no tiene permiso para esta operación.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        return await next(context);
    }
}
