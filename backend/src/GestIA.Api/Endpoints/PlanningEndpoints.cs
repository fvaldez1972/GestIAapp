using GestIA.Api.Security;
using GestIA.Application.Planning;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class PlanningEndpoints
{
    public static IEndpointRouteBuilder MapPlanningEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var positionGroup = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/services/{idService:guid}/positions")
            .WithTags("Planning");

        positionGroup.MapGet("", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListPositionsAsync(organizationId, idClient, idService, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListPositions");

        positionGroup.MapPost("", async (
            Guid idClient,
            Guid idService,
            CreatePositionRequest request,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreatePositionAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/services/{idService}/positions/{result.IdPosition}", result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("CreatePosition");

        positionGroup.MapPut("/{idPosition:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            UpdatePositionRequest request,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdatePositionAsync(
                idPosition,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("UpdatePosition");

        positionGroup.MapDelete("/{idPosition:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid organizationId,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivatePositionAsync(organizationId, idClient, idService, idPosition, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("DeactivatePosition");

        var patternGroup = positionGroup.MapGroup("/{idPosition:guid}/shift-patterns");

        patternGroup.MapGet("", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid organizationId,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListShiftPatternsAsync(
                organizationId,
                idClient,
                idService,
                idPosition,
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListShiftPatterns");

        patternGroup.MapPost("", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            CreateShiftPatternRequest request,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateShiftPatternAsync(
                request with { IdClient = idClient, IdService = idService, IdPosition = idPosition },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/positions/{idPosition}/shift-patterns/{result.IdShiftPattern}",
                result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("CreateShiftPattern");

        patternGroup.MapPut("/{idShiftPattern:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid idShiftPattern,
            UpdateShiftPatternRequest request,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateShiftPatternAsync(
                idShiftPattern,
                request with { IdClient = idClient, IdService = idService, IdPosition = idPosition },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("UpdateShiftPattern");

        patternGroup.MapDelete("/{idShiftPattern:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid idShiftPattern,
            Guid organizationId,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateShiftPatternAsync(
                organizationId,
                idClient,
                idService,
                idPosition,
                idShiftPattern,
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("DeactivateShiftPattern");

        var segmentGroup = patternGroup.MapGroup("/{idShiftPattern:guid}/segments");

        segmentGroup.MapGet("", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid idShiftPattern,
            Guid organizationId,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListShiftSegmentsAsync(
                organizationId,
                idClient,
                idService,
                idPosition,
                idShiftPattern,
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListShiftSegments");

        segmentGroup.MapPost("", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid idShiftPattern,
            CreateShiftSegmentRequest request,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateShiftSegmentAsync(
                request with { IdClient = idClient, IdService = idService, IdPosition = idPosition, IdShiftPattern = idShiftPattern },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/positions/{idPosition}/shift-patterns/{idShiftPattern}/segments/{result.IdShiftSegment}",
                result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("CreateShiftSegment");

        segmentGroup.MapPut("/{idShiftSegment:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid idShiftPattern,
            Guid idShiftSegment,
            UpdateShiftSegmentRequest request,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateShiftSegmentAsync(
                idShiftSegment,
                request with { IdClient = idClient, IdService = idService, IdPosition = idPosition, IdShiftPattern = idShiftPattern },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("UpdateShiftSegment");

        segmentGroup.MapDelete("/{idShiftSegment:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idPosition,
            Guid idShiftPattern,
            Guid idShiftSegment,
            Guid organizationId,
            IPlanningService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateShiftSegmentAsync(
                organizationId,
                idClient,
                idService,
                idPosition,
                idShiftPattern,
                idShiftSegment,
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("DeactivateShiftSegment");

        return endpoints;
    }
}
