using GestIA.Api.Security;
using GestIA.Application.Scheduling;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class SchedulingEndpoints
{
    public static IEndpointRouteBuilder MapSchedulingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var versionGroup = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/services/{idService:guid}/schedule-versions")
            .WithTags("Scheduling");

        versionGroup.MapGet("", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListScheduleVersionsAsync(organizationId, idClient, idService, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListScheduleVersions");

        versionGroup.MapPost("", async (
            Guid idClient,
            Guid idService,
            CreateScheduleVersionRequest request,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateScheduleVersionAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/schedule-versions/{result.IdScheduleVersion}",
                result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("CreateScheduleVersion");

        versionGroup.MapPut("/{idScheduleVersion:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idScheduleVersion,
            UpdateScheduleVersionRequest request,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateScheduleVersionAsync(
                idScheduleVersion,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("UpdateScheduleVersion");

        versionGroup.MapPost("/{idScheduleVersion:guid}/publish", async (
            Guid idClient,
            Guid idService,
            Guid idScheduleVersion,
            Guid organizationId,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.PublishScheduleVersionAsync(
                organizationId,
                idClient,
                idService,
                idScheduleVersion,
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("PublishScheduleVersion");

        var shiftGroup = versionGroup.MapGroup("/{idScheduleVersion:guid}/shifts");

        shiftGroup.MapGet("", async (
            Guid idClient,
            Guid idService,
            Guid idScheduleVersion,
            Guid organizationId,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListScheduledShiftsAsync(
                organizationId,
                idClient,
                idService,
                idScheduleVersion,
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListScheduledShifts");

        shiftGroup.MapPost("", async (
            Guid idClient,
            Guid idService,
            Guid idScheduleVersion,
            CreateScheduledShiftRequest request,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateScheduledShiftAsync(
                request with { IdClient = idClient, IdService = idService, IdScheduleVersion = idScheduleVersion },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/schedule-versions/{idScheduleVersion}/shifts/{result.IdScheduledShift}",
                result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("CreateScheduledShift");

        shiftGroup.MapPut("/{idScheduledShift:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idScheduleVersion,
            Guid idScheduledShift,
            UpdateScheduledShiftRequest request,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateScheduledShiftAsync(
                idScheduledShift,
                request with { IdClient = idClient, IdService = idService, IdScheduleVersion = idScheduleVersion },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("UpdateScheduledShift");

        shiftGroup.MapDelete("/{idScheduledShift:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idScheduleVersion,
            Guid idScheduledShift,
            Guid organizationId,
            ISchedulingService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateScheduledShiftAsync(
                organizationId,
                idClient,
                idService,
                idScheduleVersion,
                idScheduledShift,
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.PlanningWrite)
            .WithName("DeactivateScheduledShift");

        return endpoints;
    }
}
