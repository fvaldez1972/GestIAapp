namespace GestIA.Domain.History;

/// <summary>
/// Las entidades cuya corrección deja rastro en <see cref="OperationalEvent"/>.
///
/// <para><b>Por qué no están todas.</b> Los turnos y las versiones de rol quedan fuera a
/// propósito: su versionado <i>es</i> su historial, y duplicarlo aquí crearía dos relatos del
/// mismo hecho que podrían discrepar. Los documentos tampoco: ya tienen
/// <c>BusinessDocumentEvent</c>, que se queda como está.</para>
///
/// <para>Se guarda como texto, no como número, para que un valor agregado en medio del enum no
/// cambie el significado de las filas ya escritas.</para>
/// </summary>
public enum OperationalEntityType
{
    AttendanceRecord,
    ServiceConfiguration,
    Incident,
    CoverageRecord,
    ServiceAssignment
}
