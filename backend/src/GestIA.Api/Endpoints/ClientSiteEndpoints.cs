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
            Guid idClient,
            Guid organizationId,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            var sites = await service.ListAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(sites);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListClientSites");

        group.MapPost("", async (
            Guid idClient,
            CreateClientSiteRequest request,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            var site = await service.CreateAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/sites/{site.IdClientSite}", site);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateClientSite");

        group.MapPut("/{idClientSite:guid}", async (
            Guid idClient,
            Guid idClientSite,
            UpdateClientSiteRequest request,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            var site = await service.UpdateAsync(
                idClientSite,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(site);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateClientSite");

        group.MapDelete("/{idClientSite:guid}", async (
            Guid idClient,
            Guid idClientSite,
            Guid organizationId,
            IClientSiteService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateAsync(organizationId, idClient, idClientSite, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateClientSite");

        return endpoints;
    }
}
