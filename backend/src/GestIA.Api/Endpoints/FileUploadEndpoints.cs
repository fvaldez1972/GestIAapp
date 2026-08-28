using GestIA.Api.Security;
using GestIA.Application.Security;
using System.Globalization;

namespace GestIA.Api.Endpoints;

public static class FileUploadEndpoints
{
    private const long MaximumFileSizeBytes = 20 * 1024 * 1024;

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
            if (!request.HasFormContentType)
            {
                return Results.BadRequest(new { message = "La carga debe enviarse como multipart/form-data." });
            }

            var form = await request.ReadFormAsync(cancellationToken);
            var file = form.Files.GetFile("file") ?? (form.Files.Count > 0 ? form.Files[0] : null);
            if (file is null || file.Length == 0)
            {
                return Results.BadRequest(new { message = "Selecciona un archivo válido." });
            }

            if (file.Length > MaximumFileSizeBytes)
            {
                return Results.BadRequest(new { message = "El archivo no puede exceder 20 MB." });
            }

            var storageRoot = configuration["Storage:RootPath"];
            if (string.IsNullOrWhiteSpace(storageRoot))
            {
                storageRoot = Path.Combine(environment.ContentRootPath, "storage");
            }

            var today = DateTime.UtcNow;
            var relativeFolder = Path.Combine(
                "operation-evidences",
                today.Year.ToString("0000", CultureInfo.InvariantCulture),
                today.Month.ToString("00", CultureInfo.InvariantCulture));
            var targetFolder = Path.GetFullPath(Path.Combine(storageRoot, relativeFolder));
            Directory.CreateDirectory(targetFolder);

            var extension = Path.GetExtension(file.FileName);
            var storedFileName = $"{Guid.NewGuid():N}{extension}";
            var targetPath = Path.Combine(targetFolder, storedFileName);

            await using var stream = File.Create(targetPath);
            await file.CopyToAsync(stream, cancellationToken);

            var storageReference = Path.Combine(relativeFolder, storedFileName).Replace('\\', '/');
            return Results.Ok(new FileUploadResponse(
                file.FileName,
                file.ContentType,
                file.Length,
                storageReference));
        })
            .DisableAntiforgery()
            .RequirePermission(SecurityPermissions.OperationsWrite)
            .WithName("UploadOperationEvidenceFile");

        return endpoints;
    }
}

public sealed record FileUploadResponse(
    string OriginalFileName,
    string ContentType,
    long Size,
    string StorageReference);
