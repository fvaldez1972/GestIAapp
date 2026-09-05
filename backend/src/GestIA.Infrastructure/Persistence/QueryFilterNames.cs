namespace GestIA.Infrastructure.Persistence;

/// <summary>
/// Nombres de filtro para los <c>IgnoreQueryFilters</c> que viven <b>dentro de un árbol de
/// expresión</b> —subconsultas escritas en el predicado de otra consulta—, donde C# no admite
/// expresiones de colección (CS9175) y el analizador exige un campo estático en lugar de crear
/// el arreglo en cada llamada (CA1861).
///
/// En el resto del código la forma normal es la literal, <c>IgnoreQueryFilters(["Active"])</c>,
/// que se lee mejor en el punto de uso. Las dos dicen exactamente lo mismo: apagar el borrado
/// lógico y <b>dejar intacto el filtro de organización</b>.
/// </summary>
internal static class QueryFilterNames
{
    internal static readonly string[] ActiveOnly = ["Active"];

    /// <summary>
    /// Apaga además el aislamiento entre organizaciones. Es el bypass explícito, y una prueba de
    /// arquitectura lo limita a una lista blanca: hoy, la vista de plataforma del super admin y
    /// el sembrador demo. Agregar un archivo a esa lista es un cambio visible en el diff.
    /// </summary>
    internal static readonly string[] ActiveAndOrganization = ["Active", "Organization"];
}
