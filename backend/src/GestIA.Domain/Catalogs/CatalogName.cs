using System.Globalization;
using System.Text;

namespace GestIA.Domain.Catalogs;

/// <summary>
/// La forma normalizada de un nombre de catálogo, que es lo que sostiene su unicidad.
///
/// <para><b>Existe porque la puerta contra «Guardia» y «guardia» tiene que estar en la base, no en
/// la pantalla.</b> Desde que cualquier formulario puede crear un valor de catálogo al vuelo, la
/// comprobación no puede vivir en el formulario: dos personas escribiendo a la vez la esquivarían,
/// y cada pantalla la implementaría un poco distinto. Un índice único sobre esta columna es la
/// única versión de la regla que nadie puede rodear.</para>
///
/// <para>Un índice sobre el nombre sin normalizar no serviría: la colación por omisión de SQL
/// Server distingue acentos, así que aceptaría «Recepción» y «Recepcion» como dos puestos.</para>
///
/// <para><b>Se calcula aquí y no en SQL</b> para que la regla se pueda leer y probar en un solo
/// sitio. La base la recibe ya calculada en cada escritura.</para>
/// </summary>
public static class CatalogName
{
    /// <summary>
    /// Recorta, colapsa los espacios interiores, quita los acentos y pasa a mayúsculas.
    ///
    /// <para>«Guardia de acceso», «guardia  de  acceso» y «GUARDIA DE ACCESO» colapsan al mismo
    /// valor. La ñ se pliega a n, igual que en la colación acento-insensible con la que se rellenó
    /// la columna en la migración: si las dos no coincidieran, un valor viejo y uno nuevo podrían
    /// colarse como distintos siendo el mismo.</para>
    /// </summary>
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var descompuesto = value.Trim().Normalize(NormalizationForm.FormD);
        var construido = new StringBuilder(descompuesto.Length);
        var espaciePendiente = false;

        foreach (var letra in descompuesto)
        {
            // Los acentos viajan como marcas sin espaciado después de FormD: se descartan, y con
            // ellos la diferencia entre «Recepción» y «Recepcion».
            if (CharUnicodeInfo.GetUnicodeCategory(letra) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsWhiteSpace(letra))
            {
                espaciePendiente = construido.Length > 0;
                continue;
            }

            if (espaciePendiente)
            {
                construido.Append(' ');
                espaciePendiente = false;
            }

            construido.Append(char.ToUpperInvariant(letra));
        }

        return construido.ToString().Normalize(NormalizationForm.FormC);
    }
}
