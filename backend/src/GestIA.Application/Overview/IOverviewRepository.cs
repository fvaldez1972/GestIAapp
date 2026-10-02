namespace GestIA.Application.Overview;

public interface IOverviewRepository
{
    /// <summary>
    /// Los hechos de la organización a una fecha operativa.
    ///
    /// <para>Una sola llamada porque es la pantalla de aterrizaje: corre en cada entrada, y
    /// repartirla en doce peticiones haría que la primera impresión del producto fuera una
    /// espera.</para>
    /// </summary>
    Task<OverviewFacts> GetFactsAsync(
        Guid idOrganization,
        DateOnly operationDate,
        DateOnly previousOperationDate,
        DateOnly weekStartDate,
        DateOnly weekEndDate,
        DateOnly nextWeekStartDate,
        DateOnly nextWeekEndDate,
        CancellationToken cancellationToken);
}
