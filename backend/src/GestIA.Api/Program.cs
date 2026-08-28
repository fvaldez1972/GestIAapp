using GestIA.Api.Endpoints;
using GestIA.Api.ErrorHandling;
using GestIA.Api.Security;
using GestIA.Application;
using GestIA.Application.Common;
using GestIA.Application.Security;
using GestIA.Infrastructure;
using GestIA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.Configure<JsonOptions>(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddHttpContextAccessor();
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<IActorContext, HttpActorContext>();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<IAccessTokenService, JwtAccessTokenService>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var jwtSecret = builder.Configuration["Jwt:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
{
    throw new InvalidOperationException("Jwt__Secret debe tener al menos 32 caracteres.");
}

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<JwtAuthenticationMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (app.Configuration.GetValue("SecuritySeed:Enabled", true))
{
    await SeedSecurityDataAsync(app);
}

var livenessOptions = new HealthCheckOptions
{
    Predicate = _ => false
};

app.MapHealthChecks("/health", livenessOptions);
app.MapHealthChecks("/health/live", livenessOptions);
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = WriteReadinessResponseAsync
});

app.MapGet("/api/v1/system/info", () => Results.Ok(new
{
    application = "GestIA",
    apiVersion = "v1",
    status = "ready",
    persistence = "SQL Server"
}))
    .WithName("GetSystemInfo")
    .WithTags("System");

app.MapAuthEndpoints();
app.MapOrganizationEndpoints();
app.MapClientEndpoints();
app.MapClientSiteEndpoints();
app.MapClientContactEndpoints();
app.MapServiceManagementEndpoints();
app.MapWorkforceEndpoints();
app.MapPlanningEndpoints();
app.MapAssignmentEndpoints();
app.MapSchedulingEndpoints();
app.MapOperationsEndpoints();
app.MapReportsEndpoints();
app.MapSecurityAdministrationEndpoints();
app.MapOperationalRequestEndpoints();
app.MapAuditEndpoints();

app.Run();

static async Task SeedSecurityDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<SecurityDataSeeder>();
    await seeder.SeedAsync(app.Lifetime.ApplicationStopping);
}

static async Task WriteReadinessResponseAsync(HttpContext context, HealthReport report)
{
    var logger = context.RequestServices
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("GestIA.Readiness");

    foreach (var (name, entry) in report.Entries.Where(item => item.Value.Exception is not null))
    {
        ReadinessLog.Failed(logger, name, entry.Exception!);
    }

    context.Response.ContentType = "text/plain";
    await context.Response.WriteAsync(report.Status.ToString());
}

public partial class Program;

internal static partial class ReadinessLog
{
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Error,
        Message = "Readiness check {HealthCheckName} failed.")]
    public static partial void Failed(ILogger logger, string healthCheckName, Exception exception);
}
