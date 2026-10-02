namespace GestIA.Api.Security;

/// <summary>Los nombres de las políticas del limitador, en un sitio.</summary>
public static class RateLimitPolicies
{
    public const string Login = "login";
}

/// <summary>
/// Deja el correo del intento de acceso al alcance del limitador.
///
/// <para><b>Por qué es un middleware y no una función del limitador.</b> El repartidor del
/// limitador es síncrono, y leer el cuerpo de la petición de forma síncrona está prohibido en
/// ASP.NET Core salvo que se habilite <c>AllowSynchronousIO</c> —que es peor que este archivo—.
/// Aquí se lee <b>asíncronamente</b>, antes de que el limitador decida, y el valor viaja en
/// <c>HttpContext.Items</c>.</para>
///
/// <para>El flujo se rebobina: el endpoint lo lee después y lo encontraría vacío si no.</para>
///
/// <para>Un cuerpo ausente, ilegible o sin correo cae a una marca fija, y todas esas peticiones
/// comparten cubo. Es lo que se quiere: no hay forma legítima de pedir acceso sin decir quién.</para>
/// </summary>
public sealed class LoginEmailMiddleware(RequestDelegate next)
{
    public const string ItemKey = "login-email";

    private const string SinCorreo = "sin-correo";
    private const string Ruta = "/api/v1/auth/login";

    /// <summary>Tope de lectura. Un cuerpo mayor no es un intento de acceso.</summary>
    private const int MaximoBytes = 4 * 1024;

    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Request.Path.StartsWithSegments(Ruta, StringComparison.OrdinalIgnoreCase))
        {
            context.Items[ItemKey] = await ReadEmailAsync(context);
        }

        await next(context);
    }

    private static async Task<string> ReadEmailAsync(HttpContext context)
    {
        try
        {
            context.Request.EnableBuffering();

            var buffer = new byte[MaximoBytes];
            var leidos = await context.Request.Body.ReadAsync(buffer.AsMemory());
            context.Request.Body.Position = 0;

            if (leidos == 0)
            {
                return SinCorreo;
            }

            using var documento = System.Text.Json.JsonDocument.Parse(buffer.AsMemory(0, leidos));

            return documento.RootElement.TryGetProperty("email", out var correo) &&
                correo.ValueKind == System.Text.Json.JsonValueKind.String
                ? (correo.GetString() ?? SinCorreo).Trim().ToLowerInvariant()
                : SinCorreo;
        }
        catch (Exception excepcion) when (excepcion is System.Text.Json.JsonException or IOException)
        {
            // Un cuerpo ilegible no puede tumbar el acceso de nadie: cae al cubo común y sigue.
            return SinCorreo;
        }
    }

    /// <summary>Lo que el repartidor del limitador lee, ya resuelto por el middleware.</summary>
    public static string Email(HttpContext context) =>
        context.Items.TryGetValue(ItemKey, out var valor) && valor is string correo
            ? correo
            : SinCorreo;
}
