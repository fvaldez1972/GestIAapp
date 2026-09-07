using System.Text.Json;
using System.Text.Json.Serialization;
using GestIA.Application.Assignments;
using GestIA.Application.Operations;
using GestIA.Application.Services;
using GestIA.Domain.Operations;
using GestIA.Domain.Workforce;

namespace GestIA.Application.UnitTests;

/// <summary>
/// Comprueba que un cuerpo sin token de concurrencia se rechace al deserializar.
///
/// <para><b>Por qué esto no se puede dar por hecho.</b> Los contratos de corrección declaran el
/// token como <c>byte[]</c> no anulable, y eso basta para que ningún código C# pueda construir uno
/// sin él. Pero estas peticiones no se construyen en C#: llegan como JSON y las arma el
/// deserializador, que no respeta la anulabilidad —escribe nulo en un campo declarado no anulable
/// sin decir nada—. Sin <c>[property: JsonRequired]</c> el tipo diría una cosa y la realidad sería
/// otra, que es peor que no tener tipo: el olvido volvería, ahora invisible incluso al leer el
/// contrato.</para>
///
/// <para>Se prueba contra <see cref="JsonSerializer"/> directamente y no por HTTP a propósito. Lo
/// que se está comprobando es el mecanismo —que el atributo hace lo que se cree que hace—, y esa
/// es una propiedad del deserializador. Que un <see cref="JsonException"/> durante el enlace del
/// cuerpo se convierta en 400 ya es comportamiento de ASP.NET.</para>
/// </summary>
public sealed class ConcurrencyTokenBindingTests
{
    /// <summary>
    /// Las mismas opciones que arma <c>Program.cs</c>: camelCase por <c>Web</c> más el convertidor
    /// de enums por nombre. Tienen que ser las mismas o la prueba no comprueba lo que dice: sin el
    /// convertidor, los cuerpos de abajo fallan por los enums y el <see cref="JsonException"/>
    /// aparecería igual aunque el token no fuera obligatorio.
    /// </summary>
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    /// <summary>El token viaja como base64, que es como el serializador representa un byte[].</summary>
    private const string Token = "AAAAAAAAB9E=";

    public static TheoryData<string, string> CuerposSinToken() => new()
    {
        {
            nameof(UpdateIncidentRequest),
            """
            {"idOrganization":"11111111-1111-1111-1111-111111111111",
             "idClient":"22222222-2222-2222-2222-222222222222",
             "idService":"33333333-3333-3333-3333-333333333333",
             "idScheduledShift":null,"idEmployee":null,
             "incidentDate":"2026-09-06","incidentType":"Robo",
             "severity":"High","status":"Open",
             "description":"Descripción","resolutionNotes":null}
            """
        },
        {
            nameof(UpdateCoverageRequest),
            """
            {"idOrganization":"11111111-1111-1111-1111-111111111111",
             "idClient":"22222222-2222-2222-2222-222222222222",
             "idService":"33333333-3333-3333-3333-333333333333",
             "idReplacementEmployee":"44444444-4444-4444-4444-444444444444",
             "coverageStartTime":"08:00:00","coverageEndTime":"16:00:00",
             "isOvernight":false,"status":"Confirmed","notes":null}
            """
        },
        {
            nameof(ReopenOperationDayRequest),
            """
            {"idOrganization":"11111111-1111-1111-1111-111111111111",
             "reason":"Faltó capturar dos asistencias del turno nocturno."}
            """
        },
        {
            nameof(UpdateServiceAssignmentRequest),
            """
            {"idOrganization":"11111111-1111-1111-1111-111111111111",
             "idClient":"22222222-2222-2222-2222-222222222222",
             "idService":"33333333-3333-3333-3333-333333333333",
             "idPosition":"55555555-5555-5555-5555-555555555555",
             "assignmentType":"Primary","startDate":"2026-09-01",
             "endDate":null,"isPrimary":true,"notes":null}
            """
        }
    };

    /// <summary>
    /// Un cuerpo al que sólo le falta el token no se enlaza: falla, en vez de llegar al servicio
    /// con el token en nulo y guardar sin comprobar nada.
    /// </summary>
    [Theory]
    [MemberData(nameof(CuerposSinToken))]
    public void ABodyWithoutTheTokenIsRejected(string contrato, string cuerpo)
    {
        var deserializar = Deserializador(contrato);

        var error = Record.Exception(() => deserializar(cuerpo));

        var json = Assert.IsAssignableFrom<JsonException>(error);

        // Que falle no basta: tiene que fallar POR el token. Sin esta comprobación la prueba
        // pasaría igual si el cuerpo estuviera mal por cualquier otra razón —un enum que no se
        // sabe leer, por ejemplo— y estaría dando por buena una protección inexistente.
        Assert.Contains("RowVersion", json.Message, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// El mismo cuerpo con el token sí se enlaza. Sin esta mitad, la prueba de arriba pasaría
    /// igual si el cuerpo estuviera mal por cualquier otra razón.
    /// </summary>
    [Theory]
    [MemberData(nameof(CuerposSinToken))]
    public void TheSameBodyWithTheTokenBinds(string contrato, string cuerpo)
    {
        var conToken = cuerpo.TrimEnd().TrimEnd('}') + $",\"rowVersion\":\"{Token}\"}}";

        var enlazado = Deserializador(contrato)(conToken);

        Assert.NotNull(enlazado);
    }

    /// <summary>
    /// Asistencia es la excepción y se comprueba como tal: su cuerpo sin token sí se enlaza,
    /// porque el mismo endpoint crea o corrige y un alta no lleva token. Lo que impide corregir
    /// sin token ahí no es el contrato sino <c>UpsertAttendanceAsync</c>, y eso se prueba contra
    /// la base en <c>ConcurrencyTokenTests</c>.
    /// </summary>
    [Fact]
    public void AttendanceStillBindsWithoutTheTokenBecauseItAlsoCreates()
    {
        const string cuerpo =
            """
            {"idOrganization":"11111111-1111-1111-1111-111111111111",
             "idClient":"22222222-2222-2222-2222-222222222222",
             "idService":"33333333-3333-3333-3333-333333333333",
             "idScheduledShift":"66666666-6666-6666-6666-666666666666",
             "status":"Present","actualStartTime":"08:00:00","actualEndTime":"16:00:00",
             "minutesLate":0,"notes":null,"idApprovalRequest":null}
            """;

        var enlazado = JsonSerializer.Deserialize<UpsertAttendanceRequest>(cuerpo, Options);

        Assert.NotNull(enlazado);
        Assert.Null(enlazado.RowVersion);
    }

    private static Func<string, object?> Deserializador(string contrato) => contrato switch
    {
        nameof(UpdateIncidentRequest) =>
            cuerpo => JsonSerializer.Deserialize<UpdateIncidentRequest>(cuerpo, Options),
        nameof(UpdateCoverageRequest) =>
            cuerpo => JsonSerializer.Deserialize<UpdateCoverageRequest>(cuerpo, Options),
        nameof(ReopenOperationDayRequest) =>
            cuerpo => JsonSerializer.Deserialize<ReopenOperationDayRequest>(cuerpo, Options),
        nameof(UpdateServiceAssignmentRequest) =>
            cuerpo => JsonSerializer.Deserialize<UpdateServiceAssignmentRequest>(cuerpo, Options),
        _ => throw new ArgumentOutOfRangeException(nameof(contrato), contrato, "Contrato no contemplado.")
    };
}
