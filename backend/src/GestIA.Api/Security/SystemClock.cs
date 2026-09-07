using GestIA.Application.Common;

namespace GestIA.Api.Security;

/// <summary>
/// Reloj del sistema con el huso operativo tomado de configuración.
/// </summary>
public sealed class SystemClock(TimeZoneInfo operationalTimeZone) : IClock
{
    /// <summary>Clave de configuración del huso operativo.</summary>
    public const string TimeZoneSetting = "Operations:TimeZoneId";

    /// <summary>Huso por omisión mientras el huso por organización no exista.</summary>
    public const string DefaultTimeZoneId = "America/Mexico_City";

    public DateTime UtcNow => DateTime.UtcNow;

    public TimeZoneInfo OperationalTimeZone => operationalTimeZone;

    public DateOnly Today =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, operationalTimeZone));

    /// <summary>
    /// Resuelve el huso al arrancar, no al primer uso.
    ///
    /// <b>Revienta si el identificador no existe.</b> Caer en silencio a otro huso produciría
    /// fechas incorrectas sin que nadie se entere, que es exactamente el defecto que esta pieza
    /// cierra. Un arranque fallido con un mensaje claro es mejor que un sistema que funciona mal.
    /// </summary>
    public static TimeZoneInfo ResolveTimeZone(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var id = configuration[TimeZoneSetting];
        id = string.IsNullOrWhiteSpace(id) ? DefaultTimeZoneId : id.Trim();

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            throw new InvalidOperationException(
                $"El huso operativo '{id}', configurado en '{TimeZoneSetting}', no existe en este " +
                $"sistema. Usa un identificador IANA como '{DefaultTimeZoneId}'.",
                exception);
        }
    }
}
