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
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListAssignmentsAsync(organizationId, idClient, idService, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListServiceAssignments");

        group.MapPost("", async (
            Guid idClient,
            Guid idService,
            CreateServiceAssignmentRequest request,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
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
            Guid idClient,
            Guid idService,
            Guid idServiceAssignment,
            UpdateServiceAssignmentRequest request,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateAssignmentAsync(
                idServiceAssignment,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("UpdateServiceAssignment");

        group.MapDelete("/{idServiceAssignment:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idServiceAssignment,
            Guid organizationId,
            IAssignmentService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateAssignmentAsync(
                organizationId,
                idClient,
                idService,
                idServiceAssignment,
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("DeactivateServiceAssignment");

        return endpoints;
    }
}
