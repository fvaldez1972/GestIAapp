using System.Net.Http.Json;
using System.Security.Claims;
using GestIA.Api.Endpoints;
using GestIA.Api.Security;
using GestIA.Application;
using GestIA.Application.Common;
using GestIA.Application.Security;
using GestIA.Domain.Organizations;
using GestIA.Domain.Security;
using GestIA.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

public sealed class OrganizationPermissionQueryTests(OperationalSqlDatabase database) : IClassFixture<OperationalSqlDatabase>
{
    [OperationalSqlFact]
    public async Task AssignablePermissionsQueryTranslatesToSqlAndExcludesPlatformRoles()
    {
        var actor = new Actor();
        var org = Organization.Create(Guid.NewGuid().ToString("N")[..24], "Query test", null, actor.ActorId, actor.ActorName, DateTime.UtcNow);
        var role = Role.CreateCustom(org.IdOrganization, "OPERATOR", "Operator", actor.ActorId, actor.ActorName, DateTime.UtcNow);
        var excluded = Role.CreateCustom(org.IdOrganization, "PRIVILEGED", "Privileged", actor.ActorId, actor.ActorName, DateTime.UtcNow);
        var read = Permission.Create("TEST.READ", "Test", "Read");
        var platform = Permission.Create(SecurityPermissions.PlatformAdmin, "Platform", "Admin");
        await using (var context = database.Context())
        {
            context.AddRange(org, role, excluded, read, platform,
                RolePermission.Create(role.IdRole, read.IdPermission), RolePermission.Create(excluded.IdRole, platform.IdPermission));
            await context.SaveChangesAsync();
        }
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:GestIa"] = database.ConnectionString });
        builder.Services.AddApplication().AddInfrastructure(builder.Configuration);
        builder.Services.AddGestIaRequestContext();
        builder.Services.AddSingleton<IActorContext>(actor);
        builder.Services.AddSingleton<IClock>(new Clock());
        await using var app = builder.Build();
        app.Use(async (context, next) =>
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim("organization", org.IdOrganization.ToString()), new Claim("permission", SecurityPermissions.UsersRead)], "Test"));
            await next(context);
        });
        app.MapOrganizationSecurityEndpoints();
        await app.StartAsync(CancellationToken.None);
        using var client = app.GetTestClient();
        var permissions = await client.GetFromJsonAsync<System.Text.Json.JsonElement[]>($"/api/v1/organization-security/permissions?organizationId={org.IdOrganization}", CancellationToken.None);
        Assert.Single(permissions!);
        Assert.Equal("TEST.READ", permissions![0].GetProperty("codePermission").GetString());
    }

    private sealed class Actor : IActorContext
    {
        public Guid ActorId { get; } = Guid.NewGuid();
        public string ActorName => "Query test";
    }
    private sealed class Clock : IClock { public DateTime UtcNow => DateTime.UtcNow; public DateOnly Today => DateOnly.FromDateTime(UtcNow); }
}
