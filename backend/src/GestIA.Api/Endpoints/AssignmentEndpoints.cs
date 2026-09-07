using GestIA.Api.Security;
using GestIA.Application.Assignments;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class AssignmentEndpoints
{
    public static IEndpointRouteBuilder MapAssignmentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/services/{idService:guid}/assignments")
            .WithTags("Assignments");

        group.MapGet("", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ListAssignmentsAsync(organizationId, idClient, idService, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListServiceAssignments");

        group.MapPost("", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            CreateServiceAssignmentRequest request,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateAssignmentAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/assignments/{result.IdServiceAssignment}",
                result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("CreateServiceAssignment");

        group.MapPut("/{idServiceAssignment:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            Guid idServiceAssignment,
            UpdateServiceAssignmentRequest request,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateAssignmentAsync(
                idServiceAssignment,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("UpdateServiceAssignment");

        group.MapDelete("/{idServiceAssignment:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            Guid idServiceAssignment,
            Guid organizationId,
            string? rowVersion,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateAssignmentAsync(
                organizationId,
                idClient,
                idService,
                idServiceAssignment,
                ParseRowVersion(rowVersion),
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("DeactivateServiceAssignment");

        return endpoints;
    }

    /// <summary>
    /// El token de concurrencia llega en la consulta y no en el cuerpo, porque un DELETE no lleva
    /// cuerpo. Lo correcto en HTTP seria el encabezado <c>If-Match</c>; se eligio el parametro por
    /// consistencia con el resto de esta API, que ya pasa <c>organizationId</c> asi.
    ///
    /// <b>Deuda menor anotada.</b> Un token mal formado se trata como ausente: no comprueba nada,
    /// que es el mismo comportamiento que no mandarlo, y nunca hace fallar la peticion por una
    /// razon que el usuario no puede entender.
    /// </summary>
    private static byte[]? ParseRowVersion(string? rowVersion)
    {
        if (string.IsNullOrWhiteSpace(rowVersion))
        {
            return null;
        }

        return Convert.TryFromBase64String(rowVersion, new byte[rowVersion.Length], out _)
            ? Convert.FromBase64String(rowVersion)
            : null;
    }
}
