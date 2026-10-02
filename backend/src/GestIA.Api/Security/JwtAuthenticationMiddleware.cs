using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace GestIA.Api.Security;

public sealed class JwtAuthenticationMiddleware(
    RequestDelegate next,
    IOptions<JwtOptions> options,
    ILogger<JwtAuthenticationMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var authorization = context.Request.Headers.Authorization.ToString();

        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = authorization["Bearer ".Length..].Trim();
            var principal = ValidateToken(token, options.Value);

            if (principal is not null)
            {
                context.User = principal;
            }
            else
            {
                JwtAuthLog.InvalidToken(logger, context.Request.Path);
            }
        }

        await next(context);
    }

    private static ClaimsPrincipal? ValidateToken(string token, JwtOptions options)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            return null;
        }

        var unsignedToken = $"{parts[0]}.{parts[1]}";
        var expectedSignature = JwtAccessTokenService.HmacSha256(unsignedToken, options.Secret);

        // En tiempo constante, y no con `string.Equals`.
        //
        // `string.Equals` corta en el primer caracter distinto, asi que el tiempo de respuesta
        // filtra cuantos caracteres de la firma acerto quien la mando. Explotarlo por red es muy
        // dificil —el ruido de latencia supera de largo la diferencia—, pero el arreglo es una
        // linea y **este proyecto ya lo hace bien en las contraseñas**:
        // `Pbkdf2PasswordHashService.Verify` usa `FixedTimeEquals` desde siempre. Que la
        // contraseña se compare en tiempo constante y la firma no, no era una decision.
        //
        // Se comparan los bytes en ASCII: las dos cadenas son base64url, asi que un caracter es un
        // byte y `FixedTimeEquals` puede hacer su trabajo sin decodificar nada.
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(expectedSignature),
                Encoding.ASCII.GetBytes(parts[2])))
        {
            return null;
        }

        using var document = JsonDocument.Parse(JwtAccessTokenService.Base64UrlDecode(parts[1]));
        var root = document.RootElement;

        if (!root.TryGetProperty("exp", out var expProperty))
        {
            return null;
        }

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(expProperty.GetInt64());
        if (expiresAt <= DateTimeOffset.UtcNow)
        {
            return null;
        }

        if (!Matches(root, "iss", options.Issuer) || !Matches(root, "aud", options.Audience))
        {
            return null;
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, root.GetProperty("sub").GetString() ?? string.Empty),
            new(ClaimTypes.Name, root.GetProperty("name").GetString() ?? string.Empty),
            new(ClaimTypes.Email, root.GetProperty("email").GetString() ?? string.Empty)
        };

        if (root.TryGetProperty("permissions", out var permissions))
        {
            claims.AddRange(permissions.EnumerateArray()
                .Select(item => new Claim("permission", item.GetString() ?? string.Empty)));
        }

        if (root.TryGetProperty("organizations", out var organizations))
        {
            claims.AddRange(organizations.EnumerateArray()
                .Select(item => new Claim("organization", item.GetString() ?? string.Empty)));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "GestIAJwt"));
    }

    private static bool Matches(JsonElement root, string propertyName, string expected) =>
        root.TryGetProperty(propertyName, out var property) &&
        string.Equals(property.GetString(), expected, StringComparison.Ordinal);
}

internal static partial class JwtAuthLog
{
    [LoggerMessage(
        EventId = 4001,
        Level = LogLevel.Warning,
        Message = "Invalid JWT token received for {Path}.")]
    public static partial void InvalidToken(ILogger logger, string path);
}
