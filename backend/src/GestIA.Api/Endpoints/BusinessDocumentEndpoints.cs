using GestIA.Api.Security;
using GestIA.Application.Documents;
using GestIA.Application.Security;
using GestIA.Domain.Documents;
using System.Globalization;

namespace GestIA.Api.Endpoints;

public static class BusinessDocumentEndpoints
{
    private const long MaximumFileSizeBytes = 30 * 1024 * 1024;

    public static IEndpointRouteBuilder MapBusinessDocumentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/documents")
            .WithTags("Documents");

        group.MapGet("", async (
            Guid organizationId,
            BusinessDocumentOwnerType? ownerType,
            Guid? ownerId,
            BusinessDocumentStatus? status,
            string? search,
            int page,
            int pageSize,
            IBusinessDocumentService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.ListAsync(
                new BusinessDocumentQuery(
                    organizationId,
                    ownerType,
                    ownerId,
                    status,
                    search,
                    page <= 0 ? 1 : page,
                    pageSize <= 0 ? 20 : pageSize),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.DocumentsRead)
            .WithName("ListBusinessDocuments");

        group.MapGet("/{idBusinessDocument:guid}", async (
            Guid idBusinessDocument,
            Guid organizationId,
            IBusinessDocumentService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.GetAsync(organizationId, idBusinessDocument, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.DocumentsRead)
            .WithName("GetBusinessDocument");

        group.MapPost("", async (
            CreateBusinessDocumentRequest request,
            IBusinessDocumentService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/v1/documents/{result.IdBusinessDocument}", result);
        })
            .RequirePermission(SecurityPermissions.DocumentsWrite)
            .WithName("CreateBusinessDocument");

        group.MapPut("/{idBusinessDocument:guid}", async (
            Guid idBusinessDocument,
            UpdateBusinessDocumentRequest request,
            IBusinessDocumentService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateAsync(idBusinessDocument, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.DocumentsWrite)
            .WithName("UpdateBusinessDocument");

        group.MapDelete("/{idBusinessDocument:guid}", async (
            Guid idBusinessDocument,
            Guid organizationId,
            IBusinessDocumentService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateAsync(organizationId, idBusinessDocument, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.DocumentsWrite)
            .WithName("DeactivateBusinessDocument");

        group.MapPost("/upload", async (
            HttpRequest request,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            CancellationToken cancellationToken) =>
        {
            var upload = await StoreFileAsync(request, configuration, environment, "business-documents", cancellationToken);
            return upload is null
                ? Results.BadRequest(new { message = "Selecciona un archivo válido." })
                : Results.Ok(upload);
        })
            .DisableAntiforgery()
            .RequirePermission(SecurityPermissions.DocumentsWrite)
            .WithName("UploadBusinessDocumentFile");

        group.MapGet("/{idBusinessDocument:guid}/download", async (
            Guid idBusinessDocument,
            Guid organizationId,
            IBusinessDocumentService service,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            CancellationToken cancellationToken) =>
        {
            var document = await service.GetAsync(organizationId, idBusinessDocument, cancellationToken);
            var root = ResolveStorageRoot(configuration, environment);
            var fullPath = ResolveStoragePath(root, document.StorageReference);

            if (!System.IO.File.Exists(fullPath))
            {
                return Results.NotFound(new { message = "El archivo físico no existe en el almacenamiento local." });
            }

            var fileName = Path.GetFileName(fullPath);
            return Results.File(fullPath, "application/octet-stream", fileName);
        })
            .RequirePermission(SecurityPermissions.DocumentsRead)
            .WithName("DownloadBusinessDocumentFile");

        return endpoints;
    }

    internal static async Task<FileUploadResponse?> StoreFileAsync(
        HttpRequest request,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        string moduleFolder,
        CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
        {
            return null;
        }

        var form = await request.ReadFormAsync(cancellationToken);
        var file = form.Files.GetFile("file") ?? (form.Files.Count > 0 ? form.Files[0] : null);
        if (file is null || file.Length == 0 || file.Length > MaximumFileSizeBytes)
        {
            return null;
        }

        var storageRoot = ResolveStorageRoot(configuration, environment);
        var today = DateTime.UtcNow;
        var relativeFolder = Path.Combine(
            moduleFolder,
            today.Year.ToString("0000", CultureInfo.InvariantCulture),
            today.Month.ToString("00", CultureInfo.InvariantCulture));
        var targetFolder = Path.GetFullPath(Path.Combine(storageRoot, relativeFolder));
        Directory.CreateDirectory(targetFolder);

        var extension = Path.GetExtension(file.FileName);
        var storedFileName = $"{Guid.NewGuid():N}{extension}";
        var targetPath = Path.Combine(targetFolder, storedFileName);

        await using var stream = System.IO.File.Create(targetPath);
        await file.CopyToAsync(stream, cancellationToken);

        return new FileUploadResponse(
            file.FileName,
            file.ContentType,
            file.Length,
            Path.Combine(relativeFolder, storedFileName).Replace('\\', '/'));
    }

    internal static string ResolveStorageRoot(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var storageRoot = configuration["Storage:RootPath"];
        return string.IsNullOrWhiteSpace(storageRoot)
            ? Path.Combine(environment.ContentRootPath, "storage")
            : storageRoot;
    }

    internal static string ResolveStoragePath(string storageRoot, string storageReference)
    {
        var root = Path.GetFullPath(storageRoot);
        var fullPath = Path.GetFullPath(Path.Combine(root, storageReference.Replace('/', Path.DirectorySeparatorChar)));

        if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("La referencia de archivo no es válida.");
        }

        return fullPath;
    }
}
