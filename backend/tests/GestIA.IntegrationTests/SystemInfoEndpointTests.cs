using System.Net;
using System.Text.Json;
using GestIA.Api.Security;

namespace GestIA.IntegrationTests;

/// <summary>
/// El día operativo y el huso que publica <c>/api/v1/system/info</c>.
///
/// <para>Existen para que la barra de contexto del frontend no tenga que calcular la fecha en el
/// navegador. Hacerlo ahí repondría el defecto que el reloj operativo cerró: en UTC el día empieza
/// entre seis y siete horas antes que en México, así que un navegador que hiciera
/// <c>new Date()</c> mostraría un día distinto del que el servidor usa para decidir vigencias y
/// elegibilidad. El servidor ya sabe cuál es el día operativo; lo único que faltaba era decirlo.</para>
/// </summary>
public sealed class SystemInfoEndpointTests : IClassFixture<GestIaApiFactory>
{
    private readonly HttpClient _client;

    public SystemInfoEndpointTests(GestIaApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SystemInfoPublishesTheOperationalDayAndItsTimeZone()
    {
        using var response = await _client.GetAsync("/api/v1/system/info");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        var timeZoneId = root.GetProperty("timeZoneId").GetString();
        Assert.Equal(SystemClock.DefaultTimeZoneId, timeZoneId);

        // La fecha llega como texto ISO, no como instante: es un día de negocio, no un momento.
        // Si viajara como DateTime, el navegador volvería a convertirlo a su propio huso y
        // reaparecería el corrimiento que este endpoint viene a evitar.
        var operationDate = root.GetProperty("operationDate").GetString();
        Assert.True(
            DateOnly.TryParseExact(operationDate, "yyyy-MM-dd", out var parsed),
            $"El dia operativo debe venir como 'yyyy-MM-dd' y vino como '{operationDate}'.");

        var zone = TimeZoneInfo.FindSystemTimeZoneById(SystemClock.DefaultTimeZoneId);
        Assert.Equal(
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone)),
            parsed);
    }

    /// <summary>
    /// La regresión que importa: el día publicado es el operativo, no el de UTC. Sólo se distingue
    /// durante las seis horas en las que los dos no coinciden, así que la prueba se afirma sobre la
    /// conversión y no sobre el reloj de la máquina que la corre.
    /// </summary>
    [Fact]
    public async Task ThePublishedDayIsTheOperationalOneAndNotTheUtcOne()
    {
        using var response = await _client.GetAsync("/api/v1/system/info");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        var zone = TimeZoneInfo.FindSystemTimeZoneById(
            document.RootElement.GetProperty("timeZoneId").GetString()!);
        var published = DateOnly.ParseExact(
            document.RootElement.GetProperty("operationDate").GetString()!, "yyyy-MM-dd");

        var utcMidnight = new DateTime(published.Year, published.Month, published.Day, 2, 0, 0, DateTimeKind.Utc);
        Assert.NotEqual(
            DateOnly.FromDateTime(utcMidnight),
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcMidnight, zone)));
    }
}
