using GestIA.Api.Security;
using GestIA.Application.Organizations;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class OrganizationEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/organizations")
            .WithTags("Organizations");

        group.MapGet("", async (
            HttpContext context,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            var organizations = await service.ListAsync(cancellationToken);
            return Results.Ok(FilterOrganizationsForUser(context, organizations));
        })
            .RequirePermission(SecurityPermissions.OrganizationsRead)
            .WithName("ListOrganizations");

        group.MapGet("/governance", async (
            IOrganizationService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ListGovernanceAsync(cancellationToken)))
            .RequirePermission(SecurityPermissions.PlatformAdmin)
            .WithName("ListOrganizationGovernance");

        group.MapGet("/{idOrganization:guid}", async (
            HttpContext context,
            Guid idOrganization,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            if (!CanAccessOrganization(context, idOrganization))
            {
                return Results.Problem(
                    title: "Sin acceso a organización",
                    detail: "Tu usuario no tiene acceso a la organización solicitada.",
                    statusCode: StatusCodes.Status403Forbidden);
            }

            var organization = await service.GetAsync(idOrganization, cancellationToken);
            return Results.Ok(organization);
        })
            .RequirePermission(SecurityPermissions.OrganizationsRead)
            .WithName("GetOrganization");

        group.MapPost("", async (
            CreateOrganizationRequest request,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            var organization = await service.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/v1/organizations/{organization.IdOrganization}", organization);
        })
            .RequirePermission(SecurityPermissions.OrganizationsWrite)
            .WithName("CreateOrganization");

        group.MapPost("/with-admin", async (
            CreateOrganizationWithAdminRequest request,
            IOrganizationProvisioningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateWithAdminAsync(request, cancellationToken);
            return Results.Created($"/api/v1/organizations/{result.Organization.IdOrganization}", result);
        })
            .RequirePermission(SecurityPermissions.OrganizationsWrite)
            .WithName("CreateOrganizationWithAdmin");

        group.MapPut("/{idOrganization:guid}", async (
            Guid idOrganization,
            UpdateOrganizationRequest request,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            var organization = await service.UpdateAsync(idOrganization, request, cancellationToken);
            return Results.Ok(organization);
        })
            .RequirePermission(SecurityPermissions.OrganizationsWrite)
            .WithName("UpdateOrganization");

        group.MapDelete("/{idOrganization:guid}", async (
            Guid idOrganization,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateAsync(idOrganization, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.OrganizationsWrite)
            .WithName("DeactivateOrganization");

        group.MapPatch("/{idOrganization:guid}/activate", async (
            Guid idOrganization,
            IOrganizationService service,
            CancellationToken cancellationToken) =>
        {
            var organization = await service.ActivateAsync(idOrganization, cancellationToken);
            return Results.Ok(organization);
        })
            .RequirePermission(SecurityPermissions.OrganizationsWrite)
            .WithName("ActivateOrganization");

        return endpoints;
    }

    private static IReadOnlyList<OrganizationResponse> FilterOrganizationsForUser(
        HttpContext context,
        IReadOnlyList<OrganizationResponse> organizations)
    {
        if (IsPlatformAdmin(context))
        {
            return organizations;
        }

        var allowedOrganizations = UserOrganizationIds(context);
        return organizations
            .Where(organization => allowedOrganizations.Contains(organization.IdOrganization))
            .ToArray();
    }

    private static bool CanAccessOrganization(HttpContext context, Guid idOrganization) =>
        IsPlatformAdmin(context) || UserOrganizationIds(context).Contains(idOrganization);

    private static bool IsPlatformAdmin(HttpContext context) =>
        context.User.HasClaim("permission", SecurityPermissions.PlatformAdmin);

    private static HashSet<Guid> UserOrganizationIds(HttpContext context) =>
        context.User
            .FindAll("organization")
            .Select(claim => claim.Value)
            .Where(value => Guid.TryParse(value, out _))
            .Select(Guid.Parse)
            .ToHashSet();
}
