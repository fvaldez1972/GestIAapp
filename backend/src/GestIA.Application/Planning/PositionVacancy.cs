using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Planning;

/// <summary>
/// Cuánta gente le falta a una posición en una fecha.
///
/// <para><b>Es una proyección, no una columna.</b> Se calcula en cada consulta y no se guarda en
/// ninguna parte. Una columna almacenada obligaría a sincronizarla en cada alta y cada baja de
/// asignación, y basta un camino olvidado para que mienta justo cuando alguien la consulta para
/// decidir si puede cubrir un turno.</para>
///
/// <para><b>La vacancia puede ser negativa, y se muestra así.</b> Un número negativo significa
/// que hay más gente asignada que elementos requeridos, es decir, un sobrecubrimiento que nadie
/// autorizó. Recortarlo a cero produciría una cifra que se ve correcta y esconde exactamente lo
/// que el control de capacidad necesita ver.</para>
/// </summary>
public sealed record PositionVacancyResponse(
    Guid IdPosition,
    Guid IdService,
    string CodePosition,
    string Name,
    int RequiredWorkerCount,
    int AssignedWorkerCount,
    DateOnly Date)
{
    /// <summary>Lo que falta. Negativo si sobra gente; ver la nota de la clase.</summary>
    public int Vacancy => RequiredWorkerCount - AssignedWorkerCount;

    /// <summary>Hay hueco que cubrir. Es lo que la pantalla pinta en rojo.</summary>
    public bool HasVacancy => Vacancy > 0;

    /// <summary>Hay más gente asignada de la que la posición requiere.</summary>
    public bool IsOverstaffed => Vacancy < 0;
}

/// <summary>
/// La definición de la vacancia, en un solo lugar.
///
/// Recibe consultas y no un <c>DbContext</c> para que la regla viva en Application, donde se
/// puede leer junto al resto de las reglas, y aun así se traduzca a una sola sentencia SQL.
/// </summary>
public static class PositionVacancy
{
    /// <summary>
    /// Una asignación cuenta si empezó en o antes de la fecha y no había terminado.
    ///
    /// El día en que termina todavía cuenta: quien tiene una asignación que va hasta el 5 de
    /// septiembre sigue cubriendo el 5 de septiembre. Las asignaciones inactivas no cuentan, y de
    /// eso se encarga el filtro global de borrado lógico, no esta expresión.
    /// </summary>
    public static IQueryable<PositionVacancyResponse> Project(
        IQueryable<Position> positions,
        IQueryable<ServiceAssignment> assignments,
        DateOnly date)
    {
        ArgumentNullException.ThrowIfNull(positions);
        ArgumentNullException.ThrowIfNull(assignments);

        return positions.Select(position => new PositionVacancyResponse(
            position.IdPosition,
            position.IdService,
            position.CodePosition,
            position.Name,
            position.RequiredWorkerCount,
            assignments.Count(assignment =>
                assignment.IdPosition == position.IdPosition &&
                assignment.StartDate <= date &&
                (assignment.EndDate == null || assignment.EndDate >= date)),
            date));
    }
}
