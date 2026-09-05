using System.Net;
using System.Security.Claims;
using System.Reflection;
using GestIA.Application.Operations;
using GestIA.Domain.Operations;
using GestIA.Api.Endpoints;
using GestIA.Api.ErrorHandling;
using GestIA.Api.Security;
using GestIA.Application.Common;
using GestIA.Application.Documents;
using GestIA.Application.Security;
using GestIA.Domain.Documents;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

namespace GestIA.IntegrationTests;

public sealed class DocumentEndpointSecurityTests
{
    private static readonly Guid OrganizationId = Guid.Parse("65f1126a-ac8d-4f65-a80b-70161bdc835d");
    private static readonly Guid DocumentId = Guid.NewGuid();
    private static readonly Guid EvidenceId = Guid.NewGuid();

    [Theory]
    [InlineData(false, false, HttpStatusCode.Forbidden)]
    [InlineData(true, false, HttpStatusCode.OK)]
    [InlineData(true, true, HttpStatusCode.Forbidden)]
    public async Task DownloadRequiresSensitivePermissionAndTenant(bool sensitiveRead, bool otherTenant, HttpStatusCode expected)
    {
        var root = Path.Combine(Path.GetTempPath(), $"gestia-document-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(root, "business-documents"));
        await File.WriteAllTextAsync(Path.Combine(root, "business-documents", "test.txt"), "protected-content", CancellationToken.None);
        try
        {
            await using var app = CreateApp(root, sensitiveRead, otherTenant);
            await app.StartAsync(CancellationToken.None);
            using var client = app.GetTestClient();
            using var response = await client.GetAsync($"/api/v1/documents/{DocumentId}/download?organizationId={OrganizationId}", CancellationToken.None);
            Assert.Equal(expected, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync(CancellationToken.None);
            Assert.Equal(expected == HttpStatusCode.OK, body.Contains("protected-content", StringComparison.Ordinal));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Theory]
    [InlineData("operation-evidences/../business-documents/test.txt", HttpStatusCode.BadRequest)]
    [InlineData("operation-evidences/..\\business-documents/test.txt", HttpStatusCode.BadRequest)]
    [InlineData("operation-evidences/legacy-sensitive.txt", HttpStatusCode.NotFound)]
    public async Task EvidenceEndpointCannotBypassDocumentAuthorization(string reference, HttpStatusCode expected)
    {
        await using var app = CreateApp(Path.GetTempPath(), false, false, reference);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        using var response = await client.GetAsync(EvidenceDownloadUrl(EvidenceId), CancellationToken.None);
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task UploadRejectsAnotherTenantBeforeStoringFile()
    {
        await using var app = CreateApp(Path.GetTempPath(), true, true);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        using var form = new MultipartFormDataContent();
        using var response = await client.PostAsync($"/api/v1/documents/upload?organizationId={OrganizationId}", form, CancellationToken.None);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task EvidenceDownloadRejectsOtherTenant()
    {
        await using var app = CreateApp(Path.GetTempPath(), false, true);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        using var response = await client.GetAsync(EvidenceDownloadUrl(EvidenceId), CancellationToken.None);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task EvidenceDownloadRejectsUnknownRecord()
    {
        await using var app = CreateApp(Path.GetTempPath(), false, false);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        using var response = await client.GetAsync(EvidenceDownloadUrl(Guid.NewGuid()), CancellationToken.None);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static string EvidenceDownloadUrl(Guid evidenceId) =>
        $"/api/v1/files/operation-evidence/download?organizationId={OrganizationId}&clientId={Guid.NewGuid()}&serviceId={Guid.NewGuid()}&evidenceId={evidenceId}";

    private static WebApplication CreateApp(string root, bool sensitiveRead, bool otherTenant, string evidenceReference = "operation-evidences/legacy-sensitive.txt")
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:RootPath"] = root });
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddGestIaRequestContext();
        builder.Services.AddScoped<IActorContext, HttpActorContext>();
        builder.Services.AddScoped<IBusinessDocumentService, BusinessDocumentService>();
        builder.Services.AddSingleton<IBusinessDocumentRepository, Repository>();
        builder.Services.AddSingleton<IUnitOfWork, UnitOfWork>();
        builder.Services.AddSingleton<IClock, Clock>();
        var operations = DispatchProxy.Create<IOperationsService, OperationsProxy>();
        ((OperationsProxy)(object)operations).Reference = evidenceReference;
        builder.Services.AddSingleton(operations);
        builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
        builder.Services.AddProblemDetails();
        var app = builder.Build();
        app.UseExceptionHandler();
        app.Use(async (context, next) =>
        {
            var claims = new List<Claim>
            {
                new("permission", SecurityPermissions.DocumentsRead),
                new("permission", SecurityPermissions.DocumentsWrite),
                new("permission", SecurityPermissions.OperationsRead),
                new("organization", (otherTenant ? Guid.NewGuid() : OrganizationId).ToString())
            };
            if (sensitiveRead)
            {
                claims.Add(new Claim("permission", BusinessDocumentPermissions.SensitiveRead));
            }
            context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
            await next(context);
        });
        app.MapBusinessDocumentEndpoints();
        app.MapFileUploadEndpoints();
        return app;
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }

    public class OperationsProxy : DispatchProxy
    {
        public string Reference { get; set; } = string.Empty;

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name != nameof(IOperationsService.ListEvidencesAsync)) throw new NotSupportedException();
            IReadOnlyList<OperationEvidenceResponse> records = [new(EvidenceId, (Guid)args![2]!, null, null, null,
                OperationEvidenceType.Photo, "Evidence", Reference, null, true)];
            return Task.FromResult(records);
        }
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class Repository : IBusinessDocumentRepository
    {
        private readonly BusinessDocument document = BusinessDocument.Create(OrganizationId,
            new BusinessDocumentProfile(BusinessDocumentOwnerType.Client, Guid.NewGuid(), "Contract", "Sensitive",
                BusinessDocumentStatus.PendingReview, null, null, "business-documents/test.txt", true, null),
            Guid.NewGuid(), "Tester", DateTime.UtcNow);

        public Task<BusinessDocument?> GetAsync(Guid idOrganization, Guid idBusinessDocument, CancellationToken cancellationToken) =>
            Task.FromResult<BusinessDocument?>(idOrganization == OrganizationId && idBusinessDocument == DocumentId ? document : null);
        public Task<bool> IsSensitiveStorageReferenceAsync(string storageReference, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task<bool> IsDocumentStorageReferenceAsync(string storageReference, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task<bool> OwnerExistsAsync(Guid idOrganization, BusinessDocumentOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task<BusinessDocumentSearchResult> SearchAsync(BusinessDocumentSearchCriteria criteria, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task AddAsync(BusinessDocument value, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task AddEventAsync(BusinessDocumentEvent documentEvent, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<IReadOnlyList<BusinessDocumentEvent>> ListEventsAsync(Guid idOrganization, Guid idBusinessDocument, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
