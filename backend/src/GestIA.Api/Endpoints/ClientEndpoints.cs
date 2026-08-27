using GestIA.Application.Clients;

namespace GestIA.Api.Endpoints;

public static class ClientEndpoints
{
    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/clients")
            .WithTags("Clients");

        group.MapGet("", async (
            Guid organizationId,
            string? search,
            int? page,
            int? pageSize,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListAsync(
                new ClientListQuery(
                    organizationId,
                    search,
                    page ?? 1,
                    pageSize ?? 20),
                cancellationToken);
            return Results.Ok(result);
        }).WithName("ListClients");

        group.MapGet("/{idClient:guid}", async (
            Guid idClient,
            Guid organizationId,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            var client = await service.GetAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(client);
        }).WithName("GetClient");

        group.MapPost("", async (
            CreateClientRequest request,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            var client = await service.CreateAsync(request, cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{client.IdClient}?organizationId={client.IdOrganization}",
                client);
        }).WithName("CreateClient");

        group.MapPut("/{idClient:guid}", async (
            Guid idClient,
            UpdateClientRequest request,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            var client = await service.UpdateAsync(idClient, request, cancellationToken);
            return Results.Ok(client);
        }).WithName("UpdateClient");

        group.MapDelete("/{idClient:guid}", async (
            Guid idClient,
            Guid organizationId,
            IClientService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateAsync(organizationId, idClient, cancellationToken);
            return Results.NoContent();
        }).WithName("DeactivateClient");

        return endpoints;
    }
}
