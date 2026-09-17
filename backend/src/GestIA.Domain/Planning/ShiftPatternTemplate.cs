using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Planning;

/// <summary>Con qué luz se trabaja el turno. Decide, entre otras cosas, si aplica prima nocturna.</summary>
public enum ShiftDaypart
{
    /// <summary>Diurno.</summary>
    Day,

    /// <summary>Nocturno.</summary>
    Night,

    /// <summary>Mixto: cruza la frontera entre día y noche.</summary>
    Mixed,

    /// <summary>Rotativo: la misma posición alterna día y noche dentro del ciclo.</summary>
    Rotating
}

public sealed record ShiftPatternTemplateProfile(
    string Name,
    string? Description,
    ShiftDaypart Daypart,
    int CycleDays,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate);

/// <summary>
/// Un patrón de turno del catálogo de la organización, reutilizable por cualquier posición.
///
/// <para><b>Por qué existe.</b> Hasta ahora el patrón se capturaba dentro de cada posición y sus
/// días se declaraban por día de la semana, así que sólo se podían expresar ciclos semanales: un
/// 24x48 es un ciclo de tres días y no cabía. Además había que volver a teclear el mismo horario en
/// cada posición. Aquí se captura una vez —«Día 1, 07:00–16:00»— y se elige de un desplegable.</para>
///
/// <para><b>El ciclo, con su longitud.</b> Un patrón declara de cuántos días es su ciclo y qué es
/// cada uno de ellos: turno con horario, o descanso. Un patrón semanal es el caso particular de
/// ciclo de siete. Así el descanso deja de ser la ausencia de un dato y pasa a ser un hecho
/// declarado, que se puede heredar y verificar.</para>
///
/// <para><b>Las horas por semana no se guardan.</b> Se calculan de las horas de turno declaradas y
/// la longitud del ciclo. Guardarlas obligaría a recalcularlas en cada camino que las afecte, y
/// basta que uno se olvide para que la fila quede mintiendo. Lo mismo con si excede la jornada
/// legal: la respuesta cambia con la ley, así que es una lectura y no un dato.</para>
/// </summary>
public sealed class ShiftPatternTemplate : AuditableEntity, IOrganizationScopedEntity
{
    private readonly List<ShiftPatternTemplateDay> days = [];

    private ShiftPatternTemplate()
    {
    }

    private ShiftPatternTemplate(
        Guid idShiftPatternTemplate,
        Guid idOrganization,
        ShiftPatternTemplateProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdShiftPatternTemplate = idShiftPatternTemplate;
        IdOrganization = idOrganization;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdShiftPatternTemplate { get; private set; }
    public Guid IdOrganization { get; private set; }
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// El nombre normalizado, que es lo que sostiene la unicidad.
    ///
    /// <para>Igual que en los valores de catálogo: sin esto, «12x12 diurno» y «12X12 Diurno» serían
    /// dos patrones distintos y nadie sabría cuál eligió.</para>
    /// </summary>
    public string NormalizedName { get; private set; } = string.Empty;

    public string? Description { get; private set; }
    public ShiftDaypart Daypart { get; private set; }

    /// <summary>De cuántos días es el ciclo. Siete en un patrón semanal.</summary>
    public int CycleDays { get; private set; }

    public DateOnly EffectiveFromDate { get; private set; }
    public DateOnly? EffectiveToDate { get; private set; }
    public Organization Organization { get; private set; } = null!;
    public IReadOnlyCollection<ShiftPatternTemplateDay> Days => days;

    public static ShiftPatternTemplate Create(
        Guid idOrganization,
        ShiftPatternTemplateProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        ShiftPatternTemplateProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ShiftPatternTemplateProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);

        // Un ciclo de cero días no es un patrón, y uno de más de un año no es un ciclo: es un
        // calendario. El tope evita que un dedazo genere una plantilla imposible de leer.
        if (profile.CycleDays is < 1 or > 366)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "El ciclo debe tener entre 1 y 366 días.");
        }

        if (profile.EffectiveToDate < profile.EffectiveFromDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "La vigencia no puede terminar antes de empezar.");
        }

        Name = Required(profile.Name, nameof(profile.Name));
        NormalizedName = CatalogNameOf(Name);
        Description = Optional(profile.Description);
        Daypart = profile.Daypart;
        CycleDays = profile.CycleDays;
        EffectiveFromDate = profile.EffectiveFromDate;
        EffectiveToDate = profile.EffectiveToDate;
    }

    /// <summary>
    /// Declara qué es un día del ciclo. Vuelve a declararlo si ya estaba.
    ///
    /// <para>El día se identifica por su posición en el ciclo, empezando en uno. Un día que nadie
    /// declara es un día <b>sin declarar</b>, que no es lo mismo que un descanso: por eso la
    /// plantilla sabe decir si está completa.</para>
    /// </summary>
    public void DeclareDay(
        int cycleDayNumber,
        TimeOnly? startTime,
        TimeOnly? endTime,
        bool isRest,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (cycleDayNumber < 1 || cycleDayNumber > CycleDays)
        {
            throw new ArgumentOutOfRangeException(
                nameof(cycleDayNumber),
                $"El día del ciclo debe estar entre 1 y {CycleDays}.");
        }

        var existente = days.SingleOrDefault(day => day.CycleDayNumber == cycleDayNumber);

        if (existente is null)
        {
            days.Add(ShiftPatternTemplateDay.Create(
                IdOrganization, IdShiftPatternTemplate, cycleDayNumber, startTime, endTime, isRest,
                actorId, actorName, occurredAt));
        }
        else
        {
            existente.Redeclare(startTime, endTime, isRest, actorId, actorName, occurredAt);
        }

        RegisterUpdate(actorId, actorName, occurredAt);
    }

    /// <summary>
    /// Si todos los días del ciclo están declarados.
    ///
    /// <para>Una plantilla incompleta no se prohíbe —se captura por partes— pero se señala: generar
    /// turnos con días sin declarar dejaría huecos que nadie pidió.</para>
    /// </summary>
    public bool IsComplete => days.Count(day => day.Active) == CycleDays;

    /// <summary>Los minutos de trabajo que declara el ciclo completo.</summary>
    public int CycleWorkMinutes => days.Where(day => day.Active && !day.IsRest).Sum(day => day.DurationMinutes);

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// La normalización es la misma que la de los valores de catálogo, y se referencia en lugar de
    /// copiarse para que no puedan divergir.
    /// </summary>
    private static string CatalogNameOf(string value) => Catalogs.CatalogName.Normalize(value);
}
