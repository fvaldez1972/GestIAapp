using GestIA.Api.Security;
using GestIA.Application.Documents;
using GestIA.Application.Operations;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class FileUploadEndpoints
{
    public static IEndpointRouteBuilder MapFileUploadEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/files")
            .WithTags("Files");

        group.MapPost("/operation-evidence", async (
            HttpContext context,
            Guid organizationId,
            HttpRequest request,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var upload = await BusinessDocumentEndpoints.StoreFileAsync(
                request,
                configuration,
                environment,
                $"operation-evidences/{organizationId:N}",
                cancellationToken);
            return upload is null
                ? Results.BadRequest(new { message = "Selecciona un archivo válido de máximo 20 MB." })
                : Results.Ok(upload);
        })
            .DisableAntiforgery()
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("UploadOperationEvidenceFile");

        group.MapGet("/operation-evidence/download", async (
            HttpContext context,
            Guid organizationId,
            Guid clientId,
            Guid serviceId,
            Guid evidenceId,
            IOperationsService operations,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            IBusinessDocumentRepository documents,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var evidences = await operations.ListEvidencesAsync(organizationId, clientId, serviceId, null, cancellationToken);
            var evidence = evidences.FirstOrDefault(item => item.IdOperationEvidence == evidenceId && item.Active);
            if (evidence is null)
            {
                return Results.NotFound();
            }
            var storageReference = evidence.StorageReference;
            if (!DocumentStorageReference.IsSafeRelativePath(storageReference))
            {
                return Results.BadRequest(new { message = "La referencia de evidencia no es válida." });
            }

            var normalizedReference = storageReference.Replace('\\', '/');
            if (!normalizedReference.StartsWith("operation-evidences/", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { message = "La referencia de evidencia no es válida." });
            }

            var root = BusinessDocumentEndpoints.ResolveStorageRoot(configuration, environment);
            // Document-linked files must use the document endpoint and its tenant/sensitivity checks.
            if (await documents.IsDocumentStorageReferenceAsync(normalizedReference, cancellationToken))
            {
                return Results.NotFound();
            }

            var fullPath = BusinessDocumentEndpoints.ResolveStoragePath(root, normalizedReference);

            if (!File.Exists(fullPath))
            {
                return Results.NotFound(new { message = "El archivo físico no existe en el almacenamiento local." });
            }

            return Results.File(fullPath, "application/octet-stream", Path.GetFileName(fullPath));
        })
            .RequirePermission(SecurityPermissions.OperationsRead)
            .WithName("DownloadOperationEvidenceFile");

        return endpoints;
    }
}

public sealed record FileUploadResponse(
    string OriginalFileName,
    string ContentType,
    long Size,
    string StorageReference);
