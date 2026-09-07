using GestIA.Domain.Operations;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Common;

/// <summary>
/// Cuándo una corrección tiene que venir justificada.
///
/// <para>La regla no es "toda corrección pide motivo": eso convierte el motivo en un trámite que
/// se llena sin pensar. Pide motivo <b>sólo cuando se toca algo que ya se cerró o venció</b>, que
/// es cuando el cambio deja de ser captura y pasa a ser corrección de un hecho consumado.</para>
///
/// <para>Y pide <b>un motivo por operación de guardado, no por campo</b>: corregir tres datos de
/// una misma configuración es una sola corrección.</para>
/// </summary>
public static class CorrectionReasonPolicy
{
    /// <summary>
    /// Mínimo de caracteres del motivo. No existía un mínimo en el sistema —la reapertura de un
    /// cierre sólo exige que no venga vacío—, así que se fija aquí: suficiente para descartar
    /// "ok", "ya" o "error", sin volverlo una carga.
    /// </summary>
    public const int MinimumLength = 10;

    /// <summary>Coincide con el máximo de <c>OperationDayClosure.ReopenReason</c>.</summary>
    public const int MaximumLength = 1200;

    /// <summary>
    /// Las tres entidades de operación diaria se apoyan en el cierre del día: si el día del
    /// registro está cerrado para su servicio, corregirlo exige motivo. Un día reabierto no lo
    /// exige, porque reabrirlo ya fue una decisión justificada por sí misma.
    ///
    /// <para>Devuelve <b>por qué</b> hace falta el motivo, o <c>null</c> si no hace falta. Las
    /// dos preguntas son la misma, y tenerlas juntas evita que el mensaje de error describa una
    /// regla distinta de la que se aplicó.</para>
    /// </summary>
    public static string? DayClosureRequirement(OperationDayClosure? closure) =>
        closure is { Status: OperationDayClosureStatus.Closed }
            ? "corrige un registro de un día ya cerrado"
            : null;

    /// <summary>
    /// La configuración de un servicio pide motivo en dos casos.
    ///
    /// <list type="number">
    /// <item>Su vigencia ya terminó: se está corrigiendo el pasado.</item>
    /// <item>El cambio toca <b>el precio, la moneda o el impuesto</b>, esté vigente o no. Ése es
    /// el dato que se le factura al cliente, y cambiarlo mientras está vigente es más delicado
    /// que corregir una vigencia pasada, no menos.</item>
    /// </list>
    /// </summary>
    public static string? ConfigurationRequirement(
        ServiceConfiguration current,
        decimal monthlyPrice,
        string currencyCode,
        bool isTaxIncluded,
        DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(current);

        if (current.MonthlyPrice != monthlyPrice ||
            !string.Equals(current.CurrencyCode, currencyCode, StringComparison.Ordinal) ||
            current.IsTaxIncluded != isTaxIncluded)
        {
            return "toca el precio, la moneda o el impuesto que se le factura al cliente";
        }

        return HasExpired(current.EffectiveToDate, today)
            ? "corrige una configuración cuya vigencia ya terminó"
            : null;
    }

    /// <summary>
    /// La asignación pide motivo si su periodo ya terminó. Una asignación sin fecha de fin sigue
    /// viva y editarla es operación normal, no corrección.
    /// </summary>
    public static string? AssignmentRequirement(ServiceAssignment current, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(current);

        return HasExpired(current.EndDate, today)
            ? "corrige una asignación cuyo periodo ya terminó"
            : null;
    }

    /// <summary>
    /// Valida el motivo recibido y devuelve el que hay que registrar.
    ///
    /// Cuando es obligatorio, la interfaz lo pide <b>vacío y sin sugerencias</b>: un motivo
    /// prellenado se acepta sin leerse y deja de ser información. Por eso aquí no hay valor por
    /// omisión que rellenar, sólo un mínimo que cumplir.
    /// </summary>
    /// <param name="requirement">
    /// Por qué hace falta el motivo, o <c>null</c> si no hace falta. El texto entra en el mensaje
    /// de error para que diga la regla que se aplicó y no una genérica.
    /// </param>
    public static string? Validate(
        string? reason,
        string? requirement,
        string fieldName,
        IDictionary<string, string[]> errors)
    {
        ArgumentNullException.ThrowIfNull(errors);

        var trimmed = reason?.Trim();

        if (string.IsNullOrEmpty(trimmed))
        {
            if (requirement is not null)
            {
                errors[fieldName] = [$"Este cambio {requirement}: explica el motivo."];
            }

            return null;
        }

        if (trimmed.Length < MinimumLength)
        {
            errors[fieldName] =
                [$"El motivo debe tener al menos {MinimumLength} caracteres."];
        }
        else if (trimmed.Length > MaximumLength)
        {
            errors[fieldName] =
                [$"El motivo no puede exceder {MaximumLength} caracteres."];
        }

        return trimmed;
    }

    private static bool HasExpired(DateOnly? endDate, DateOnly today) =>
        endDate is { } date && date < today;
}
