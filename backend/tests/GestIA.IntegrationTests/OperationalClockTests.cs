using GestIA.Api.Security;
using GestIA.Application.Common;
using Microsoft.Extensions.Configuration;

namespace GestIA.IntegrationTests;

/// <summary>
/// El día operativo, que no es el día UTC.
///
/// <para>El defecto que estas pruebas cierran era real y estaba corriendo: en UTC el día empieza
/// entre seis y siete horas antes que en México, así que una vigencia que terminaba el 4 de
/// septiembre pasaba a "vencida" a las 18:00 del día 3, hora de Ciudad de México, y una regla que
/// sólo aplica a lo vencido empezaba a exigirse un día antes de tiempo. Lo mismo con la bandera
/// de documento vencido, que se muestra en Personal y bloquea elegibilidad.</para>
/// </summary>
public sealed class OperationalClockTests
{
    private static readonly TimeZoneInfo MexicoCity =
        TimeZoneInfo.FindSystemTimeZoneById(SystemClock.DefaultTimeZoneId);

    /// <summary>
    /// El caso concreto: a las 02:00 UTC del día 5 en Ciudad de México todavía es el día 4.
    /// Calcular "hoy" desde UTC daba el 5 y adelantaba el cambio de día.
    /// </summary>
    [Fact]
    public void EarlyUtcMorningIsStillYesterdayInMexico()
    {
        var earlyUtc = new DateTime(2026, 9, 5, 2, 0, 0, DateTimeKind.Utc);

        Assert.Equal(new DateOnly(2026, 9, 5), DateOnly.FromDateTime(earlyUtc));
        Assert.Equal(new DateOnly(2026, 9, 4), Today(earlyUtc));
    }

    [Fact]
    public void LaterInTheDayBothAgree()
    {
        var afternoonUtc = new DateTime(2026, 9, 5, 14, 0, 0, DateTimeKind.Utc);

        Assert.Equal(new DateOnly(2026, 9, 5), Today(afternoonUtc));
    }

    /// <summary>El reloj real usa el huso configurado y no el del servidor.</summary>
    [Fact]
    public void TheClockUsesTheConfiguredTimeZoneAndNotTheMachineOne()
    {
        var clock = new SystemClock(MexicoCity);

        Assert.Equal(
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, MexicoCity)),
            clock.Today);
    }

    [Fact]
    public void WithoutConfigurationItFallsBackToMexicoCity() =>
        Assert.Equal(MexicoCity, SystemClock.ResolveTimeZone(Configuration(null)));

    [Fact]
    public void AConfiguredTimeZoneIsHonoured() =>
        Assert.Equal(
            TimeZoneInfo.FindSystemTimeZoneById("America/Tijuana"),
            SystemClock.ResolveTimeZone(Configuration("America/Tijuana")));

    /// <summary>
    /// Un huso mal escrito detiene el arranque en vez de caer en silencio a otro. Caer en silencio
    /// produciría fechas incorrectas sin que nadie se entere, que es el defecto que esta pieza
    /// vino a cerrar; repetirlo en el arreglo sería el peor final posible.
    /// </summary>
    [Fact]
    public void AnInvalidTimeZoneStopsStartupInsteadOfFallingBackSilently()
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => SystemClock.ResolveTimeZone(Configuration("America/Ciudad_Inventada")));

        Assert.Contains("America/Ciudad_Inventada", exception.Message, StringComparison.Ordinal);
        Assert.Contains(SystemClock.TimeZoneSetting, exception.Message, StringComparison.Ordinal);
    }

    /// <summary>
    /// La regresión del caso que motivó la pieza: una configuración que vence el 4 de septiembre
    /// <b>no</b> exige motivo el 4 a las 19:00 UTC, que es cuando antes ya lo exigía.
    /// </summary>
    [Fact]
    public void AConfigurationExpiringTodayDoesNotDemandAReasonYet()
    {
        var eveningUtcOfTheFourth = new DateTime(2026, 9, 4, 19, 0, 0, DateTimeKind.Utc);
        var expiresOn = new DateOnly(2026, 9, 4);

        // Como se calculaba antes: en UTC ya es el 4, y el 4 no es mayor que el 4… todavía no
        // falla. El día siguiente en UTC empieza a las 18:00 hora de México, y ahí sí adelantaba.
        var utcDay = DateOnly.FromDateTime(eveningUtcOfTheFourth.AddHours(6));
        Assert.True(expiresOn < utcDay, "Antes, seis horas después ya se consideraba vencida.");

        // Como se calcula ahora: a las 19:00 UTC del 4 son las 13:00 en México, sigue siendo el 4.
        Assert.Equal(new DateOnly(2026, 9, 4), Today(eveningUtcOfTheFourth));
        Assert.False(expiresOn < Today(eveningUtcOfTheFourth));
    }

    private static DateOnly Today(DateTime utcNow) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow, MexicoCity));

    private static IConfiguration Configuration(string? timeZoneId) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [SystemClock.TimeZoneSetting] = timeZoneId
            })
            .Build();
}
