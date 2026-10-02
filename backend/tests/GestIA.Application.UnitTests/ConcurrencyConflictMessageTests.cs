using System.Globalization;
using GestIA.Application.Common;

namespace GestIA.Application.UnitTests;

/// <summary>
/// La escalera de tres niveles del 409.
///
/// Lo que fijan estas pruebas no es el caso bonito —hay bitácora y se nombra a la persona— sino
/// los dos que se decidieron con cuidado: que el cierre de día, que nunca tendrá bitácora, siga
/// diciendo quién pisó el cambio; y que sin nombre <b>no se invente uno</b>.
/// </summary>
public sealed class ConcurrencyConflictMessageTests
{
    private static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");
    private static readonly DateTime AtTenOhFive = new(2026, 9, 5, 16, 5, 0, DateTimeKind.Utc);

    [Fact]
    public void TheHistoryEventNamesWhoCorrectedItAndWhen()
    {
        var message = ConcurrencyConflictMessage.Build(
            new ConcurrencyConflictAuthor("Ana Ruiz", AtTenOhFive), null, Zone);

        Assert.Contains("Ana Ruiz", message, StringComparison.Ordinal);
        Assert.Contains("10:05", message, StringComparison.Ordinal);
        Assert.Contains("corrigió", message, StringComparison.Ordinal);
    }

    /// <summary>
    /// La hora se muestra en el huso operativo. Decirle "16:05" a un supervisor cuyo reloj marca
    /// las 10:05 no ayuda: lo manda a buscar un cambio que no encuentra.
    /// </summary>
    [Fact]
    public void TheTimeIsShownInTheOperationalTimeZoneAndNotInUtc()
    {
        var message = ConcurrencyConflictMessage.Build(
            new ConcurrencyConflictAuthor("Ana Ruiz", AtTenOhFive), null, Zone);

        Assert.DoesNotContain("16:05", message, StringComparison.Ordinal);
    }

    /// <summary>
    /// El caso del cierre de día: no lleva bitácora, así que el nombre sale de los campos de
    /// auditoría de la propia fila. Es el conflicto más probable de todos.
    /// </summary>
    [Fact]
    public void WithoutHistoryItFallsBackToTheRowAuditFields()
    {
        var message = ConcurrencyConflictMessage.Build(
            null, new ConcurrencyConflictAuthor("Luis Mena", AtTenOhFive), Zone);

        Assert.Contains("Luis Mena", message, StringComparison.Ordinal);
        Assert.Contains("modificó", message, StringComparison.Ordinal);
    }

    [Fact]
    public void TheHistoryWinsOverTheAuditFieldsWhenBothExist()
    {
        var message = ConcurrencyConflictMessage.Build(
            new ConcurrencyConflictAuthor("Ana Ruiz", AtTenOhFive),
            new ConcurrencyConflictAuthor("Luis Mena", AtTenOhFive),
            Zone);

        Assert.Contains("Ana Ruiz", message, StringComparison.Ordinal);
        Assert.DoesNotContain("Luis Mena", message, StringComparison.Ordinal);
    }

    /// <summary>Sin nombre no se inventa uno: se baja al mensaje genérico.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void WithoutANameItNeverInventsOne(string? actorName)
    {
        var message = ConcurrencyConflictMessage.Build(
            new ConcurrencyConflictAuthor(actorName, AtTenOhFive),
            new ConcurrencyConflictAuthor(actorName, AtTenOhFive),
            Zone);

        Assert.Equal(ConcurrencyConflictMessage.Generic, message);
        Assert.DoesNotContain("usuario", message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void WithNoSourceAtAllItUsesTheGenericMessage() =>
        Assert.Equal(ConcurrencyConflictMessage.Generic, ConcurrencyConflictMessage.Build(null, null, Zone));

    [Fact]
    public void ANameWithoutAnInstantStillNamesThePerson()
    {
        var message = ConcurrencyConflictMessage.Build(
            null, new ConcurrencyConflictAuthor("Luis Mena", null), Zone);

        Assert.Contains("Luis Mena", message, StringComparison.Ordinal);
        Assert.NotEqual(ConcurrencyConflictMessage.Generic, message);
    }
}
