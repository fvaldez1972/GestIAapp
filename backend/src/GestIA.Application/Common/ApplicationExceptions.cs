namespace GestIA.Application.Common;

public sealed class ResourceNotFoundException(string message) : Exception(message);

public class ResourceConflictException(string message) : Exception(message);

public sealed class ResourceForbiddenException(string message) : Exception(message);

public sealed class RequestValidationException : Exception
{
    public RequestValidationException(IReadOnlyDictionary<string, string[]> errors)
        : base("La solicitud contiene datos inválidos.")
    {
        Errors = errors;
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }
}

/// <summary>
/// Alguien más corrigió el registro entre que se leyó y se guardó.
///
/// <para><b>Es un conflicto distinto del de un código repetido, aunque los dos sean 409.</b> Un
/// código repetido se arregla cambiando el código; éste no se arregla reintentando: hay que ver
/// qué cambió la otra persona. La pantalla necesita distinguirlos para ofrecer la salida correcta,
/// y por el estado no puede, así que se distingue por el tipo y por el título de la respuesta.</para>
/// </summary>
public sealed class ConcurrencyConflictException(string message) : ResourceConflictException(message);


/// <summary>
/// La petición pretendía corregir un registro existente y no trajo el token de concurrencia.
///
/// <para><b>No es lo mismo que un conflicto.</b> Un <see cref="ConcurrencyConflictException"/>
/// dice «alguien te ganó»; éste dice «no me dijiste con qué versión venías», que es un defecto de
/// quien llama y no una carrera entre dos personas. Se separan porque la pantalla no puede
/// resolverlos igual: el conflicto se resuelve recargando y comparando, y éste sólo se resuelve
/// arreglando la petición.</para>
///
/// <para>Sale como <b>428 Precondition Required</b>, que es el estado que HTTP reserva justo para
/// esto: el servidor exige que la petición sea condicional. Un 400 lo escondería entre los errores
/// de captura del usuario, que es lo último que conviene: esto nunca lo causa el usuario.</para>
/// </summary>
public sealed class ConcurrencyTokenMissingException(string message) : Exception(message);
