using GestIA.Application.Common;
using GestIA.Domain.History;
using GestIA.Infrastructure.Persistence.History;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace GestIA.IntegrationTests;

/// <summary>
/// El motivo de la corrección en curso durante una prueba. En producción lo fija la capa de
/// aplicación tras comprobar si el día estaba cerrado o el periodo vencido; aquí lo fija la
/// prueba, que es lo que le permite ejercitar las dos ramas de la regla.
/// </summary>
public sealed class TestOperationReasonContext : IOperationReasonContext
{
    public string? Reason { get; private set; }

    public bool IsReasonRequired { get; private set; }

    public string? DeclaredAction { get; private set; }

    public void SetReason(string? reason, bool isRequired)
    {
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        IsReasonRequired = isRequired;
    }

    public void DeclareAction(string action) => DeclaredAction = action;

    public void Clear()
    {
        Reason = null;
        IsReasonRequired = false;
        DeclaredAction = null;
    }
}

/// <summary>
/// Bitácora apagada, para las pruebas que sólo leen el modelo de EF y nunca guardan nada. Que
/// sea un tipo con nombre y no un <c>null</c> es a propósito: apagar el historial tiene que
/// verse en el código de la prueba que lo apaga.
/// </summary>
public sealed class NoHistoryRecorder : IOperationalHistoryRecorder
{
    public IReadOnlyList<OperationalEvent> Capture(ChangeTracker changeTracker) => [];

    public void Complete()
    {
    }
}

/// <summary>Actor fijo para las pruebas que escriben historial.</summary>
public sealed class TestHistoryActor : IActorContext
{
    public Guid ActorId { get; } = Guid.Parse("0f4a7f4f-1f0e-4a35-8f2e-3f9d5a6b7c80");

    public string ActorName => "Pruebas";
}

/// <summary>Reloj fijo, para que el instante del evento sea comprobable.</summary>
public sealed class TestHistoryClock : IClock
{
    public DateTime UtcNow { get; } = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);

    // Doble de prueba: la fecha sale del instante simulado, sin huso.
    public DateOnly Today => DateOnly.FromDateTime(UtcNow);

    // Doble de prueba: sin huso, la hora local es la UTC.
    public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
}
