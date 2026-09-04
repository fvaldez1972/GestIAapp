using GestIA.Api.Security;
using GestIA.Application.Security;
using GestIA.Application.Support;

namespace GestIA.Api.Endpoints;

public static class SupportSessionEndpoints
{
    public static IEndpointRouteBuilder MapSupportSessionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/support-sessions")
            .WithTags("Support");

        group.MapGet("/current", async (
            ISupportSessionService service,
            CancellationToken cancellationToken) =>
        {
            var session = await service.GetCurrentAsync(cancellationToken);
            return session is null ? Results.NoContent() : Results.Ok(session);
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("GetCurrentSupportSession");

        group.MapGet("", async (
            ISupportSessionService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ListRecentAsync(cancellationToken)))
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ListSupportSessions");

        group.MapPost("", async (
            StartSupportSessionRequest request,
            ISupportSessionService service,
            CancellationToken cancellationToken) =>
        {
            var session = await service.StartAsync(request, cancellationToken);
            return Results.Created($"/api/v1/support-sessions/{session.IdSupportSession}", session);
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("StartSupportSession");

        group.MapDelete("/{idSupportSession:guid}", async (
            Guid idSupportSession,
            ISupportSessionService service,
            CancellationToken cancellationToken) =>
        {
            await service.EndAsync(idSupportSession, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("EndSupportSession");

        return endpoints;
    }
}
