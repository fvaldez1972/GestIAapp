using GestIA.Application.Common;

namespace GestIA.Infrastructure.Persistence;

/// <summary>
/// Contexto sin organización, para el único punto donde se construye un
/// <see cref="GestIaDbContext"/> fuera de una petición: el diseño de migraciones, que sólo
/// construye el modelo y no consulta nada.
///
/// Es <c>internal</c> a propósito. Si fuera público alguien podría registrarlo en el contenedor
/// y apagar el aislamiento entre organizaciones de toda la aplicación sin que se notara.
/// </summary>
internal sealed class NoOrganizationContext : IOrganizationContext
{
    public Guid? CurrentOrganizationId => null;

    public void SetAuthorizedOrganization(Guid organizationId) =>
        throw new InvalidOperationException(
            "Fuera de una petición no hay organización que fijar.");
}

/// <summary>
/// Bitácora vacía, para el mismo punto: en tiempo de diseño no hay correcciones que registrar
/// porque no hay guardados. Es <c>internal</c> por la misma razón que
/// <see cref="NoOrganizationContext"/>: registrarla en el contenedor apagaría el historial de
/// toda la aplicación sin que se notara.
/// </summary>
internal sealed class NoOperationalHistoryRecorder : History.IOperationalHistoryRecorder
{
    public IReadOnlyList<Domain.History.OperationalEvent> Capture(
        Microsoft.EntityFrameworkCore.ChangeTracking.ChangeTracker changeTracker) => [];

    public void Complete()
    {
    }
}
