using GestIA.Domain.Planning;

namespace GestIA.Domain.UnitTests;

/// <summary>
/// El catálogo de patrones de turno, y la aritmética que la pantalla muestra.
///
/// <para>Los casos salen de la tabla que trajo el cliente: 12x12 diurno, 12x12 nocturno, 24x24,
/// 24x48, 12x36, 12x48 y un rol 6x1 de ocho horas. Son las cifras que hay que poder defender
/// delante de él.</para>
/// </summary>
public sealed class ShiftPatternTemplateTests
{
    private static readonly Guid ActorId = Guid.Parse("2c9f5e18-4b7a-4a02-9f3d-8e1c60b5a742");
    private const string ActorName = "Pruebas";
    private static readonly DateTime OccurredAt = new(2026, 9, 17, 3, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Vigencia = new(2026, 1, 1);

    private static ShiftPatternTemplate Plantilla(string nombre, ShiftDaypart jornada, int diasDelCiclo) =>
        ShiftPatternTemplate.Create(
            Guid.NewGuid(),
            new ShiftPatternTemplateProfile(nombre, null, jornada, diasDelCiclo, Vigencia, null),
            ActorId,
            ActorName,
            OccurredAt);

    private static void Turno(ShiftPatternTemplate plantilla, int dia, TimeOnly inicio, TimeOnly fin) =>
        plantilla.DeclareDay(dia, inicio, fin, false, ActorId, ActorName, OccurredAt);

    private static void Descanso(ShiftPatternTemplate plantilla, int dia) =>
        plantilla.DeclareDay(dia, null, null, true, ActorId, ActorName, OccurredAt);

    /// <summary>Un 12x12 diurno: dos días de ciclo, 42 horas por semana, conforme.</summary>
    [Fact]
    public void ADayShiftTwelveByTwelveIsFortyTwoWeeklyHoursAndCompliant()
    {
        var plantilla = Plantilla("12x12 diurno", ShiftDaypart.Day, 2);
        Turno(plantilla, 1, new TimeOnly(7, 0), new TimeOnly(19, 0));
        Descanso(plantilla, 2);

        Assert.True(plantilla.IsComplete);
        Assert.Equal(720, plantilla.CycleWorkMinutes);
        Assert.Equal(42m, WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays));

        var (conformidad, limite, exceso) = WeeklyHoursRules.Assess(
            plantilla.CycleWorkMinutes, plantilla.CycleDays, Vigencia);

        Assert.Equal(WeeklyHoursCompliance.Compliant, conformidad);
        Assert.Equal(48m, limite);
        Assert.Equal(0m, exceso);
    }

