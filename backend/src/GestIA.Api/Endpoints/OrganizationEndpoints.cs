using GestIA.Application.Organizations;

namespace GestIA.Api.Endpoints;

public static class OrganizationEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/organizations")
            .WithTags("Organizations");

        group.MapGet("", async (
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            var organizations = await service.ListAsync(cancellationToken);
            return Results.Ok(organizations);
        }).WithName("ListOrganizations");

        group.MapGet("/{idOrganization:guid}", async (
            Guid idOrganization,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            var organization = await service.GetAsync(idOrganization, cancellationToken);
            return Results.Ok(organization);
        }).WithName("GetOrganization");

        group.MapPost("", async (
            CreateOrganizationRequest request,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            var organization = await service.CreateAsync(request, cancellationToken);
            return Results.Created(
                $"/api/v1/organizations/{organization.IdOrganization}",
                organization);
        }).WithName("CreateOrganization");

        return endpoints;
    }
}
