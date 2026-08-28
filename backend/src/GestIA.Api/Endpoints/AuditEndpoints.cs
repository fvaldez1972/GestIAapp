using GestIA.Api.Security;
using GestIA.Application.Audit;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class AuditEndpoints
{
    public static IEndpointRouteBuilder MapAuditEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/audit")
            .WithTags("Audit");

        group.MapGet("/events", async (
            Guid organizationId,
            string? entity,
            string? search,
            DateOnly? fromDate,
            DateOnly? toDate,
            int page,
            int pageSize,
            IAuditService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.SearchAsync(
                new AuditQuery(
                    organizationId,
                    entity,
                    search,
                    fromDate,
                    toDate,
                    page <= 0 ? 1 : page,
                    pageSize <= 0 ? 20 : pageSize),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.AuditRead)
            .WithName("ListAuditEvents");

        return endpoints;
    }
}
