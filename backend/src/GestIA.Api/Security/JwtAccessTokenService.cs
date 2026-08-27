using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GestIA.Application.Security;
using Microsoft.Extensions.Options;

namespace GestIA.Api.Security;

public sealed class JwtAccessTokenService(IOptions<JwtOptions> options) : IAccessTokenService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AuthSessionResponse CreateSession(AuthenticatedUserAccess user)
    {
        var jwtOptions = options.Value;
        var expiresAt = DateTime.UtcNow.AddMinutes(jwtOptions.ExpiresMinutes);
        var claims = new Dictionary<string, object>
        {
            ["sub"] = user.IdUser.ToString(),
            ["name"] = user.DisplayName,
            ["email"] = user.Email,
            ["iss"] = jwtOptions.Issuer,
            ["aud"] = jwtOptions.Audience,
            ["exp"] = new DateTimeOffset(expiresAt).ToUnixTimeSeconds(),
            ["iat"] = new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds(),
            ["permissions"] = user.Permissions,
            ["organizations"] = user.Organizations.Select(item => item.IdOrganization.ToString()).ToArray()
        };

        var token = SignJwt(claims, jwtOptions.Secret);

        return new AuthSessionResponse(
            token,
            expiresAt,
            new AuthUserResponse(user.IdUser, user.Email, user.DisplayName),
            user.Organizations,
            user.Permissions);
    }

    private static string SignJwt(Dictionary<string, object> claims, string secret)
    {
        var header = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(new
        {
            alg = "HS256",
            typ = "JWT"
        }, JsonOptions));
        var payload = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(claims, JsonOptions));
        var unsignedToken = $"{header}.{payload}";
        var signature = HmacSha256(unsignedToken, secret);
        return $"{unsignedToken}.{signature}";
    }

    internal static string Base64UrlEncode(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    internal static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }

    internal static string HmacSha256(string value, string secret)
    {
        var key = Encoding.UTF8.GetBytes(secret);
        using var hmac = new HMACSHA256(key);
        return Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(value)));
    }
}
