using System.Reflection;
using System.Text.Json.Serialization;
using GestIA.Application.Common;

namespace GestIA.Architecture.Tests;

/// <summary>
/// Vigila que el token de concurrencia siga siendo obligatorio en los contratos de corrección.
///
/// <para><b>Por qué hace falta una prueba y no basta el tipo.</b> El tipo protege del olvido de
/// quien llama desde C#: un <c>byte[]</c> no anulable sin valor por omisión no deja compilar una
/// corrección sin token. Lo que el tipo no protege es del aflojamiento del propio contrato:
/// alguien vuelve a escribir <c>byte[]? RowVersion = null</c> para desatascar una prueba, y el
/// compilador queda contento porque ya no hay nada que exigir. Eso fue exactamente lo que pasó:
/// los seis contratos aceptaban nulo, el guard trataba el nulo como no comprobar nada, y el
/// frontend mandó el token desde un solo lugar de seis durante meses sin que fallara una sola
/// petición.</para>
///
/// <para><b>Y por qué además <see cref="JsonRequiredAttribute"/>.</b> Estos contratos se enlazan
/// desde el cuerpo JSON, no se construyen en C#. Sin el atributo, una propiedad ausente en el
/// cuerpo deja el campo en nulo pese a estar declarado no anulable: el sistema de tipos miente y
/// la comprobación vuelve a desaparecer, ahora de forma invisible. Con el atributo, el cuerpo
/// incompleto se rechaza al deserializar.</para>
/// </summary>
public sealed class ConcurrencyTokenContractTests
{
    private const string TokenProperty = "RowVersion";

    /// <summary>
    /// La única entrada de escritura que puede llevar el token en nulo, con su razón.
    ///
    /// <para>Es el endpoint que crea o corrige con la misma petición: en un alta no hay versión
    /// previa que pisar, así que exigir el token haría imposible capturar la primera asistencia
    /// del turno. La obligación no la puede expresar el tipo porque depende de si la fila existe,
    /// y por eso la exige <c>UpsertAttendanceAsync</c> en su rama de corrección.</para>
    ///
    /// <para><b>Esta lista sólo debe crecer con una decisión revisada y visible en el diff.</b>
    /// Una excepción más significa una ruta más por la que se puede perder un cambio en silencio.
    /// </para>
    /// </summary>
    private static readonly HashSet<string> CreaOCorrige = new(StringComparer.Ordinal)
    {
        "UpsertAttendanceRequest"
    };

    /// <summary>
    /// Toda petición de escritura que declare el token lo declara obligatorio, salvo la excepción
    /// documentada.
    /// </summary>
    [Fact]
    public void CorrectionRequestsRequireTheToken()
    {
        var incumplen = new List<string>();

        foreach (var contract in RequestContractsWithToken())
        {
            if (CreaOCorrige.Contains(contract.Name))
            {
                continue;
            }

            var property = contract.GetProperty(TokenProperty)!;

            if (IsNullable(property))
            {
                incumplen.Add($"{contract.Name}.{TokenProperty} es anulable; debe ser byte[] a secas.");
            }

            if (property.GetCustomAttribute<JsonRequiredAttribute>() is null)
            {
                incumplen.Add(
                    $"{contract.Name}.{TokenProperty} no lleva [property: JsonRequired]; un cuerpo " +
                    "sin token se enlazaría como nulo y la comprobación no ocurriría.");
            }

            if (PrimaryConstructorParameter(contract) is { HasDefaultValue: true })
            {
                incumplen.Add(
                    $"{contract.Name}.{TokenProperty} tiene valor por omisión; olvidarlo volvería a compilar.");
            }
        }

        Assert.True(incumplen.Count == 0, string.Join(Environment.NewLine, incumplen));
    }

