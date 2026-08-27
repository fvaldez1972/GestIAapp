using GestIA.Api.Security;
using GestIA.Application.Clients;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class ClientContactEndpoints
{
    public static IEndpointRouteBuilder MapClientContactEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/contacts")
            .WithTags("Client Contacts");

        group.MapGet("", async (
            Guid idClient,
            Guid organizationId,
            IClientContactService service,
            CancellationToken cancellationToken) =>
        {
            var contacts = await service.ListAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(contacts);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListClientContacts");

        group.MapPost("", async (
            Guid idClient,
            CreateClientContactRequest request,
            IClientContactService service,
            CancellationToken cancellationToken) =>
        {
            var contact = await service.CreateAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/contacts/{contact.IdClientContact}", contact);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateClientContact");

        group.MapPut("/{idClientContact:guid}", async (
            Guid idClient,
            Guid idClientContact,
            UpdateClientContactRequest request,
            IClientContactService service,
            CancellationToken cancellationToken) =>
        {
            var contact = await service.UpdateAsync(
                idClientContact,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(contact);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateClientContact");

        group.MapDelete("/{idClientContact:guid}", async (
            Guid idClient,
            Guid idClientContact,
            Guid organizationId,
            IClientContactService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateAsync(organizationId, idClient, idClientContact, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateClientContact");

        return endpoints;
    }
}
