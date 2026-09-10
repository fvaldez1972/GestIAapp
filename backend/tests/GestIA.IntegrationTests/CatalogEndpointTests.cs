using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Claims;
using GestIA.Api.Endpoints;
using GestIA.Api.Security;
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

    /// <summary>
    /// La comprobación por lotes existe para que Planeación y Cobertura dejen de <b>afirmar</b> la
    /// elegibilidad por su cuenta.
    ///
    /// <para>Antes la ponía el navegador: bastaba con que la asignación trajera puesto para marcar
    /// a alguien «Elegible», sin consultar un solo requisito. Las reglas viven en el servidor y es
    /// él quien las hace cumplir; que la pantalla las repita de memoria es lo que el principio 5
    /// prohíbe.</para>
    ///
    /// <para>Lo que se fija aquí es lo que se pudo haber cableado mal: <b>que la ruta exista</b>,
    /// que exija permiso de lectura sobre personal y no el de catálogos, y que el guardia de
    /// organización siga puesto pese a que el identificador viaja en el cuerpo y no en la
    /// dirección, que es donde el guardia lo suele buscar.</para>
    /// </summary>
    [Theory]
    [InlineData(null, HttpStatusCode.Forbidden)]
    [InlineData(SecurityPermissions.CatalogsRead, HttpStatusCode.Forbidden)]
    [InlineData(SecurityPermissions.WorkforceRead, HttpStatusCode.OK)]
    public async Task TheBatchEligibilityCheckNeedsWorkforceRead(string? permission, HttpStatusCode expected)
    {
        await using var app = App(false, permission);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();

        using var response = await client.PostAsJsonAsync(
            "/api/v1/catalogs/eligibility/check-batch",
            new EligibilityBatchRequest(OrganizationId, [Guid.NewGuid()], null, null, null, null),
            CancellationToken.None);

        Assert.Equal(expected, response.StatusCode);
    }

    /// <summary>El aislamiento entre organizaciones vale igual cuando el identificador va en el cuerpo.</summary>
    [Fact]
    public async Task TheBatchEligibilityCheckStillGuardsTheOrganization()
    {
        await using var app = App(false, SecurityPermissions.WorkforceRead);
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();

        using var response = await client.PostAsJsonAsync(
            "/api/v1/catalogs/eligibility/check-batch",
            new EligibilityBatchRequest(Guid.NewGuid(), [Guid.NewGuid()], null, null, null, null),
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static WebApplication App(bool read, string? modulePermission = null)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddGestIaRequestContext();
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
            if (targetMethod?.Name == nameof(ICatalogService.CheckEligibilityBatchAsync))
            {
                IReadOnlyList<EligibilityCheckResponse> vacio = [];
                return Task.FromResult(vacio);
            }

            if (targetMethod?.Name != nameof(ICatalogService.ListCatalogItemsAsync)) throw new NotSupportedException();
            IReadOnlyList<CatalogItemResponse> values = [
                new(Guid.NewGuid(), OrganizationId, BusinessCatalogItemType.Skill, "Active", null, true),
                new(Guid.NewGuid(), OrganizationId, BusinessCatalogItemType.Skill, "Inactive", null, false)];
            return Task.FromResult(values);
        }
    }
}
