using GestIA.Application.Common;

namespace GestIA.Api.Security;

/// <summary>
/// Implementación por petición de <see cref="IOperationReasonContext"/>. Guarda el valor en
/// <see cref="HttpContext.Items"/>, con el mismo mecanismo que
/// <see cref="HttpOrganizationContext"/>, para que sobreviva a cualquier ámbito de servicios que
/// se cree dentro de la petición.
/// </summary>
public sealed class HttpOperationReasonContext(IHttpContextAccessor httpContextAccessor)
    : IOperationReasonContext
{
    private const string ReasonKey = "GestIA.CorrectionReason";
    private const string RequiredKey = "GestIA.CorrectionReasonWasRequired";
    private const string ActionKey = "GestIA.CorrectionAction";

    public string? Reason => Item(ReasonKey) as string;

    public bool IsReasonRequired => Item(RequiredKey) is true;

    public string? DeclaredAction => Item(ActionKey) as string;

    public void SetReason(string? reason, bool isRequired)
    {
        var items = Items();
        items[ReasonKey] = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        items[RequiredKey] = isRequired;
    }

    public void DeclareAction(string action)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        Items()[ActionKey] = action.Trim();
    }

    public void Clear()
    {
        var items = httpContextAccessor.HttpContext?.Items;

        if (items is null)
        {
            return;
        }

        items.Remove(ReasonKey);
        items.Remove(RequiredKey);
        items.Remove(ActionKey);
    }

    private object? Item(string key) =>
        httpContextAccessor.HttpContext?.Items.TryGetValue(key, out var value) == true ? value : null;

    private IDictionary<object, object?> Items() =>
        httpContextAccessor.HttpContext?.Items
        ?? throw new InvalidOperationException(
            "No hay petición en curso: el motivo de una corrección sólo se fija dentro de una.");
}
