using GestIA.Api.Security;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class FileUploadEndpoints
{
    public static IEndpointRouteBuilder MapFileUploadEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/files")
            .WithTags("Files");

        group.MapPost("/operation-evidence", async (
            HttpRequest request,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            CancellationToken cancellationToken) =>
        {
            var upload = await BusinessDocumentEndpoints.StoreFileAsync(
                request,
                configuration,
                environment,
                "operation-evidences",
                cancellationToken);
            return upload is null
                ? Results.BadRequest(new { message = "Selecciona un archivo válido de máximo 20 MB." })
                : Results.Ok(upload);
        })
            .DisableAntiforgery()
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("UploadOperationEvidenceFile");

        group.MapGet("/operation-evidence/download", (
            string storageReference,
            IConfiguration configuration,
            IWebHostEnvironment environment) =>
        {
            var normalizedReference = storageReference.Replace('\\', '/').TrimStart('/');
            if (!normalizedReference.StartsWith("operation-evidences/", StringComparison.OrdinalIgnoreCase))
            {
                return Results.BadRequest(new { message = "La referencia de evidencia no es válida." });
            }

            var root = BusinessDocumentEndpoints.ResolveStorageRoot(configuration, environment);
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
