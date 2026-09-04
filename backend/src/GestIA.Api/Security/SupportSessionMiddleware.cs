using GestIA.Application.Security;
using GestIA.Application.Support;

namespace GestIA.Api.Security;

public sealed class SupportSessionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ISupportSessionService service)
    {
        if (context.User.HasClaim("permission", SecurityPermissions.PlatformAdmin) &&
            context.Request.Headers.TryGetValue(SupportSessionContext.HeaderName, out var headerValue))
        {
            if (!Guid.TryParse(headerValue.ToString(), out var idSupportSession) ||
                await service.ValidateAsync(idSupportSession, context.RequestAborted) is not { } session)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    title = "Sesión de soporte inválida",
                    detail = "Inicia nuevamente el modo soporte para acceder a datos de la organización.",
                    status = StatusCodes.Status403Forbidden
                }, context.RequestAborted);
                return;
            }

            context.Items[SupportSessionContext.ItemKey] = session;
        }

        await next(context);
    }
}
