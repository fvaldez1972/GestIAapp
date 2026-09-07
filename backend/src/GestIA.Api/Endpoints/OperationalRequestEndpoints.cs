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
            HttpContext context,
            Guid organizationId,
            OperationalRequestStatus? status,
            OperationalRequestType? requestType,
            string? search,
            int page,
            int pageSize,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

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
            HttpContext context,
            CreateOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/v1/requests/{result.IdOperationalRequest}", result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("CreateOperationalRequest");

        group.MapPut("/{idOperationalRequest:guid}", async (
            HttpContext context,
            Guid idOperationalRequest,
            UpdateOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("UpdateOperationalRequest");

        group.MapPatch("/{idOperationalRequest:guid}/status", async (
            HttpContext context,
            Guid idOperationalRequest,
            ChangeOperationalRequestStatusRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ChangeStatusAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("ChangeOperationalRequestStatus");

        group.MapPost("/{idOperationalRequest:guid}/execution-preview", async (
            HttpContext context,
            Guid idOperationalRequest,
            ExecuteOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.PreviewExecutionAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsRead)
            .WithName("PreviewOperationalRequestExecution");

        group.MapPost("/{idOperationalRequest:guid}/execute", async (
            HttpContext context,
            Guid idOperationalRequest,
            ExecuteOperationalRequestRequest request,
            IOperationalRequestService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ExecuteAsync(idOperationalRequest, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.RequestsWrite)
            .WithName("ExecuteOperationalRequest");

        return endpoints;
    }
}
