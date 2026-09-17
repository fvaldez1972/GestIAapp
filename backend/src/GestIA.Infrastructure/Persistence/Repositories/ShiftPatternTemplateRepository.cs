using GestIA.Application.Planning;
using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

/// <summary>
/// El acceso a datos del catálogo de patrones.
///
/// <para><b>Los días se traen siempre.</b> Las horas por semana y si el patrón está completo se
/// calculan de los días, así que una plantilla sin sus días leería cero horas y se vería incompleta
/// aunque no lo esté. No es una lectura opcional: es parte de la plantilla.</para>
/// </summary>
public sealed class ShiftPatternTemplateRepository(GestIaDbContext dbContext) : IShiftPatternTemplateRepository
{
    public async Task<IReadOnlyList<ShiftPatternTemplate>> ListAsync(
        Guid idOrganization,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        // El filtro de borrado lógico se apaga sólo cuando la pantalla pidió ver los retirados. El
        // de organización queda intacto: se apaga por nombre justamente para que apagar uno no
        // apague el otro.
        var consulta = includeInactive
            ? dbContext.ShiftPatternTemplates.IgnoreQueryFilters(["Active"])
            : dbContext.ShiftPatternTemplates;

        return await consulta
            .AsNoTracking()
            .Where(plantilla => plantilla.IdOrganization == idOrganization)
            .Include(plantilla => plantilla.Days)
            .OrderBy(plantilla => plantilla.Name)
            .ToArrayAsync(cancellationToken);
    }

    /// <summary>
    /// Trae la plantilla con todos sus días, retirados incluidos.
    ///
    /// <para>El filtro de borrado lógico se apaga a propósito: un día que un ciclo más corto retiró
    /// sigue ocupando su número dentro del patrón, así que si el ciclo vuelve a crecer hay que
    /// reactivar esa misma fila. Sin él cargado, declarar el día otra vez crearía una segunda fila
    /// con el mismo número y la clave única lo rechazaría.</para>
    /// </summary>
    public Task<ShiftPatternTemplate?> GetTrackedAsync(
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken) =>
        dbContext.ShiftPatternTemplates
            .IgnoreQueryFilters(["Active"])
            .Include(plantilla => plantilla.Days)
            .SingleOrDefaultAsync(
                plantilla => plantilla.IdShiftPatternTemplate == idShiftPatternTemplate,
                cancellationToken);

    /// <summary>
    /// La unicidad del nombre no distingue activos de inactivos, igual que en los catálogos:
    /// retirar un patrón no libera su nombre, porque las posiciones históricas siguen apuntando a
    /// él y dos filas con el mismo nombre normalizado harían ilegible cuál es cuál.
    /// </summary>
    public Task<bool> IsNameInUseAsync(
        Guid idOrganization,
        string normalizedName,
        Guid? excluding,
        CancellationToken cancellationToken) =>
        dbContext.ShiftPatternTemplates
            .IgnoreQueryFilters(["Active"])
            .AnyAsync(
                plantilla =>
                    plantilla.IdOrganization == idOrganization &&
                    plantilla.NormalizedName == normalizedName &&
                    (!excluding.HasValue || plantilla.IdShiftPatternTemplate != excluding.Value),
                cancellationToken);

    /// <summary>
    /// Cuenta también las posiciones retiradas. Una posición inactiva que sigue apuntando al patrón
    /// conserva su historial, y retirar el patrón dejaría ese historial apuntando a algo que la
    /// pantalla ya no sabe nombrar.
    /// </summary>
    public Task<int> CountPositionsUsingAsync(
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken) =>
        dbContext.Positions
            .IgnoreQueryFilters(["Active"])
            .CountAsync(
                position => position.IdShiftPatternTemplate == idShiftPatternTemplate,
                cancellationToken);

    public Task<bool> IsAssignableAsync(
        Guid idOrganization,
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken) =>
        dbContext.ShiftPatternTemplates
            .AnyAsync(
                plantilla =>
                    plantilla.IdOrganization == idOrganization &&
                    plantilla.IdShiftPatternTemplate == idShiftPatternTemplate &&
                    plantilla.Days.Count(day => day.Active) == plantilla.CycleDays,
                cancellationToken);

    public Task AddAsync(ShiftPatternTemplate pattern, CancellationToken cancellationToken) =>
        dbContext.ShiftPatternTemplates.AddAsync(pattern, cancellationToken).AsTask();

    public Task AddDaysAsync(
        IReadOnlyCollection<ShiftPatternTemplateDay> days,
        CancellationToken cancellationToken)
    {
        if (days.Count == 0)
        {
            return Task.CompletedTask;
        }

        dbContext.ShiftPatternTemplateDays.AddRange(days);
        return Task.CompletedTask;
    }
}
