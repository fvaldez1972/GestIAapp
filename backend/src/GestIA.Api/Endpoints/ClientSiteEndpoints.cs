using GestIA.Api.Security;
using GestIA.Application.Clients;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class ClientSiteEndpoints
{
    public static IEndpointRouteBuilder MapClientSiteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/sites")
            .WithTags("Client Sites");

        group.MapGet("", async (
            HttpContext context,
            Guid idClient,
            Guid organizationId,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var sites = await service.ListAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(sites);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListClientSites");

        group.MapPost("", async (
            HttpContext context,
            Guid idClient,
            CreateClientSiteRequest request,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var site = await service.CreateAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/sites/{site.IdClientSite}", site);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateClientSite");

        group.MapPut("/{idClientSite:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idClientSite,
            UpdateClientSiteRequest request,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var site = await service.UpdateAsync(
                idClientSite,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(site);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateClientSite");

        group.MapDelete("/{idClientSite:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idClientSite,
            Guid organizationId,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateAsync(organizationId, idClient, idClientSite, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateClientSite");

        return endpoints;
    }
}
