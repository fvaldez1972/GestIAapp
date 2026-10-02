using GestIA.Application.Assignments;

namespace GestIA.Application.UnitTests;

/// <summary>
/// La elegibilidad por puesto, ahora por identificador.
///
/// Lo que estas pruebas fijan no es el caso obvio —dos puestos distintos bloquean— sino el que se
/// decidió con cuidado: <b>un nulo no bloquea</b>. Un nulo dice "no sabemos cuál es su puesto",
/// no "no cumple", y confundirlos dejaría sin poder asignar a gente que sí puede mientras se
/// limpian los datos heredados.
/// </summary>
public sealed class JobPositionEligibilityTests
{
    private static readonly Guid Guard = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Driver = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public void TheSameJobPositionDoesNotBlock() =>
        Assert.False(JobPositionEligibility.IsBlocked(Guard, Guard));

    [Fact]
    public void ADifferentJobPositionBlocks() =>
        Assert.True(JobPositionEligibility.IsBlocked(Guard, Driver));

    /// <summary>
    /// El caso que la migración deja como resultado válido: el texto heredado no correspondía a
    /// ninguna entrada del catálogo, la columna quedó nula, y eso no puede impedir asignar.
    /// </summary>
    [Fact]
    public void AnEmployeeWithoutAKnownJobPositionIsNotBlocked() =>
        Assert.False(JobPositionEligibility.IsBlocked(Guard, null));

    [Fact]
    public void APositionWithoutADeclaredJobPositionAcceptsAnyone() =>
        Assert.False(JobPositionEligibility.IsBlocked(null, Guard));

    [Fact]
    public void TwoUnknownsDoNotBlockEither() =>
        Assert.False(JobPositionEligibility.IsBlocked(null, null));
}
