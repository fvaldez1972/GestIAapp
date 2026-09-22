using GestIA.Api.Security;
using GestIA.Application.Clients;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class ClientZoneEndpoints
{
    public static IEndpointRouteBuilder MapClientZoneEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/zones")
            .WithTags("Client Zones");

        group.MapGet("", async (
            HttpContext context,
            Guid idClient,
            Guid organizationId,
            IClientZoneService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var zones = await service.ListAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(zones);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListClientZones");

        group.MapPost("", async (
            HttpContext context,
            Guid idClient,
            CreateClientZoneRequest request,
            IClientZoneService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var zone = await service.CreateAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/zones/{zone.IdClientZone}", zone);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateClientZone");

        group.MapPut("/{idClientZone:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idClientZone,
            UpdateClientZoneRequest request,
            IClientZoneService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var zone = await service.UpdateAsync(
                idClientZone,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(zone);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateClientZone");

        group.MapDelete("/{idClientZone:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idClientZone,
            Guid organizationId,
            IClientZoneService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateAsync(organizationId, idClient, idClientZone, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateClientZone");

        return endpoints;
    }
}
