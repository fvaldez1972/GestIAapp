using GestIA.Application.Common;
using GestIA.Domain.Common;
using GestIA.Domain.History;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace GestIA.Infrastructure.Persistence.History;

/// <summary>
/// Convierte los cambios pendientes de un guardado en eventos de bitácora.
///
/// Está aparte del <see cref="GestIaDbContext"/> para poder probarse sola y para que el contexto
/// no cargue con la lógica de qué se registra y con qué nombre.
/// </summary>
public interface IOperationalHistoryRecorder
{
    IReadOnlyList<OperationalEvent> Capture(ChangeTracker changeTracker);

    /// <summary>
    /// Se llama cuando el guardado terminó bien. Olvida el motivo declarado para que no se
    /// herede a una corrección posterior de la misma petición, que quedaría registrada con una
    /// justificación que no le corresponde.
    ///
    /// Sólo tras el éxito: si el guardado falla y alguien reintenta, el motivo sigue ahí.
    /// </summary>
    void Complete();
}

/// <inheritdoc cref="IOperationalHistoryRecorder"/>
public sealed class OperationalHistoryRecorder(
    IActorContext actor,
    IClock clock,
    IOperationReasonContext reason) : IOperationalHistoryRecorder
{
    public IReadOnlyList<OperationalEvent> Capture(ChangeTracker changeTracker)
    {
        ArgumentNullException.ThrowIfNull(changeTracker);

        var events = new List<OperationalEvent>();
        var occurredAt = clock.UtcNow;

        foreach (var entry in changeTracker.Entries())
        {
            if (entry.State is not EntityState.Modified ||
                !OperationalSnapshot.IsTracked(entry.Entity) ||
                !entry.Properties.Any(property => property.IsModified))
            {
                continue;
            }

            // La foto previa sale de los valores originales que EF ya tiene cargados: no hace
            // falta consultar de nuevo ni que el servicio la capture a mano antes de mutar.
            var before = OperationalSnapshot.Capture(entry.OriginalValues.ToObject());
            var after = OperationalSnapshot.Capture(entry.Entity);

            events.Add(OperationalEvent.Record(
                after,
                before.Json,
                ResolveAction(entry),
                reason.Reason,
                reason.IsReasonRequired,
                actor.ActorId,
                actor.ActorName,
                occurredAt));
        }

        return events;
    }

    public void Complete() => reason.Clear();

    /// <summary>
    /// El nombre que el servicio haya declarado, o el derivado del cambio.
    ///
    /// <b>Las altas no se registran</b>, ni aquí ni en ninguna parte: un evento de creación no
    /// tiene valor anterior que mostrar, así que sólo diría "se creó", y eso ya lo dicen los
    /// campos <c>CreatedAt</c>, <c>CreatedBy</c> y <c>CreatedByName</c> del propio registro, que
    /// la pantalla de Auditoría ya muestra. El historial existe para las correcciones.
    /// </summary>
    private string ResolveAction(EntityEntry entry)
    {
        if (!string.IsNullOrWhiteSpace(reason.DeclaredAction))
        {
            return reason.DeclaredAction;
        }

        var active = entry.Property(nameof(IActivatableEntity.Active));

        if (active.IsModified && active.CurrentValue is bool current && active.OriginalValue is bool original && current != original)
        {
            return current ? OperationalEventActions.Reactivated : OperationalEventActions.Deactivated;
        }

        return OperationalEventActions.Updated;
    }
}
