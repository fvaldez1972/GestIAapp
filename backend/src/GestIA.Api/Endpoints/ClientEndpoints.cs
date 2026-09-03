using GestIA.Api.Security;
using GestIA.Application.Clients;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class ClientEndpoints
{
    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/clients")
            .WithTags("Clients");

        group.MapGet("", async (
            HttpContext context,
            Guid organizationId,
            string? search,
            int? page,
            int? pageSize,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ListAsync(
                new ClientListQuery(
                    organizationId,
                    search,
                    page ?? 1,
                    pageSize ?? 20),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListClients");

        group.MapGet("/{idClient:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid organizationId,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var client = await service.GetAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(client);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("GetClient");

        group.MapPost("", async (
            HttpContext context,
            CreateClientRequest request,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var client = await service.CreateAsync(request, cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{client.IdClient}?organizationId={client.IdOrganization}",
                client);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateClient");

        group.MapPut("/{idClient:guid}", async (
            HttpContext context,
            Guid idClient,
            UpdateClientRequest request,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var client = await service.UpdateAsync(idClient, request, cancellationToken);
            return Results.Ok(client);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateClient");

        group.MapDelete("/{idClient:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid organizationId,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateAsync(organizationId, idClient, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateClient");

        return endpoints;
    }
}
