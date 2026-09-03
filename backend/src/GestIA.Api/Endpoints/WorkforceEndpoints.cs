using GestIA.Api.Security;
using GestIA.Application.Security;
using GestIA.Application.Workforce;
using GestIA.Domain.Workforce;

namespace GestIA.Api.Endpoints;

public static class WorkforceEndpoints
{
    public static IEndpointRouteBuilder MapWorkforceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/employees")
            .WithTags("Workforce");

        group.MapGet("", async (
            HttpContext context,
            Guid organizationId,
            string? search,
            EmployeeStatus? status,
            int page,
            int pageSize,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ListEmployeesAsync(
                new EmployeeQuery(organizationId, search, status, page <= 0 ? 1 : page, pageSize <= 0 ? 20 : pageSize),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("ListEmployees");

        group.MapGet("/{idEmployee:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid organizationId,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.GetEmployeeAsync(organizationId, idEmployee, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("GetEmployee");

        group.MapPost("", async (
            HttpContext context,
            CreateEmployeeRequest request,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateEmployeeAsync(request, cancellationToken);
            return Results.Created($"/api/v1/employees/{result.IdEmployee}", result);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("CreateEmployee");

        group.MapPut("/{idEmployee:guid}", async (
            HttpContext context,
            Guid idEmployee,
            UpdateEmployeeRequest request,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateEmployeeAsync(idEmployee, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("UpdateEmployee");

        group.MapPatch("/{idEmployee:guid}/status", async (
            HttpContext context,
            Guid idEmployee,
            ChangeEmployeeStatusRequest request,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ChangeStatusAsync(idEmployee, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("ChangeEmployeeStatus");

        group.MapDelete("/{idEmployee:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid organizationId,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateEmployeeAsync(organizationId, idEmployee, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("DeactivateEmployee");

        group.MapGet("/{idEmployee:guid}/documents", async (
            HttpContext context,
            Guid idEmployee,
            Guid organizationId,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ListDocumentsAsync(organizationId, idEmployee, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("ListEmployeeDocuments");

        group.MapPost("/{idEmployee:guid}/documents", async (
            HttpContext context,
            Guid idEmployee,
            CreateEmployeeDocumentRequest request,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateDocumentAsync(request with { IdEmployee = idEmployee }, cancellationToken);
            return Results.Created($"/api/v1/employees/{idEmployee}/documents/{result.IdEmployeeDocument}", result);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("CreateEmployeeDocument");

        group.MapPut("/{idEmployee:guid}/documents/{idEmployeeDocument:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idEmployeeDocument,
            UpdateEmployeeDocumentRequest request,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateDocumentAsync(
                idEmployeeDocument,
                request with { IdEmployee = idEmployee },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("UpdateEmployeeDocument");

        group.MapDelete("/{idEmployee:guid}/documents/{idEmployeeDocument:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idEmployeeDocument,
            Guid organizationId,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateDocumentAsync(organizationId, idEmployee, idEmployeeDocument, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("DeactivateEmployeeDocument");

        group.MapGet("/{idEmployee:guid}/evaluations", async (
            HttpContext context,
            Guid idEmployee,
            Guid organizationId,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ListEvaluationsAsync(organizationId, idEmployee, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("ListEmployeeEvaluations");

        group.MapPost("/{idEmployee:guid}/evaluations", async (
            HttpContext context,
            Guid idEmployee,
            CreateEmployeeEvaluationRequest request,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateEvaluationAsync(request with { IdEmployee = idEmployee }, cancellationToken);
            return Results.Created($"/api/v1/employees/{idEmployee}/evaluations/{result.IdEmployeeEvaluation}", result);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("CreateEmployeeEvaluation");

        group.MapPut("/{idEmployee:guid}/evaluations/{idEmployeeEvaluation:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idEmployeeEvaluation,
            UpdateEmployeeEvaluationRequest request,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateEvaluationAsync(
                idEmployeeEvaluation,
                request with { IdEmployee = idEmployee },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("UpdateEmployeeEvaluation");

        group.MapDelete("/{idEmployee:guid}/evaluations/{idEmployeeEvaluation:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idEmployeeEvaluation,
            Guid organizationId,
            IWorkforceService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateEvaluationAsync(organizationId, idEmployee, idEmployeeEvaluation, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("DeactivateEmployeeEvaluation");

        return endpoints;
    }
}
