using GestIA.Domain.Common;

namespace GestIA.Domain.History;

/// <summary>Las acciones que registra la bitácora. Se derivan del cambio, no se inventan.</summary>
public static class OperationalEventActions
{
    public const string Created = "Created";
    public const string Updated = "Updated";
    public const string Deactivated = "Deactivated";
    public const string Reactivated = "Reactivated";
}

/// <summary>
/// Una corrección sobre un registro operativo: qué registro, qué había antes, qué quedó después,
/// quién y cuándo, y el motivo cuando la regla lo exigía.
///
/// <para><b>Es una sola tabla para las cinco entidades</b>, identificadas por
/// <see cref="EntityType"/> y <see cref="RecordId"/> en vez de por una llave foránea. El costo es
/// que no hay integridad referencial declarada; a cambio, sumar una sexta entidad no toca el
/// esquema. Fue una decisión explícita, no una omisión.</para>
///
/// <para><b>Es de sólo agregar.</b> <c>GestIaDbContext</c> rechaza cualquier intento de
/// modificarla o eliminarla, igual que con <c>BusinessDocumentEvent</c>. Y no expone ningún
/// método de instancia que cambie su estado: se crea y se queda.</para>
///
/// <para><b>El evento lo emite <c>SaveChanges</c></b>, no cada servicio. Una bitácora que
/// depende de que alguien se acuerde de escribirla no es una bitácora: el día que alguien agregue
/// una ruta de escritura y olvide registrar, el hueco no rompe nada y sólo se descubre cuando ya
/// hace falta el dato. Emitirla desde el guardado la hace imposible de olvidar y garantiza, por
/// construcción, que el evento y el cambio viajan en la misma transacción.</para>
/// </summary>
public sealed class OperationalEvent : IOrganizationScopedEntity
{
    private OperationalEvent()
    {
    }

    public Guid IdOperationalEvent { get; private set; }

    public Guid IdOrganization { get; private set; }

    public OperationalEntityType EntityType { get; private set; }

    public Guid RecordId { get; private set; }

    public string Action { get; private set; } = string.Empty;

    /// <summary>Foto previa. Nula sólo cuando el registro se acaba de crear.</summary>
    public string? BeforeSnapshot { get; private set; }

    public string AfterSnapshot { get; private set; } = string.Empty;

    /// <summary>
    /// El motivo de la corrección. Se pide <b>una vez por operación de guardado, no por campo</b>,
    /// y cuando es obligatorio llega vacío desde la interfaz, sin sugerencias: un motivo
    /// prellenado se acepta sin leerse y deja de ser información.
    /// </summary>
    public string? Reason { get; private set; }

    /// <summary>
    /// Si la regla exigía motivo en ese momento. El nombre empieza con <c>Is</c> porque el
    /// estándar de base de datos sólo admite booleanos con <c>Is</c>, <c>Has</c> o <c>Can</c>;
    /// léase como "este evento es de los que exigían motivo".
    ///
    /// Se guarda para poder auditar después la regla misma, y no sólo su resultado: un evento sin
    /// motivo puede significar "no hacía falta" o "se coló", y sin este campo las dos cosas se
    /// ven igual.
    /// </summary>
    public bool IsReasonRequired { get; private set; }

    public Guid ActorId { get; private set; }

    public string ActorName { get; private set; } = string.Empty;

    public DateTime OccurredAt { get; private set; }

    public static OperationalEvent Record(
        OperationalSnapshotCapture after,
        string? beforeSnapshot,
        string action,
        string? reason,
        bool isReasonRequired,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentNullException.ThrowIfNull(after);
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(actorName);

        if (isReasonRequired && string.IsNullOrWhiteSpace(reason))
        {
            throw new InvalidOperationException(
                "La corrección exigía motivo y no se recibió ninguno. El motivo se valida en la " +
                "capa de aplicación antes de tocar el registro; llegar aquí sin él significa que " +
                "alguien saltó esa validación.");
        }

        return new OperationalEvent
        {
            IdOperationalEvent = Guid.NewGuid(),
            IdOrganization = after.IdOrganization,
            EntityType = after.EntityType,
            RecordId = after.RecordId,
            Action = action,
            BeforeSnapshot = beforeSnapshot,
            AfterSnapshot = after.Json,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            IsReasonRequired = isReasonRequired,
            ActorId = actorId,
            ActorName = actorName.Trim(),
            OccurredAt = occurredAt.Kind == DateTimeKind.Local
                ? occurredAt.ToUniversalTime()
                : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc)
        };
    }
}
