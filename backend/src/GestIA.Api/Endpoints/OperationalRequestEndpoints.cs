using GestIA.Api.Security;
using GestIA.Application.Requests;
using GestIA.Application.Security;
using GestIA.Domain.Requests;

namespace GestIA.Api.Endpoints;

public static class OperationalRequestEndpoints
{
    public static IEndpointRouteBuilder MapOperationalRequestEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/requests")
            .WithTags("Requests");

        group.MapGet("", async (
            Guid organizationId,
            OperationalRequestStatus? status,
            OperationalRequestType? requestType,
            string? search,
            int page,
            int pageSize,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListAsync(
                new OperationalRequestQuery(
                    organizationId,
                    status,
                    requestType,
                    search,
                    page <= 0 ? 1 : page,
                    pageSize <= 0 ? 20 : pageSize),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsRead)
            .WithName("ListOperationalRequests");

        group.MapPost("", async (
            CreateOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/v1/requests/{result.IdOperationalRequest}", result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("CreateOperationalRequest");

        group.MapPut("/{idOperationalRequest:guid}", async (
            Guid idOperationalRequest,
            UpdateOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("UpdateOperationalRequest");

        group.MapPatch("/{idOperationalRequest:guid}/status", async (
            Guid idOperationalRequest,
            ChangeOperationalRequestStatusRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ChangeStatusAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("ChangeOperationalRequestStatus");

        group.MapPost("/{idOperationalRequest:guid}/execution-preview", async (
            Guid idOperationalRequest,
            ExecuteOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.PreviewExecutionAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsRead)
            .WithName("PreviewOperationalRequestExecution");

        group.MapPost("/{idOperationalRequest:guid}/execute", async (
            Guid idOperationalRequest,
            ExecuteOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ExecuteAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("ExecuteOperationalRequest");

        return endpoints;
    }
}
