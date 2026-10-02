namespace GestIA.Domain.Catalogs;

public enum EligibilityRequirementType
{
    Skill,
    Document,
    Evaluation,
    /// <summary>
    /// <b>Retirado el 19 de septiembre de 2026.</b> No se pueden crear reglas de este tipo.
    ///
    /// <para>Su efecto lo absorbieron las incidencias administrativas, que hacen lo mismo mejor:
    /// dejan constancia con fecha, tipo y detalle, y se retiran sin borrarse. Una restricción era
    /// una regla sin requisito —no exigía nada, prohibía—, y eso es lo que la hacía rara de
    /// resolver: no tenía entrada de catálogo de la que heredar su severidad.</para>
    ///
    /// <para>El miembro se conserva porque el tipo se persiste como texto y borrarlo dejaría
    /// ilegible cualquier fila que lo tuviera. En <c>db-gestia-dev</c> no había ninguna, ni activa
    /// ni inactiva, y la migración que lo retiró desactiva las que pudieran aparecer.</para>
    /// </summary>
    Restriction
}
