using GestIA.Api.Endpoints;
using GestIA.Api.ErrorHandling;
using GestIA.Api.Security;
using GestIA.Application;
using GestIA.Application.Common;
using GestIA.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IActorContext, HttpActorContext>();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
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

app.MapOrganizationEndpoints();
app.MapClientEndpoints();

app.Run();

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
