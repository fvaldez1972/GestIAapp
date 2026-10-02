using GestIA.Api.Security;
using GestIA.Application.Security;
using GestIA.Application.Workforce;

namespace GestIA.Api.Endpoints;

public static class AdministrativeIncidentEndpoints
{
    public static IEndpointRouteBuilder MapAdministrativeIncidentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/employees/{idEmployee:guid}/administrative-incidents")
            .WithTags("Administrative Incidents");

        group.MapGet("", async (
            HttpContext context,
            Guid idEmployee,
            Guid organizationId,
            IAdministrativeIncidentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var incidents = await service.ListAsync(organizationId, idEmployee, cancellationToken);
            return Results.Ok(incidents);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("ListAdministrativeIncidents");

        group.MapPost("", async (
            HttpContext context,
            Guid idEmployee,
            CreateAdministrativeIncidentRequest request,
            IAdministrativeIncidentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var incident = await service.CreateAsync(request with { IdEmployee = idEmployee }, cancellationToken);
            return Results.Created(
                $"/api/v1/employees/{idEmployee}/administrative-incidents/{incident.IdAdministrativeIncident}",
                incident);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("CreateAdministrativeIncident");

        group.MapPut("/{idAdministrativeIncident:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idAdministrativeIncident,
            UpdateAdministrativeIncidentRequest request,
            IAdministrativeIncidentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var incident = await service.UpdateAsync(
                idAdministrativeIncident,
                request with { IdEmployee = idEmployee },
                cancellationToken);
            return Results.Ok(incident);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("UpdateAdministrativeIncident");

        group.MapDelete("/{idAdministrativeIncident:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idAdministrativeIncident,
            Guid organizationId,
            IAdministrativeIncidentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateAsync(organizationId, idEmployee, idAdministrativeIncident, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("DeactivateAdministrativeIncident");

        return endpoints;
    }
}
