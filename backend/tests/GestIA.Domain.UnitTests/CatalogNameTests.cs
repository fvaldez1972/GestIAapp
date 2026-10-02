using GestIA.Domain.Catalogs;

namespace GestIA.Domain.UnitTests;

/// <summary>
/// El nombre plegado es lo que sostiene la unicidad del catálogo desde que el código se retiró.
///
/// <para>Estas pruebas son la definición de la regla: lo que colapse aquí no se puede crear dos
/// veces, y lo que no colapse sí. Cambiarlas cambia lo que el sistema considera «el mismo valor».</para>
/// </summary>
public class CatalogNameTests
{
    /// <summary>
    /// El caso que da nombre a la regla, y el que motivó el índice: crear «Guardia» y «guardia»
    /// como dos entradas sería peor que no tener el alta al vuelo.
    /// </summary>
    [Theory]
    [InlineData("Guardia", "guardia")]
    [InlineData("Guardia", "GUARDIA")]
    [InlineData("Guardia", "  Guardia  ")]
    [InlineData("Guardia de acceso", "guardia  de  acceso")]
    [InlineData("Guardia de acceso", "GUARDIA\tDE\nACCESO")]
    public void NamesThatOnlyDifferInCaseOrSpacingCollapseToTheSameValue(string left, string right) =>
        Assert.Equal(CatalogName.Normalize(left), CatalogName.Normalize(right));

    /// <summary>
    /// Los acentos también, y ésta es la parte que un índice sobre el nombre crudo no daría: la
    /// colación por omisión de SQL Server los distingue.
    /// </summary>
    [Theory]
    [InlineData("Recepción", "Recepcion")]
    [InlineData("Supervisión", "SUPERVISION")]
    [InlineData("Peña", "PENA")]
    [InlineData("México", "mexico")]
    public void AccentsFoldAway(string left, string right) =>
        Assert.Equal(CatalogName.Normalize(left), CatalogName.Normalize(right));

    /// <summary>
    /// Lo que de verdad es distinto se queda distinto. Sin esto, plegar de más juntaría puestos que
    /// no son el mismo y el alta al vuelo se volvería imposible de usar.
    /// </summary>
    [Theory]
    [InlineData("Guardia", "Guardias")]
    [InlineData("Guardia de acceso", "Guardia de acceso B")]
    [InlineData("Supervisor", "Supervisora")]
    [InlineData("Turno A", "Turno B")]
    public void DifferentNamesStayDifferent(string left, string right) =>
        Assert.NotEqual(CatalogName.Normalize(left), CatalogName.Normalize(right));

    [Theory]
    [InlineData("  Guardia de acceso  ", "GUARDIA DE ACCESO")]
    [InlineData("Recepción", "RECEPCION")]
    [InlineData("primeros auxilios", "PRIMEROS AUXILIOS")]
    public void ProducesTheExpectedShape(string entrada, string esperado) =>
        Assert.Equal(esperado, CatalogName.Normalize(entrada));

    /// <summary>
    /// Vacío o sólo espacios devuelve vacío en lugar de reventar: quien valida que el nombre existe
    /// es la entidad, y esta función no debe adelantarse a decirlo con otra excepción.
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyStaysEmpty(string? entrada) =>
        Assert.Equal(string.Empty, CatalogName.Normalize(entrada));
}
