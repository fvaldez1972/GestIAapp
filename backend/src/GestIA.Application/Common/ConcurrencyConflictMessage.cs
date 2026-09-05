
namespace GestIA.Application.Common;

/// <summary>Quién pisó un cambio y cuándo, con la fuente de la que se supo.</summary>
/// <param name="ActorName">Nombre de quien hizo el cambio que ganó. Nulo si no se pudo saber.</param>
/// <param name="OccurredAt">Instante de ese cambio, en UTC. Nulo si no se pudo saber.</param>
public sealed record ConcurrencyConflictAuthor(string? ActorName, DateTime? OccurredAt);

/// <summary>
/// El mensaje de un conflicto de concurrencia.
///
/// <para>El genérico —"los datos cambiaron"— anuncia el problema y no lo resuelve: quien lo lee no
/// sabe si perdió algo importante ni a quién preguntarle. Con la bitácora construida en la tanda C
/// se puede decir quién y cuándo, y es la primera vez que ese historial sirve en el momento y no
/// sólo para auditar después.</para>
///
/// <para><b>La escalera tiene tres niveles y nunca inventa un nombre.</b></para>
///
/// <list type="number">
/// <item><b>El último evento de bitácora</b> del registro. Es la fuente mejor, porque además sabe
/// qué cambió.</item>
/// <item><b>Los campos de auditoría de la propia fila</b>, <c>UpdatedByName</c> y
/// <c>UpdatedAt</c>, que la escritura ganadora ya actualizó. Este nivel <b>no es un caso raro</b>:
/// <c>OperationDayClosure</c> no lleva bitácora, así que el conflicto más probable de todos —dos
/// personas cerrando el turno a la vez— siempre cae aquí. También cubre las filas anteriores a la
/// bitácora.</item>
/// <item><b>El mensaje genérico.</b> Sólo cuando ninguna de las dos fuentes tiene nombre. No
/// debería ocurrir —si una fila se pisó, alguien la actualizó— y existe porque un mensaje vacío es
/// peor que uno genérico.</item>
/// </list>
///
/// <para>Si el nombre viene nulo se baja de nivel; <b>nunca</b> se rellena con "otro usuario".</para>
/// </summary>
public static class ConcurrencyConflictMessage
{
    private static readonly string[] Meses =
        ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

    /// <summary>Lo que se responde cuando no se pudo saber quién fue.</summary>
    public const string Generic =
        "Los datos cambiaron mientras editabas. Vuelve a cargar el registro para no perder el " +
        "cambio de la otra persona.";

    /// <summary>
    /// Construye el mensaje con la primera fuente que traiga nombre.
    /// </summary>
    /// <param name="fromHistory">Autor según el último evento de bitácora, o nulo si no hay.</param>
    /// <param name="fromAuditFields">Autor según <c>UpdatedByName</c> de la fila, o nulo.</param>
    /// <param name="operationalTimeZone">
    /// Huso en el que se muestra la hora. El instante se guarda en UTC, pero un mensaje que le
    /// dice a un supervisor "a las 16:05" cuando en su reloj eran las 10:05 no ayuda, confunde.
    /// </param>
    public static string Build(
        ConcurrencyConflictAuthor? fromHistory,
        ConcurrencyConflictAuthor? fromAuditFields,
        TimeZoneInfo operationalTimeZone)
    {
        ArgumentNullException.ThrowIfNull(operationalTimeZone);

        if (Describe(fromHistory, operationalTimeZone) is { } corrected)
        {
            return $"{corrected} corrigió este registro. Vuelve a cargarlo para no perder su corrección.";
        }

        if (Describe(fromAuditFields, operationalTimeZone) is { } modified)
        {
            return $"{modified} modificó este registro. Vuelve a cargarlo para no perder su cambio.";
        }

        return Generic;
    }

    /// <summary>
    /// "Ana Ruiz, el 05 sep 2026 a las 10:05". Devuelve nulo si no hay nombre: sin nombre no hay
    /// nada que decir que el mensaje genérico no diga igual.
    /// </summary>
    private static string? Describe(ConcurrencyConflictAuthor? author, TimeZoneInfo zone)
    {
        if (author is null || string.IsNullOrWhiteSpace(author.ActorName))
        {
            return null;
        }

        var name = author.ActorName.Trim();

        if (author.OccurredAt is not { } occurredAt)
        {
            return name;
        }

        var local = TimeZoneInfo.ConvertTimeFromUtc(
            occurredAt.Kind == DateTimeKind.Utc ? occurredAt : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc),
            zone);

        // **El formato es el único de la aplicación: `04 sep 2026`.** La cultura es-MX abrevia
        // septiembre como «sept», de cuatro letras, y eso metía un segundo formato de fecha en un
        // producto que tiene uno solo. Los meses van escritos aquí por esa razón.
        return $"{name}, el {local.Day:00} {Meses[local.Month - 1]} {local.Year} a las {local.Hour:00}:{local.Minute:00},";
    }
}
