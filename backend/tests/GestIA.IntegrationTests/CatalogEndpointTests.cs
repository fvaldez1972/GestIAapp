using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Claims;
using GestIA.Api.Endpoints;
using GestIA.Application.Catalogs;
using GestIA.Application.Security;
using GestIA.Domain.Catalogs;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

public sealed class CatalogEndpointTests
{
    private static readonly Guid OrganizationId = Guid.NewGuid();

    [Theory]
    [InlineData(false, HttpStatusCode.Forbidden)]
    [InlineData(true, HttpStatusCode.OK)]
    public async Task DefinitionsRequireReadPermission(bool read, HttpStatusCode expected)
    {
        await using var app = App(read);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        using var response = await client.GetAsync("/api/v1/catalogs/definitions", CancellationToken.None);
        Assert.Equal(expected, response.StatusCode);
    }

    [Theory]
    [InlineData("", 1)]
    [InlineData("&includeInactive=false", 1)]
    [InlineData("&includeInactive=true", 2)]
    public async Task InactiveValuesRequireExplicitManagementQuery(string query, int expected)
    {
        await using var app = App(true);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        var values = await client.GetFromJsonAsync<CatalogItemResponse[]>($"/api/v1/catalogs/items?organizationId={OrganizationId}{query}", CancellationToken.None);
        Assert.Equal(expected, values!.Length);
    }

    [Fact]
    public async Task CrossTenantReadsAndReadOnlyWritesAreForbidden()
    {
        await using var app = App(true);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        using var read = await client.GetAsync($"/api/v1/catalogs/items?organizationId={Guid.NewGuid()}&includeInactive=true", CancellationToken.None);
        Assert.Equal(HttpStatusCode.Forbidden, read.StatusCode);
        using var write = await client.PostAsJsonAsync("/api/v1/catalogs/items",
            new CatalogItemInput(OrganizationId, BusinessCatalogItemType.Skill, "S", "Skill", null), CancellationToken.None);
        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Forbidden)]
    [InlineData(SecurityPermissions.ClientsRead, HttpStatusCode.OK)]
    [InlineData(SecurityPermissions.WorkforceRead, HttpStatusCode.OK)]
    public async Task FormOptionsRequireModulePermissionAndOnlyReturnActiveValues(string? permission, HttpStatusCode expected)
    {
        await using var app = App(false, permission);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        using var response = await client.GetAsync($"/api/v1/catalogs/options?organizationId={OrganizationId}", CancellationToken.None);
        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.OK)
        {
            var values = await response.Content.ReadFromJsonAsync<CatalogItemResponse[]>(CancellationToken.None);
            Assert.Single(values!);
            Assert.True(values![0].Active);
            using var crossTenant = await client.GetAsync($"/api/v1/catalogs/options?organizationId={Guid.NewGuid()}", CancellationToken.None);
            Assert.Equal(HttpStatusCode.Forbidden, crossTenant.StatusCode);
        }
    }

    private static WebApplication App(bool read, string? modulePermission = null)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(DispatchProxy.Create<ICatalogService, CatalogProxy>());
        var app = builder.Build();
        app.Use(async (context, next) =>
        {
            var claims = new List<Claim> { new("organization", OrganizationId.ToString()) };
            if (read) claims.Add(new Claim("permission", SecurityPermissions.CatalogsRead));
            if (modulePermission is not null) claims.Add(new Claim("permission", modulePermission));
            context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
            await next(context);
        });
        app.MapCatalogEndpoints();
        return app;
    }

    public class CatalogProxy : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name != nameof(ICatalogService.ListCatalogItemsAsync)) throw new NotSupportedException();
            IReadOnlyList<CatalogItemResponse> values = [
                new(Guid.NewGuid(), OrganizationId, BusinessCatalogItemType.Skill, "A", "Active", null, true),
                new(Guid.NewGuid(), OrganizationId, BusinessCatalogItemType.Skill, "I", "Inactive", null, false)];
            return Task.FromResult(values);
        }
    }
}
