using GestIA.Api.Security;
using GestIA.Application.Documents;
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

        // El listado que la pantalla usa: trae el puesto de catálogo, el resumen documental y las
        // asignaciones, y filtra por puesto y por vigencia. El de arriba se conserva porque otras
        // pantallas lo usan como fuente de opciones.
        group.MapGet("/search", async (
            HttpContext context,
            Guid organizationId,
            string? search,
            EmployeeStatus? status,
            Guid? idJobPositionCatalogItem,
            EmployeeDocumentFilter? documents,
            string? municipality,
            int? page,
            int? pageSize,
            IEmployeeSearchService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            return Results.Ok(await service.SearchAsync(
                new EmployeeSearchQuery(
                    organizationId,
                    search,
                    status,
                    idJobPositionCatalogItem,
                    documents ?? EmployeeDocumentFilter.Any,
                    municipality,
                    page ?? 1,
                    pageSize ?? 25),
                cancellationToken));
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("SearchEmployees");

        // Las opciones reales de los filtros. Sacarlas de la página ya traída daría una lista
        // distinta en cada página, que es la clase de filtro que miente.
        group.MapGet("/filters", async (
            HttpContext context,
            Guid organizationId,
            IEmployeeSearchService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            return Results.Ok(await service.GetFilterOptionsAsync(organizationId, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("ListEmployeeFilterOptions");

        // Las asignaciones de una persona. Antes sólo se alcanzaban por cliente y servicio, así que
        // la pestaña habría tenido que recorrer todos los servicios de la organización.
        group.MapGet("/{idEmployee:guid}/assignments", async (
            HttpContext context,
            Guid organizationId,
            Guid idEmployee,
            IEmployeeSearchService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            return Results.Ok(await service.ListAssignmentsAsync(organizationId, idEmployee, cancellationToken));
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("ListEmployeeAssignments");

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

        group.MapGet("/{idEmployee:guid}/documents/{idEmployeeDocument:guid}/download", async (
            HttpContext context,
            Guid organizationId,
            Guid idEmployee,
            Guid idEmployeeDocument,
            IWorkforceService service,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var documents = await service.ListDocumentsAsync(organizationId, idEmployee, cancellationToken);
            var document = documents.SingleOrDefault(item => item.IdEmployeeDocument == idEmployeeDocument);
            return DownloadLegacyFile(document?.StorageReference, configuration, environment);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("DownloadEmployeeDocument");

        group.MapGet("/{idEmployee:guid}/evaluations/{idEmployeeEvaluation:guid}/download", async (
            HttpContext context,
            Guid organizationId,
            Guid idEmployee,
            Guid idEmployeeEvaluation,
            IWorkforceService service,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var evaluations = await service.ListEvaluationsAsync(organizationId, idEmployee, cancellationToken);
            var evaluation = evaluations.SingleOrDefault(item => item.IdEmployeeEvaluation == idEmployeeEvaluation);
            return DownloadLegacyFile(evaluation?.StorageReference, configuration, environment);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("DownloadEmployeeEvaluation");

        return endpoints;
    }

    private static IResult DownloadLegacyFile(string? reference, IConfiguration configuration, IWebHostEnvironment environment)
    {
        if (reference is null || !DocumentStorageReference.IsSafeRelativePath(reference))
        {
            return Results.NotFound();
        }

        var root = BusinessDocumentEndpoints.ResolveStorageRoot(configuration, environment);
        var path = BusinessDocumentEndpoints.ResolveStoragePath(root, reference);
        return File.Exists(path) ? Results.File(path, "application/octet-stream", Path.GetFileName(path)) : Results.NotFound();
    }
}
