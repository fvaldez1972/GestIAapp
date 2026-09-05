using GestIA.Application.Common;

namespace GestIA.Api.Security;

/// <summary>
/// Implementación por petición de <see cref="IOrganizationContext"/>. Guarda el valor en
/// <see cref="HttpContext.Items"/> para que sobreviva a cualquier ámbito de servicios que se
/// cree dentro de la petición y siga siendo el mismo que vio el guard.
/// </summary>
public sealed class HttpOrganizationContext(IHttpContextAccessor httpContextAccessor)
    : IOrganizationContext
{
    private const string ItemKey = "GestIA.CurrentOrganizationId";

    public Guid? CurrentOrganizationId =>
        httpContextAccessor.HttpContext?.Items.TryGetValue(ItemKey, out var value) == true &&
        value is Guid organizationId
            ? organizationId
            : null;

    public void SetAuthorizedOrganization(Guid organizationId)
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException(
                "No hay petición en curso: la organización autorizada sólo se fija dentro de una.");

        if (httpContext.Items.TryGetValue(ItemKey, out var existing) &&
            existing is Guid current &&
            current != organizationId)
        {
            throw new InvalidOperationException(
                $"La petición ya estaba autorizada para la organización {current} y ahora pide " +
                $"{organizationId}. Una petición opera sobre una sola organización: si hace falta " +
                "cruzar dos, es una decisión de diseño, no un cambio de contexto a media petición.");
        }

        httpContext.Items[ItemKey] = organizationId;
    }
}
