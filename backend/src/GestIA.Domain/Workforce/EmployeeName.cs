namespace GestIA.Domain.Workforce;

/// <summary>
/// El nombre de una persona, en sus tres partes y como una sola cadena.
///
/// <para><b>El nombre completo se deriva; no se captura.</b> Antes era un campo que alguien
/// tecleaba, y desde RQ-06 las partes son la fuente: nombre(s), apellido paterno y apellido
/// materno. Componerlo aquí, en un solo sitio, es lo que impide que existan un
/// <c>FullName</c> y unas partes que digan cosas distintas de la misma persona.</para>
///
/// <para><b>Por qué el nombre completo sigue existiendo.</b> Ciento cincuenta y ocho puntos del
/// servidor y setenta y ocho del navegador lo leen —la búsqueda, el orden alfabético, las listas,
/// los selectores de candidatos, los reportes—, y quitarlo obligaba a reescribirlos sin ganar
/// ninguna función. Además la búsqueda «por cualquiera de las tres partes» sale gratis mientras la
/// columna exista: las contiene todas.</para>
/// </summary>
public static class EmployeeName
{
    /// <summary>Lo que cabe en cada parte. Tres de éstas más dos espacios caben en el completo.</summary>
    public const int PartMaxLength = 80;

    /// <summary>Lo que cabe en el nombre completo. 80 × 3 + 2 = 242.</summary>
    public const int FullMaxLength = 250;

    /// <summary>
    /// Arma el nombre completo con las partes que haya.
    ///
    /// <para>El apellido materno es opcional —hay personas con un solo apellido— y su ausencia no
    /// puede dejar un espacio de más al final ni en medio, porque ese espacio viajaría a la
    /// búsqueda y al orden alfabético.</para>
    /// </summary>
    public static string Compose(string firstName, string lastNamePaternal, string? lastNameMaternal)
    {
        var partes = new[] { firstName, lastNamePaternal, lastNameMaternal }
            .Select(parte => parte?.Trim())
            .Where(parte => !string.IsNullOrEmpty(parte))
            .ToArray();

        return string.Join(' ', partes);
    }

    /// <summary>
    /// Deja el nombre como se compara: sin bordes y con un solo espacio entre palabras.
    ///
    /// <para>Se usa para comprobar que el reparto de la migración no perdió ni duplicó una palabra.
    /// La comparación va contra el original <b>normalizado</b> y no contra el crudo: si una fila
    /// traía espacios dobles, colapsarlos es una diferencia legítima, y compararla contra el crudo
    /// daría una alarma que no lo es.</para>
    /// </summary>
    public static string Normalize(string value) =>
        string.Join(' ', value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}
