using GestIA.Application.Support;

namespace GestIA.Api.Security;

public static class SupportSessionContext
{
    public const string HeaderName = "X-GestIA-Support-Session";
    public const string ItemKey = "GestIA.SupportSession";

    public static SupportSessionResponse? Current(HttpContext context) =>
        context.Items.TryGetValue(ItemKey, out var value) ? value as SupportSessionResponse : null;
}
