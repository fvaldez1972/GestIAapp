using GestIA.Application.Common;

namespace GestIA.Application.UnitTests;

/// <summary>
/// El techo del tamaño de página.
///
/// <para>Los seis endpoints paginados corregían el valor inválido hacia abajo pero ninguno tenía
/// máximo, así que <c>?pageSize=1000000</c> se servía entero.</para>
/// </summary>
public sealed class PageSizeTests
{
    /// <summary>
    /// Lo que esta prueba vino a fijar: que exista techo.
    ///
    /// <para>El control es el par. Un valor por debajo del máximo <b>se respeta tal cual</b>, así
    /// que si alguien quitara el <c>Math.Min</c> la primera mitad caería mientras la segunda
    /// seguiría pasando: recortar siempre a 200 no sería lo mismo que topar en 200.</para>
    /// </summary>
    [Fact]
    public void LargeRequestsAreCappedAndSmallOnesAreRespected()
    {
        Assert.Equal(PageSize.Maximum, PageSize.Clamp(1_000_000));
        Assert.Equal(PageSize.Maximum, PageSize.Clamp(PageSize.Maximum + 1));

        Assert.Equal(PageSize.Maximum, PageSize.Clamp(PageSize.Maximum));
        Assert.Equal(50, PageSize.Clamp(50));
        Assert.Equal(1, PageSize.Clamp(1));
    }

    /// <summary>
    /// Ausente o absurdo cae al de por omisión, no a cero.
    ///
    /// <para>Cero páginas es una lista vacía servida como si fuera la respuesta, que es peor que
    /// un tamaño que nadie pidió: la pantalla afirmaría que no hay nada.</para>
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MinValue)]
    public void MissingOrNonPositiveFallsBackToTheDefault(int? requested)
    {
        Assert.Equal(PageSize.Default, PageSize.Clamp(requested));

        // Y el respaldo se puede cambiar donde la pantalla use otro: Personal pide 25.
        Assert.Equal(25, PageSize.Clamp(requested, 25));
    }
}
