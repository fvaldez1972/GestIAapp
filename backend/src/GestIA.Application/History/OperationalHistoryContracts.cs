using GestIA.Domain.History;

namespace GestIA.Application.History;

/// <summary>
/// Un cambio del historial de un registro operativo.
///
/// Las fotos viajan como JSON tal cual se guardaron. Son <b>metadatos con lista blanca</b>: no
/// contienen el texto libre del registro, sólo si estaba lleno o vacío. Quien necesite el
/// contenido lo lee del registro, con el permiso del registro.
/// </summary>
public sealed record OperationalEventResponse(
    Guid IdOperationalEvent,
    OperationalEntityType EntityType,
    Guid RecordId,
    string Action,
    string? Reason,
    bool IsReasonRequired,
    string ActorName,
    DateTime OccurredAt,
    string? BeforeSnapshot,
    string AfterSnapshot);
