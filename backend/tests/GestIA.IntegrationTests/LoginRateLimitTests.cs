using System.Net;
using System.Net.Http.Json;

namespace GestIA.IntegrationTests;

/// <summary>
/// El freno del login.
///
/// <para><c>/api/v1/auth/login</c> es el único endpoint anónimo del sistema, y cada intento cuesta
/// 210 000 iteraciones de PBKDF2. Ese coste protege las contraseñas de quien roba la base y, sin
/// límite, convierte al endpoint en un amplificador: unas pocas peticiones por segundo consumen CPU
/// de verdad. Además dejaba probar contraseñas sin freno.</para>
///
/// <para><b>Lo que se afirma es el limitador, no el login.</b> El limitador corre antes que el
/// endpoint, así que lo comprobable sin base de datos es si la petición <b>llega</b> a la
/// aplicación o rebota en el freno. Por eso las aserciones son «es 429» y «no es 429», y no un
/// código concreto: acoplar la prueba a lo que conteste el login la volvería una prueba del login,
/// que es otra cosa y ya tiene la suya.</para>
/// </summary>
public sealed class LoginRateLimitTests(GestIaApiFactory factory) : IClassFixture<GestIaApiFactory>
{
    private const HttpStatusCode Frenado = HttpStatusCode.TooManyRequests;
    private static readonly CancellationToken Token = CancellationToken.None;

    private static HttpRequestMessage Intento(string email) =>
        new(HttpMethod.Post, "/api/v1/auth/login")
        {
            Content = JsonContent.Create(new { email, password = "una-contrasena-que-no-es" }),
        };

    /// <summary>
    /// El sexto intento del mismo correo se frena, y <b>otro correo sigue pasando</b>.
    ///
    /// <para>La segunda mitad es el control, y es la que da sentido a la primera: sin ella, un
    /// limitador que frenara <i>todo</i> a partir del sexto intento —viniera de donde viniera—
    /// pasaría esta prueba igual, y habría dejado la aplicación sin acceso para nadie.</para>
    ///
    /// <para>Los correos llevan marca de tiempo porque el cubo dura un minuto y las clases de
    /// prueba comparten servidor: uno fijo heredaría los intentos de la corrida anterior. Es el
    /// mismo cuidado que exige cualquier verificación que deje rastro.</para>
    /// </summary>
    [Fact]
    public async Task TheSixthAttemptIsThrottledWhileAnotherAccountStillGetsThrough()
    {
        var cliente = factory.CreateClient();
        var marca = DateTime.UtcNow.Ticks;
        var perseguido = $"freno-{marca}@ejemplo.mx";

        // Los cinco que el cubo permite: lleguen a donde lleguen, no rebotan en el freno.
        for (var intento = 1; intento <= 5; intento++)
        {
            var respuesta = await cliente.SendAsync(Intento(perseguido), Token);

            Assert.True(
                respuesta.StatusCode != Frenado,
                $"el intento {intento} no debía frenarse y contestó {(int)respuesta.StatusCode}");
        }

        var sexto = await cliente.SendAsync(Intento(perseguido), Token);
        Assert.Equal(Frenado, sexto.StatusCode);

        // El control: otro correo, desde la misma dirección, sigue pasando. Si el limitador
        // repartiera sólo por IP, esto también se frenaría.
        var otro = await cliente.SendAsync(Intento($"otro-{marca}@ejemplo.mx"), Token);
        Assert.NotEqual(Frenado, otro.StatusCode);
    }

    /// <summary>
    /// Un cuerpo sin correo no tumba el acceso de nadie.
    ///
    /// <para>El middleware que resuelve el correo cae a una marca fija cuando el cuerpo no es un
    /// JSON con correo. Lo que se comprueba aquí es que ese camino <b>no revienta</b>: una petición
    /// malformada tiene que contestar algo, no quedarse sin respuesta ni arrastrar al limitador.
    /// </para>
    /// </summary>
    [Fact]
    public async Task AMalformedBodyDoesNotBreakTheLimiter()
    {
        var cliente = factory.CreateClient();

        var respuesta = await cliente.PostAsync(
            "/api/v1/auth/login",
            new StringContent("{no-es-json", System.Text.Encoding.UTF8, "application/json"),
            Token);

        Assert.NotEqual(Frenado, respuesta.StatusCode);
    }
}
