using GestIA.Application.Common;
using GestIA.Domain.History;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence;

/// <summary>
/// Cómo se explica un conflicto de concurrencia.
///
/// <para><b>Vivía dentro de la transacción operativa, y ése era el problema.</b> Sólo las cinco
/// entidades operativas pasaban por ahí; las otras dos con <c>rowversion</c> —la configuración de
/// servicio y la asignación— guardan por el camino normal, así que su conflicto salía como un 500
/// sin explicar y no como el 409 que dice quién pisó el cambio. El mensaje estaba construido y no
/// llegaba a la mitad de los casos.</para>
/// </summary>
internal static class ConcurrencyConflictDescription
{
    /// <summary>
    /// Convierte un conflicto de concurrencia en un mensaje que dice quién pisó el cambio y
    /// cuándo, en vez del genérico que sólo anuncia el problema.
    ///
    /// <para>Los valores en memoria no sirven: son los que se leyeron antes de que el otro
    /// guardara, es decir, la vista del que perdió. Hay que releer la fila de la base, que es lo
    /// que hace <c>GetDatabaseValuesAsync</c>.</para>
    ///
    /// <para>Si la búsqueda del autor falla por cualquier motivo, se cae al mensaje genérico. Un
    /// conflicto mal explicado sigue siendo un conflicto correctamente detectado, y esta consulta
    /// no puede convertirse en la causa de un error distinto.</para>
    /// </summary>
    internal static async Task<string> BuildAsync(
        GestIaDbContext dbContext,
        TimeZoneInfo operationalTimeZone,
        DbUpdateConcurrencyException exception,
        CancellationToken cancellationToken)
    {
        try
        {
            if (exception.Entries.Count == 0)
            {
                return ConcurrencyConflictMessage.Generic;
            }

            var entry = exception.Entries[0];
            var databaseValues = await entry.GetDatabaseValuesAsync(cancellationToken);

            ConcurrencyConflictAuthor? fromAuditFields = databaseValues is null
                ? null
                : new ConcurrencyConflictAuthor(
                    databaseValues["UpdatedByName"] as string,
                    databaseValues["UpdatedAt"] as DateTime?);

            var fromHistory = await LastHistoryAuthorAsync(dbContext, entry.Entity, cancellationToken);

            return ConcurrencyConflictMessage.Build(fromHistory, fromAuditFields, operationalTimeZone);
        }
        catch (Exception)
        {
            return ConcurrencyConflictMessage.Generic;
        }
    }

    /// <summary>
    /// El último evento de bitácora del registro, si lo hay.
    ///
    /// <b>Para <c>OperationDayClosure</c> nunca lo habrá</b>: no es una de las cinco entidades con
    /// historial. Ése no es un caso raro sino el conflicto más probable de todos —dos personas
    /// cerrando el turno a la vez— y por eso existe el segundo nivel de la escalera.
    /// </summary>
    private static async Task<ConcurrencyConflictAuthor?> LastHistoryAuthorAsync(
        GestIaDbContext dbContext,
        object entity,
        CancellationToken cancellationToken)
    {
        if (!OperationalSnapshot.IsTracked(entity))
        {
            return null;
        }

        var capture = OperationalSnapshot.Capture(entity);

        var last = await dbContext.OperationalEvents
            .AsNoTracking()
            // Sin bypass: el guard ya fijo la organizacion y el registro en conflicto es de ella.
            // OperationalEvent tampoco lleva borrado logico, asi que no hay nada mas que apagar.
            .Where(item => item.EntityType == capture.EntityType && item.RecordId == capture.RecordId)
            .OrderByDescending(item => item.OccurredAt)
            .ThenByDescending(item => item.IdOperationalEvent)
            .FirstOrDefaultAsync(cancellationToken);

        return last is null ? null : new ConcurrencyConflictAuthor(last.ActorName, last.OccurredAt);
    }
}