    /// <summary>
    /// Toda respuesta que declare el token lo entrega siempre.
    ///
    /// <para>No es simetría por gusto. <c>CoverageRecordResponse.RowVersion</c> era anulable con
    /// valor por omisión, y el mapeo simplemente no lo pasaba: todas las respuestas de cobertura
    /// salieron con el token en nulo sin que nada fallara. Una pantalla no puede devolver un token
    /// que nunca recibió, así que un token opcional en la respuesta apaga la comprobación desde el
    /// otro extremo.</para>
    /// </summary>
    [Fact]
    public void ResponsesAlwaysCarryTheToken()
    {
        var incumplen = new List<string>();

        foreach (var contract in ApplicationTypes()
            .Where(type => type.Name.EndsWith("Response", StringComparison.Ordinal))
            .Where(type => type.GetProperty(TokenProperty) is not null))
        {
            var property = contract.GetProperty(TokenProperty)!;

            if (IsNullable(property))
            {
                incumplen.Add($"{contract.Name}.{TokenProperty} es anulable; la pantalla no podría devolverlo.");
            }

            if (PrimaryConstructorParameter(contract) is { HasDefaultValue: true })
            {
                incumplen.Add(
                    $"{contract.Name}.{TokenProperty} tiene valor por omisión; un mapeo puede omitirlo " +
                    "sin que el compilador diga nada, y sale nulo en todas las respuestas.");
            }
        }

        Assert.True(incumplen.Count == 0, string.Join(Environment.NewLine, incumplen));
    }

    /// <summary>
    /// La excepción sigue siendo una sola, y sigue siendo la de asistencia.
    ///
    /// <para>La lista blanca protege sólo mientras se mire. Sin esta prueba, agregar un nombre es
    /// una línea que pasa desapercibida en una revisión; con ella, agregarlo rompe una prueba
    /// cuyo nombre dice qué se está concediendo.</para>
    /// </summary>
    [Fact]
    public void OnlyAttendanceMayOmitTheToken()
    {
        Assert.Equal(["UpsertAttendanceRequest"], CreaOCorrige.Order().ToArray());

        var asistencia = RequestContractsWithToken().Single(type => type.Name == "UpsertAttendanceRequest");
        Assert.True(
            IsNullable(asistencia.GetProperty(TokenProperty)!),
            "Si asistencia dejó de necesitar el token opcional, quita la excepción en vez de dejarla sin uso.");
    }

    /// <summary>
    /// El guard no acepta un token anulable.
    ///
    /// <para>Es la puerta por la que entró el problema la primera vez: mientras <c>Expect</c>
    /// recibiera <c>byte[]?</c>, cualquier ruta podía pasarle nulo y la firma decía que estaba
    /// bien. Aflojarla otra vez volvería inútil todo lo de arriba.</para>
    /// </summary>
    [Fact]
    public void TheGuardDoesNotAcceptANullableToken()
    {
        var expect = typeof(IConcurrencyGuard).GetMethod(nameof(IConcurrencyGuard.Expect))!;
        var token = expect.GetParameters()[1];

        Assert.Equal(typeof(byte[]), token.ParameterType);
        Assert.Equal(
            NullabilityState.NotNull,
            new NullabilityInfoContext().Create(token).WriteState);
    }

    private static IEnumerable<Type> RequestContractsWithToken() =>
        ApplicationTypes()
            .Where(type => type.Name.EndsWith("Request", StringComparison.Ordinal))
            .Where(type => type.GetProperty(TokenProperty) is not null);

    private static IEnumerable<Type> ApplicationTypes() =>
        typeof(IConcurrencyGuard).Assembly.GetTypes().Where(type => type is { IsClass: true, IsPublic: true });

    private static bool IsNullable(PropertyInfo property) =>
        new NullabilityInfoContext().Create(property).ReadState != NullabilityState.NotNull;

    private static ParameterInfo? PrimaryConstructorParameter(Type contract) =>
        contract.GetConstructors()
            .SelectMany(constructor => constructor.GetParameters())
            .FirstOrDefault(parameter => string.Equals(parameter.Name, TokenProperty, StringComparison.Ordinal));
}
