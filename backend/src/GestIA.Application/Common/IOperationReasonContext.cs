namespace GestIA.Application.Common;

/// <summary>
/// El motivo de la corrección en curso, y si la regla lo exigía.
///
/// <para><b>Por qué es ambiental y no un parámetro.</b> El evento de historial lo emite
/// <c>SaveChanges</c>, no cada servicio, para que no se pueda olvidar. Pero <c>SaveChanges</c> no
/// sabe si el día estaba cerrado ni si el periodo había vencido: eso lo decide la capa de
/// aplicación, que sí puede consultarlo. Este contexto es el canal entre las dos, igual que
/// <see cref="IOrganizationContext"/> lo es entre el guard y el filtro de consulta.</para>
///
/// <para><b>Se fija una vez por operación de guardado, no por campo.</b> Corregir tres campos de
/// una misma configuración es una sola corrección y pide un solo motivo; el
/// <c>SaveChanges</c> que la guarda es exactamente esa unidad.</para>
///
/// <para>Cuando el motivo es obligatorio, la interfaz lo pide <b>vacío, sin valor por defecto ni
/// sugerencias</b>, y con un mínimo de caracteres: un motivo prellenado se acepta sin leerse y
/// deja de ser información.</para>
/// </summary>
public interface IOperationReasonContext
{
    string? Reason { get; }

    /// <summary>Si la regla exigía motivo para esta corrección. Se guarda en el evento.</summary>
    bool IsReasonRequired { get; }

    /// <summary>
    /// Acción con nombre de negocio, cuando el servicio quiere una más precisa que la derivada
    /// del cambio. Si nadie la declara, se usa <c>Created</c>, <c>Updated</c>,
    /// <c>Deactivated</c> o <c>Reactivated</c> según lo que haya pasado.
    /// </summary>
    string? DeclaredAction { get; }

    void SetReason(string? reason, bool isRequired);

    void DeclareAction(string action);

    /// <summary>
    /// Olvida lo declarado. Se llama al terminar un guardado para que un motivo no se herede a
    /// una corrección posterior de la misma petición, que quedaría registrada con una
    /// justificación que no le corresponde.
    /// </summary>
    void Clear();
}
