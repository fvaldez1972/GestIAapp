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
    ServiceAssignment,

    /// <summary>
    /// Una entrada de catálogo, por su marca de obligatorio o informativa.
    ///
    /// <para><b>Entró el 19 de septiembre de 2026 y es la primera que no es un registro operativo.</b>
    /// La razón es que desde la conversión de los catálogos, esa marca decide si una persona puede
    /// trabajar: cambiarla de informativa a obligatoria deja fuera, en la siguiente validación, a
    /// todo el que no cumpla. Un campo con esa consecuencia necesita decir de qué a qué cambió y
    /// por qué, y no sólo quién lo tocó.</para>
    ///
    /// <para>Va al final del enum, como manda el comentario de arriba: se guarda como texto, así
    /// que agregar aquí no reinterpreta ninguna fila ya escrita.</para>
    /// </summary>
    BusinessCatalogItem
}
