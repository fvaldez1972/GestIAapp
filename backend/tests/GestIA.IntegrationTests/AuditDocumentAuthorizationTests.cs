using System.Data;
using System.Data.Common;
using System.Security.Claims;
using GestIA.Api.Endpoints;
using GestIA.Api.Security;
using GestIA.Application.Audit;
using GestIA.Application.Common;
using GestIA.Application.Documents;
using GestIA.Application.Security;
using GestIA.Infrastructure.Persistence;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

public sealed class AuditDocumentAuthorizationTests
{
    private static readonly Guid OrganizationId = Guid.Parse("65f1126a-ac8d-4f65-a80b-70161bdc835d");

    [Theory]
    [InlineData(null)]
    [InlineData(BusinessDocumentPermissions.SensitiveWrite)]
    [InlineData(SecurityPermissions.PlatformAdmin)]
    public async Task MissingSensitiveReadFiltersBeforeMaterialization(string? permission)
    {
        var capture = new CaptureCommands();
        await using var context = CreateContext(capture);
        var result = await new AuditRepository(context, new Actor(permission)).SearchAsync(Query("Documentos"), default);

        AssertRestrictedDocumentSql(Assert.Single(capture.Commands));
        Assert.Equal(0, result.Events.TotalCount);
        Assert.Empty(result.Events.Items);
        Assert.Contains(OrganizationId, capture.ParameterValues);
    }

    [Fact]
    public async Task SensitiveReadIncludesLegacyButPreservesTenantPredicate()
    {
        var capture = new CaptureCommands();
        await using var context = CreateContext(capture);
        await new AuditRepository(context, new Actor(BusinessDocumentPermissions.SensitiveRead)).SearchAsync(Query("Documentos"), default);

        Assert.Equal(2, capture.Commands.Count);
        Assert.Contains("[EmployeeDocuments]", capture.Commands[0], StringComparison.Ordinal);
        Assert.Contains("[BusinessDocuments]", capture.Commands[1], StringComparison.Ordinal);
        Assert.All(capture.Commands, sql =>
        {
            Assert.Contains("[IdOrganization] =", sql, StringComparison.Ordinal);
            Assert.DoesNotContain("NOT EXISTS", sql, StringComparison.Ordinal);
        });
        Assert.Contains(OrganizationId, capture.ParameterValues);
    }

    [Fact]
    public async Task LegacyEvaluationsAreNeverQueriedWithoutRead()
    {
        var capture = new CaptureCommands();
        await using var context = CreateContext(capture);
        var result = await new AuditRepository(context, new Actor(null)).SearchAsync(Query("Evaluaciones"), default);
        Assert.Empty(capture.Commands);
        Assert.Equal(0, result.Events.TotalCount);
    }

    [Theory]
    [InlineData("Incidencias")]
    [InlineData("Evidencias")]
    public async Task OperationsAuditSqlIsUnchangedBySensitivePermission(string entity)
    {
        var withoutPermission = new CaptureCommands();
        await using var first = CreateContext(withoutPermission);
        await new AuditRepository(first, new Actor(null)).SearchAsync(Query(entity), default);
        var withPermission = new CaptureCommands();
        await using var second = CreateContext(withPermission);
        await new AuditRepository(second, new Actor(BusinessDocumentPermissions.SensitiveRead)).SearchAsync(Query(entity), default);
        Assert.Equal(Assert.Single(withoutPermission.Commands), Assert.Single(withPermission.Commands));
        Assert.Contains(OrganizationId, withoutPermission.ParameterValues);
    }

    [Theory]
    [InlineData("/api/v1/audit/events")]
    [InlineData("/api/v1/audit/events/export")]
    public async Task ListAndExportUseTheRestrictedRepositoryQuery(string route)
    {
        var capture = new CaptureCommands();
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddOrganizationContext();
        builder.Services.AddScoped(_ => CreateContext(capture));
        builder.Services.AddSingleton<IActorContext>(new Actor(null));
        builder.Services.AddScoped<IAuditRepository, AuditRepository>();
        builder.Services.AddScoped<IAuditService, AuditService>();
        await using var app = builder.Build();
        app.Use(async (context, next) =>
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim("permission", SecurityPermissions.AuditRead), new Claim("organization", OrganizationId.ToString())], "Test"));
            await next(context);
        });
        app.MapAuditEndpoints();
        await app.StartAsync();
        using var client = app.GetTestClient();
        using var response = await client.GetAsync($"{route}?organizationId={OrganizationId}&entity=Documentos&page=1&pageSize=20");
        response.EnsureSuccessStatusCode();
        AssertRestrictedDocumentSql(Assert.Single(capture.Commands));
    }

    private static AuditQuery Query(string entity) => new(OrganizationId, entity, null, null, null, 1, 20);

    private static GestIaDbContext CreateContext(CaptureCommands capture) => new(
        new DbContextOptionsBuilder<GestIaDbContext>()
            .UseSqlServer("Server=localhost;Database=Unused;Integrated Security=true;TrustServerCertificate=true")
            .AddInterceptors(new SuppressConnection(), capture).Options,
        FixedOrganizationContext.For(OrganizationId));

    private static void AssertRestrictedDocumentSql(string sql)
    {
        Assert.Contains("[IdOrganization] =", sql, StringComparison.Ordinal);
        Assert.Contains("[IsSensitive] = CAST(0 AS bit)", sql, StringComparison.Ordinal);
        Assert.Equal(3, sql.Split("NOT EXISTS", StringSplitOptions.None).Length - 1);
        Assert.Contains("[EmployeeDocuments]", sql, StringComparison.Ordinal);
        Assert.Contains("[EmployeeEvaluations]", sql, StringComparison.Ordinal);
        Assert.Contains("COLLATE Latin1_General_100_CI_AS", sql, StringComparison.Ordinal);
        Assert.Contains("REPLACE(", sql, StringComparison.Ordinal);
    }

    private sealed class Actor(string? permission) : IActorContext
    {
        public Guid ActorId => Guid.Empty;
        public string ActorName => "Tester";
        public bool HasPermission(string requestedPermission) => permission == requestedPermission;
    }

    // Compile real SQL Server queries without opening a database or returning fixture rows.
    private sealed class SuppressConnection : DbConnectionInterceptor
    {
        public override ValueTask<InterceptionResult> ConnectionOpeningAsync(DbConnection connection,
            ConnectionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default) =>
            ValueTask.FromResult(InterceptionResult.Suppress());
    }

    private sealed class CaptureCommands : DbCommandInterceptor
    {
        public List<string> Commands { get; } = [];
        public List<object?> ParameterValues { get; } = [];

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            Commands.Add(command.CommandText);
            ParameterValues.AddRange(command.Parameters.Cast<DbParameter>().Select(parameter => parameter.Value));
            using var table = new DataTable();
            return ValueTask.FromResult(InterceptionResult<DbDataReader>.SuppressWithResult(table.CreateDataReader()));
        }
    }
}
