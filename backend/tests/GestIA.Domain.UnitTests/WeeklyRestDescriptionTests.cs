using GestIA.Domain.Planning;

namespace GestIA.Domain.UnitTests;

/// <summary>
/// Cómo se lee el descanso de un patrón.
///
/// <para>Hasta el 21 de septiembre de 2026 decía cuántos días eran —«5 días de descanso en ciclo de
/// 7 días»— y había que abrir el patrón para saber cuáles, que es justo lo que esa columna venía a
/// ahorrar.</para>
/// </summary>
public sealed class WeeklyRestDescriptionTests
{
    /// <summary>En una semana se dicen por su nombre, y el día 1 es lunes.</summary>
    [Fact]
    public void AWeeklyPatternNamesTheRestDays()
    {
        Assert.Equal("Descansa martes y domingo", WeeklyHoursRules.DescribeRest(2, 7, [2, 7]));
        Assert.Equal("Descansa domingo", WeeklyHoursRules.DescribeRest(1, 7, [7]));
        Assert.Equal(
            "Descansa miércoles, jueves y viernes",
            WeeklyHoursRules.DescribeRest(3, 7, [5, 3, 4]));
    }

    /// <summary>
    /// Fuera de la semana se siguen contando, y es la única respuesta cierta.
    ///
    /// <para>Es el control de la prueba anterior: sin él, «nombra los días» no distinguiría
    /// nombrarlos cuando se puede de inventar un martes que no existe. Un ciclo de seis cae en días
    /// distintos cada semana, así que no hay ningún día de la semana que nombrar.</para>
    /// </summary>
    [Fact]
    public void ACycleThatIsNotAWeekCannotNameDays()
    {
        var texto = WeeklyHoursRules.DescribeRest(2, 6, [2, 5]);

        Assert.Equal("2 días de descanso en ciclo de 6 días, se corre respecto a la semana", texto);
        Assert.DoesNotContain("martes", texto, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Y sin saber qué días son, tampoco se inventan: se cuentan.</summary>
    [Fact]
    public void WithoutTheDayNumbersItFallsBackToCounting()
    {
        Assert.Equal(
            "2 días de descanso en ciclo de 7 días, en el mismo día cada semana",
            WeeklyHoursRules.DescribeRest(2, 7));
    }

    [Fact]
    public void NoRestIsSaidPlainly()
    {
        Assert.Equal("Sin descanso declarado", WeeklyHoursRules.DescribeRest(0, 7, []));
    }
}
