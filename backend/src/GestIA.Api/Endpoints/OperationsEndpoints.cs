using GestIA.Api.Security;
using GestIA.Application.Operations;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class OperationsEndpoints
{
    public static IEndpointRouteBuilder MapOperationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/services/{idService:guid}/operations")
            .WithTags("Operations");

        group.MapGet("/attendance", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            DateOnly? date,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListAttendanceAsync(
                new AttendanceQuery(organizationId, idClient, idService, date),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsRead)
            .WithName("ListAttendanceRecords");

        group.MapPost("/attendance", async (
            Guid idClient,
            Guid idService,
            UpsertAttendanceRequest request,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpsertAttendanceAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("UpsertAttendanceRecord");

        group.MapGet("/incidents", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListIncidentsAsync(organizationId, idClient, idService, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsRead)
            .WithName("ListIncidents");

        group.MapPost("/incidents", async (
            Guid idClient,
            Guid idService,
            CreateIncidentRequest request,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateIncidentAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/operations/incidents/{result.IdIncident}",
                result);
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("CreateIncident");

        group.MapPut("/incidents/{idIncident:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idIncident,
            UpdateIncidentRequest request,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateIncidentAsync(
                idIncident,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("UpdateIncident");

        group.MapGet("/coverages", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListCoveragesAsync(organizationId, idClient, idService, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsRead)
            .WithName("ListCoverages");

        group.MapPost("/coverages", async (
            Guid idClient,
            Guid idService,
            CreateCoverageRequest request,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateCoverageAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/operations/coverages/{result.IdCoverageRecord}",
                result);
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("CreateCoverage");

        group.MapPut("/coverages/{idCoverageRecord:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idCoverageRecord,
            UpdateCoverageRequest request,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateCoverageAsync(
                idCoverageRecord,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("UpdateCoverage");

        group.MapGet("/evidences", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            Guid? relatedRecordId,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListEvidencesAsync(
                organizationId,
                idClient,
                idService,
                relatedRecordId,
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsRead)
            .WithName("ListOperationEvidences");

        group.MapPost("/evidences", async (
            Guid idClient,
            Guid idService,
            OperationEvidenceInput request,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateEvidenceAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/operations/evidences/{result.IdOperationEvidence}",
                result);
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("CreateOperationEvidence");

        group.MapPut("/evidences/{idOperationEvidence:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idOperationEvidence,
            OperationEvidenceInput request,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateEvidenceAsync(
                idOperationEvidence,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("UpdateOperationEvidence");

        group.MapDelete("/evidences/{idOperationEvidence:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idOperationEvidence,
            Guid organizationId,
            IOperationsService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateEvidenceAsync(
                organizationId,
                idClient,
                idService,
                idOperationEvidence,
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("DeactivateOperationEvidence");

        return endpoints;
    }
}
