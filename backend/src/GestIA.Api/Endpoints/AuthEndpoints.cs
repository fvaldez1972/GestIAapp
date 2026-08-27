using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/auth")
            .WithTags("Auth");

        group.MapPost("/login", async (
            LoginRequest request,
            IAuthenticationService service,
            CancellationToken cancellationToken) =>
        {
            var session = await service.LoginAsync(request, cancellationToken);
            return Results.Ok(session);
        }).WithName("Login");

        group.MapGet("/me", (HttpContext context) =>
        {
            if (context.User.Identity?.IsAuthenticated != true)
            {
                return Results.Problem(
                    title: "No autenticado",
                    detail: "Inicia sesión para continuar.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            return Results.Ok(new
            {
                idUser = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
                displayName = context.User.Identity.Name,
                email = context.User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value,
                permissions = context.User.FindAll("permission").Select(item => item.Value).OrderBy(item => item),
                organizations = context.User.FindAll("organization").Select(item => item.Value).OrderBy(item => item)
            });
        }).WithName("GetCurrentUser");

        return endpoints;
    }
}
