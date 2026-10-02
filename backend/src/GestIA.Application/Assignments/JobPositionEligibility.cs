namespace GestIA.Application.Assignments;

/// <summary>
/// Si el puesto de una persona la descalifica para una posición.
///
/// <para><b>Se compara por identificador, no por texto.</b> Antes esto era un <c>Contains</c>
/// entre dos campos de texto libre —el puesto del empleado y el "perfil requerido" de la
/// posición— y fallaba en las dos direcciones: bloqueaba a alguien capaz por una diferencia de
/// redacción, y habilitaba a alguien por una coincidencia accidental de subcadena. "Guardia" y
/// "Guardia de seguridad" se aceptaban entre sí; "guardia de seguridad" en minúsculas también,
/// pero "Guardía" con acento no.</para>
///
/// <para><b>Un nulo no bloquea, y es la decisión que más importa aquí.</b> Un nulo significa "no
/// sabemos cuál es su puesto", normalmente porque el texto heredado no correspondía a ninguna
/// entrada del catálogo. No es lo mismo que "no cumple el perfil". Tratarlos igual dejaría sin
/// poder asignar a gente que sí puede, sólo porque un dato viejo estaba mal escrito, y convertiría
/// una limpieza de datos pendiente en una parálisis operativa.</para>
/// </summary>
public static class JobPositionEligibility
{
    /// <summary>
    /// Bloquea sólo cuando <b>los dos</b> lados declaran un puesto y son distintos.
    /// </summary>
    public static bool IsBlocked(Guid? requiredByPosition, Guid? heldByEmployee) =>
        requiredByPosition is { } required &&
        heldByEmployee is { } held &&
        required != held;
}
