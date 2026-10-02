namespace GestIA.Api.Security;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "GestIA";
    public string Audience { get; set; } = "GestIA.Web";
    public string Secret { get; set; } = string.Empty;
    public int ExpiresMinutes { get; set; } = 480;
}
