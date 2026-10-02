using GestIA.Application.Common;

namespace GestIA.Api.Endpoints;

/// <summary>
/// Lee el token de concurrencia que viaja por la cadena de consulta.
///
/// <para><b>Por qué en la consulta y no en el cuerpo.</b> Estas rutas son <c>DELETE</c>, y un
/// DELETE no lleva cuerpo. Lo correcto en HTTP sería el encabezado <c>If-Match</c>; se eligió el
/// parámetro por consistencia con el resto de esta API, que ya pasa <c>organizationId</c> así.
/// <b>Sigue anotado como deuda menor</b>, y ahora con una razón más: un parámetro de consulta
/// queda escrito en los registros de acceso del proxy y del túnel, y el token es estado de la fila.
/// </para>
///
/// <para><b>Un token mal formado ya no se trata como ausente.</b> Antes se devolvía nulo, que
/// significaba «no comprobar nada»: una cadena rota conseguía exactamente lo que conseguía
/// omitirla, y desactivaba la protección sin decirlo. Ahora las dos formas de no traer un token
/// válido fallan, y fallan distinto de un conflicto para que la pantalla pueda separarlas.</para>
/// </summary>
internal static class ConcurrencyToken
{
    internal static byte[] Require(string? rowVersion, string parameterName = "rowVersion")
    {
        if (string.IsNullOrWhiteSpace(rowVersion))
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [parameterName] =
                    ["Falta el token de concurrencia del registro. Vuelve a cargarlo y reintenta."]
            });
        }

        var buffer = new byte[rowVersion.Length];
        if (!Convert.TryFromBase64String(rowVersion, buffer, out var written) || written == 0)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [parameterName] =
                    ["El token de concurrencia no tiene un formato válido. Vuelve a cargar el registro y reintenta."]
            });
        }

        return buffer[..written];
    }
}
