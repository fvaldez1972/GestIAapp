using System.Security.Claims;
using GestIA.Application.Common;

namespace GestIA.Api.Security;

public sealed class HttpActorContext(IHttpContextAccessor httpContextAccessor) : IActorContext
{
    private static readonly Guid LocalActorId =
        Guid.Parse("00000000-0000-0000-0000-000000000001");

    public Guid ActorId
    {
        get
        {
            var value = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var actorId) ? actorId : LocalActorId;
        }
    }

    public string ActorName =>
        httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Name)
        ?? httpContextAccessor.HttpContext?.User.Identity?.Name
        ?? "GestIA Local";
}
