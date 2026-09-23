using GestIA.Api.Endpoints;
using GestIA.Api.ErrorHandling;
using GestIA.Api.Security;
using GestIA.Application;
using GestIA.Application.Common;
using GestIA.Application.Security;
using GestIA.Infrastructure;
using GestIA.Infrastructure.Persistence;
using GestIA.Infrastructure.Persistence.DemoData;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Globalization;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.Configure<JsonOptions>(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
builder.Services.AddHttpContextAccessor();

// El limitador del login.
//
// `/api/v1/auth/login` es el **unico** endpoint anonimo del sistema, y cada intento cuesta 210 000
// iteraciones de PBKDF2. Ese coste es exactamente lo que protege las contrasenas de quien roba la
// base, y exactamente lo que convierte al endpoint en un amplificador: unas pocas peticiones por
// segundo consumen CPU de verdad. Ademas permitia probar contrasenas sin freno.
//
// Se reparte por **IP y correo a la vez**: solo por IP, una oficina entera detras de un NAT
// comparte cubo y se estorban entre companeros; solo por correo, quien prueba mil correos distintos
// no encuentra freno. La clave es el par.
//
// Ventana fija y no deslizante porque aqui basta: cinco intentos por minuto no es un limite de
// caudal, es un tope para que probar contrasenas deje de ser gratis. Una persona que se equivoca
// no lo alcanza.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy(RateLimitPolicies.Login, context =>
    {
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "sin-ip";

        return RateLimitPartition.GetFixedWindowLimiter(
            $"{ip}|{LoginEmailMiddleware.Email(context)}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
    });
});
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<IActorContext, HttpActorContext>();
builder.Services.AddGestIaRequestContext();
// El huso se resuelve aqui, al arrancar, para que un identificador invalido detenga el
// arranque con un mensaje claro en vez de fallar en la primera consulta que use "hoy".
builder.Services.AddSingleton<IClock>(new SystemClock(SystemClock.ResolveTimeZone(builder.Configuration)));
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
// Antes del limitador: le deja resuelto el correo del intento, que su repartidor no puede leer
// por su cuenta sin hacer E/S sincrona.
app.UseMiddleware<LoginEmailMiddleware>();
app.UseRateLimiter();
app.UseMiddleware<JwtAuthenticationMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// El sembrado de seguridad va **apagado salvo que se pida**, como los datos demo.
//
// Estaba encendido por omisión, y eso hacía que las tres capas apuntaran al mismo sitio: si nadie
// ponía `BootstrapAdmin__Password`, el sembrador caía a una contraseña escrita en el código y
// publicada en `.env.example`. Un ambiente nuevo que olvidara las dos variables arrancaba con un
// administrador de credencial conocida.
//
// Invertir el valor por omisión es lo que convierte ese olvido en «no pasa nada» en vez de en «hay
// un administrador que cualquiera puede usar». Las bases ya sembradas no lo necesitan: tienen sus
// permisos, sus roles y su administrador desde el primer arranque.
if (app.Configuration.GetValue("SecuritySeed:Enabled", false))
{
    await SeedSecurityDataAsync(app);
}

// Datos demo: pieza separada del bootstrap, apagada salvo que se pida explícitamente.
if (app.Configuration.GetValue($"{DemoDataOptions.SectionName}:Enabled", false))
{
    await SeedDemoDataAsync(app);
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

// El día operativo y el huso salen de aquí porque el navegador no puede calcularlos: en UTC el
// día empieza entre seis y siete horas antes que en México, y una barra de contexto que hiciera
// `new Date()` mostraría un día distinto del que el servidor usa para decidir vigencias y
// elegibilidad. Sería el mismo defecto que el reloj operativo cerró, movido de capa.
app.MapGet("/api/v1/system/info", (IClock clock) => Results.Ok(new
{
    application = "GestIA",
    apiVersion = "v1",
    status = "ready",
    persistence = "SQL Server",
    operationDate = clock.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
    timeZoneId = clock.OperationalTimeZone.Id
}))
    .WithName("GetSystemInfo")
    .WithTags("System");

app.MapAuthEndpoints();
app.MapOrganizationEndpoints();
app.MapClientEndpoints();
app.MapClientZoneEndpoints();
app.MapGeographyEndpoints();
app.MapClientContactEndpoints();
app.MapServiceManagementEndpoints();
app.MapWorkforceEndpoints();
app.MapAdministrativeIncidentEndpoints();
app.MapPlanningEndpoints();
app.MapAssignmentEndpoints();
app.MapSchedulingEndpoints();
app.MapOperationsEndpoints();
app.MapFileUploadEndpoints();
app.MapBusinessDocumentEndpoints();
app.MapCatalogEndpoints();
app.MapShiftPatternTemplateEndpoints();
app.MapReportsEndpoints();
app.MapOverviewEndpoints();
app.MapSecurityAdministrationEndpoints();
app.MapOrganizationSecurityEndpoints();
app.MapOperationalRequestEndpoints();
app.MapAuditEndpoints();
app.MapOperationalHistoryEndpoints();

app.Run();

static async Task SeedSecurityDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<SecurityDataSeeder>();
    await seeder.SeedAsync(app.Lifetime.ApplicationStopping);
}

static async Task SeedDemoDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<DemoDataSeeder>();
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
