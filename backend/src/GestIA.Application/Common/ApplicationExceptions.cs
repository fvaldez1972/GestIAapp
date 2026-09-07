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