    /// <summary>
    /// Un 12x12 nocturno da las mismas horas, y el turno que cruza la medianoche se mide bien.
    ///
    /// <para>19:00 a 07:00 son doce horas, no menos cinco. El cruce se deduce del horario en lugar
    /// de pedirlo como una casilla que alguien puede olvidar marcar.</para>
    /// </summary>
    [Fact]
    public void ANightShiftCrossingMidnightMeasuresTwelveHours()
    {
        var plantilla = Plantilla("12x12 nocturno", ShiftDaypart.Night, 2);
        Turno(plantilla, 1, new TimeOnly(19, 0), new TimeOnly(7, 0));
        Descanso(plantilla, 2);

        var dia = Assert.Single(plantilla.Days, day => !day.IsRest);
        Assert.True(dia.IsOvernight);
        Assert.Equal(720, dia.DurationMinutes);
        Assert.Equal(42m, WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays));
    }

    /// <summary>Un 24x24: 84 horas por semana, y excede por 36.</summary>
    [Fact]
    public void TwentyFourByTwentyFourExceedsByThirtySixHours()
    {
        var plantilla = Plantilla("24x24", ShiftDaypart.Rotating, 2);
        Turno(plantilla, 1, new TimeOnly(7, 0), new TimeOnly(7, 0));
        Descanso(plantilla, 2);

        Assert.Equal(1440, plantilla.CycleWorkMinutes);
        Assert.Equal(84m, WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays));

        var (conformidad, _, exceso) = WeeklyHoursRules.Assess(
            plantilla.CycleWorkMinutes, plantilla.CycleDays, Vigencia);

        // No se prohíbe: se avisa, y el aviso dice por cuánto. Si el sistema no deja registrarlo, se
        // registra fuera del sistema.
        Assert.Equal(WeeklyHoursCompliance.Exceeds, conformidad);
        Assert.Equal(36m, exceso);
    }

    /// <summary>Un 24x48: tres días de ciclo, 56 horas por semana, excede por 8.</summary>
    [Fact]
    public void TwentyFourByFortyEightIsFiftySixWeeklyHours()
    {
        var plantilla = Plantilla("24x48", ShiftDaypart.Rotating, 3);
        Turno(plantilla, 1, new TimeOnly(7, 0), new TimeOnly(7, 0));
        Descanso(plantilla, 2);
        Descanso(plantilla, 3);

        Assert.Equal(56m, WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays));

        var (conformidad, _, exceso) = WeeklyHoursRules.Assess(
            plantilla.CycleWorkMinutes, plantilla.CycleDays, Vigencia);

        Assert.Equal(WeeklyHoursCompliance.Exceeds, conformidad);
        Assert.Equal(8m, exceso);
    }

    /// <summary>Un 12x36: dos días de ciclo, 42 horas, conforme.</summary>
    [Fact]
    public void TwelveByThirtySixIsFortyTwoWeeklyHours()
    {
        var plantilla = Plantilla("12x36", ShiftDaypart.Mixed, 2);
        Turno(plantilla, 1, new TimeOnly(7, 0), new TimeOnly(19, 0));
        Descanso(plantilla, 2);

        Assert.Equal(42m, WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays));
    }

    /// <summary>
    /// Un 12x48 son <b>tres días</b> de ciclo y <b>28 horas</b> por semana.
    ///
    /// <para>Es la única cifra de la tabla que no sale de la aritmética directa, y está decidida: el
    /// patrón declara de cuántos días es su ciclo, y con tres da 28. Contarlo como dos días y medio
    /// daría 33.6, que es un promedio y esconde que la persona trabaja un día de cada tres.</para>
    /// </summary>
    [Fact]
    public void TwelveByFortyEightIsTwentyEightWeeklyHoursBecauseItsCycleIsThreeDays()
    {
        var plantilla = Plantilla("12x48", ShiftDaypart.Mixed, 3);
        Turno(plantilla, 1, new TimeOnly(7, 0), new TimeOnly(19, 0));
        Descanso(plantilla, 2);
        Descanso(plantilla, 3);

        Assert.Equal(28m, WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays));
        Assert.Equal(
            WeeklyHoursCompliance.Compliant,
            WeeklyHoursRules.Assess(plantilla.CycleWorkMinutes, plantilla.CycleDays, Vigencia).Compliance);
    }

    /// <summary>Un rol 6x1 de ocho horas: siete días de ciclo, 48 horas justas, conforme al límite.</summary>
    [Fact]
    public void ASixByOneRoleOfEightHoursSitsExactlyOnTheLimit()
    {
        var plantilla = Plantilla("Rol 6x1 8 h", ShiftDaypart.Day, 7);

        for (var dia = 1; dia <= 6; dia++)
        {
            Turno(plantilla, dia, new TimeOnly(9, 0), new TimeOnly(17, 0));
        }

        Descanso(plantilla, 7);

        Assert.Equal(48m, WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays));

        // Justo en el límite no excede: la ley dice «no más de 48».
        Assert.Equal(
            WeeklyHoursCompliance.Compliant,
            WeeklyHoursRules.Assess(plantilla.CycleWorkMinutes, plantilla.CycleDays, Vigencia).Compliance);
    }

    /// <summary>
    /// El descanso se describe con lo que se puede afirmar, no con las palabras de la tabla.
    ///
    /// <para>«Alterno» y «Escalonado» no salen de estos datos: un 12x12 y un 12x36 son los dos
    /// ciclos de dos días con un descanso, y el cliente los llama distinto. Esa diferencia está en
    /// cómo se corre la hora de entrada, no en el conteo de días, así que la función dice lo que
    /// sabe y el nombre del cliente va en la descripción de la plantilla.</para>
    /// </summary>
    [Theory]
    [InlineData(1, 2, "1 día de descanso en ciclo de 2 días, se corre respecto a la semana")]
    [InlineData(1, 7, "1 día de descanso en ciclo de 7 días, en el mismo día cada semana")]
    [InlineData(2, 7, "2 días de descanso en ciclo de 7 días, en el mismo día cada semana")]
    [InlineData(2, 3, "2 días de descanso en ciclo de 3 días, se corre respecto a la semana")]
    [InlineData(0, 7, "Sin descanso declarado")]
    public void TheRestIsDescribedWithWhatCanBeAsserted(int diasDeDescanso, int diasDelCiclo, string esperado)
    {
        Assert.Equal(esperado, WeeklyHoursRules.DescribeRest(diasDeDescanso, diasDelCiclo));
    }

    /// <summary>
    /// Un día sin declarar no es un descanso, y la plantilla lo sabe.
    ///
    /// <para>Era el defecto de fondo del modelo viejo: «descansa el jueves» y «nadie configuró el
    /// jueves» se veían idénticos.</para>
    /// </summary>
    [Fact]
    public void AnUndeclaredDayLeavesTheTemplateIncomplete()
    {
        var plantilla = Plantilla("2x2x2", ShiftDaypart.Rotating, 6);
        Turno(plantilla, 1, new TimeOnly(7, 0), new TimeOnly(19, 0));
        Turno(plantilla, 2, new TimeOnly(7, 0), new TimeOnly(19, 0));

        Assert.False(plantilla.IsComplete);
    }

    /// <summary>Volver a declarar un día lo corrige, no agrega otro.</summary>
    [Fact]
    public void RedeclaringADayReplacesIt()
    {
        var plantilla = Plantilla("12x12 diurno", ShiftDaypart.Day, 2);
        Turno(plantilla, 1, new TimeOnly(7, 0), new TimeOnly(19, 0));
        Turno(plantilla, 1, new TimeOnly(6, 0), new TimeOnly(15, 30));
        Descanso(plantilla, 2);

        Assert.Equal(2, plantilla.Days.Count);
        var dia = Assert.Single(plantilla.Days, day => day.CycleDayNumber == 1);
        Assert.Equal(570, dia.DurationMinutes);
    }

    [Fact]
    public void ADayOutsideTheCycleIsRejected()
    {
        var plantilla = Plantilla("12x12 diurno", ShiftDaypart.Day, 2);

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            plantilla.DeclareDay(3, new TimeOnly(7, 0), new TimeOnly(19, 0), false, ActorId, ActorName, OccurredAt));
    }

    [Fact]
    public void ARestDayCannotCarryASchedule()
    {
        var plantilla = Plantilla("12x12 diurno", ShiftDaypart.Day, 2);
        Descanso(plantilla, 1);

        var dia = Assert.Single(plantilla.Days);
        Assert.True(dia.IsRest);
        Assert.Null(dia.StartTime);
        Assert.Equal(0, dia.DurationMinutes);
    }

    [Fact]
    public void AShiftDayNeedsBothTimes()
    {
        var plantilla = Plantilla("12x12 diurno", ShiftDaypart.Day, 2);

        Assert.Throws<ArgumentException>(() =>
            plantilla.DeclareDay(1, new TimeOnly(7, 0), null, false, ActorId, ActorName, OccurredAt));
    }

    /// <summary>El nombre sostiene la unicidad por su forma normalizada, como los catálogos.</summary>
    [Fact]
    public void TheNameIsNormalizedForUniqueness()
    {
        var uno = Plantilla(" 12x12  Diurno ", ShiftDaypart.Day, 2);
        var otro = Plantilla("12X12 DIURNO", ShiftDaypart.Day, 2);

        // El nombre se conserva tal como se escribió, sólo recortado: es lo que se lee en pantalla.
        Assert.Equal("12x12  Diurno", uno.Name);
        // La unicidad la sostiene la forma normalizada, que sí colapsa espacios y acentos.
        Assert.Equal("12X12 DIURNO", uno.NormalizedName);
        Assert.Equal(uno.NormalizedName, otro.NormalizedName);
    }

    [Fact]
    public void AnImpossibleCycleIsRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Plantilla("sin ciclo", ShiftDaypart.Day, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => Plantilla("calendario", ShiftDaypart.Day, 400));
    }
}
