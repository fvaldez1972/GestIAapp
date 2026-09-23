namespace GestIA.Application.Common;

/// <summary>
/// El tamaño de página que el servidor acepta.
///
/// <para><b>Por qué existe.</b> Los seis endpoints paginados corregían el valor inválido hacia
/// abajo —<c>pageSize &lt;= 0 ? 20 : pageSize</c>— pero ninguno tenía techo, así que
/// <c>?pageSize=1000000</c> se servía. No es una fuga: el filtro por organización sigue puesto y
/// quien pregunta sólo ve lo suyo. Son dos cosas distintas: un vector de agotamiento de recursos,
/// y una forma cómoda de llevarse la tabla entera de un tirón en vez de paginarla.</para>
///
/// <para>Doscientos porque es más de lo que cabe en cualquier pantalla del producto —la más larga
/// ofrece cien— y bastante menos de lo que duele servir.</para>
/// </summary>
public static class PageSize
{
    public const int Default = 20;

    public const int Maximum = 200;

    /// <summary>
    /// Deja el tamaño dentro de lo que el servidor sirve.
    ///
    /// <para>Un valor ausente o no positivo cae al de por omisión, y uno excesivo se recorta al
    /// máximo en vez de rechazarse: quien pide mil filas quiere las que haya, no un error.</para>
    /// </summary>
    public static int Clamp(int? requested, int fallback = Default) =>
        requested is not { } value || value <= 0
            ? fallback
            : Math.Min(value, Maximum);
}
