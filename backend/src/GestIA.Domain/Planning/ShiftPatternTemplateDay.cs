using GestIA.Domain.Common;

namespace GestIA.Domain.Planning;

/// <summary>
/// Qué es un día del ciclo de una plantilla: un turno con su horario, o un descanso.
///
/// <para><b>El descanso es un hecho declarado, no una ausencia.</b> Antes «descansa el jueves» y
/// «nadie configuró el jueves» se veían idénticos en la base, y por eso el descanso no se podía
/// heredar ni proteger. Aquí un día descansa porque alguien lo dijo.</para>
///
/// <para><b>El día se identifica por su posición en el ciclo</b>, empezando en uno, y no por día de
/// la semana. Es lo que permite expresar un 24x48 —tres días— o un 2x2x2 —seis—, que con día de la
/// semana no caben.</para>
/// </summary>
public sealed class ShiftPatternTemplateDay : AuditableEntity, IOrganizationScopedEntity
{
    private ShiftPatternTemplateDay()
    {
    }

    private ShiftPatternTemplateDay(
        Guid idShiftPatternTemplateDay,
        Guid idOrganization,
        Guid idShiftPatternTemplate,
        int cycleDayNumber,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdShiftPatternTemplateDay = idShiftPatternTemplateDay;
        IdOrganization = idOrganization;
        IdShiftPatternTemplate = idShiftPatternTemplate;
        CycleDayNumber = cycleDayNumber;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdShiftPatternTemplateDay { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdShiftPatternTemplate { get; private set; }

    /// <summary>Su posición en el ciclo, empezando en uno.</summary>
    public int CycleDayNumber { get; private set; }

    /// <summary>Nulos en un día de descanso: no hay horario que declarar.</summary>
    public TimeOnly? StartTime { get; private set; }

    public TimeOnly? EndTime { get; private set; }

    public bool IsRest { get; private set; }

    /// <summary>
    /// Cuánto dura el turno, en minutos. Cero en un descanso.
    ///
    /// <para>Se guarda calculado porque un turno que cruza la medianoche —19:00 a 07:00— no se
    /// puede restar directo, y de esta duración salen las horas por semana que la pantalla muestra.
    /// El cruce se deduce del horario en lugar de pedirlo aparte: si la hora de fin es menor o igual
    /// que la de inicio, el turno cruza. Pedirlo como una casilla dejaba declarar un 19:00–07:00 sin
    /// marcarla, y entonces la duración salía negativa.</para>
    ///
    /// <para>La marca se llama <c>IsOvernight</c> igual que en <see cref="ShiftSegment"/>: es el
    /// mismo concepto, y dos nombres para una sola cosa es lo que hay que evitar. Además el estándar
    /// de base de datos exige que un booleano empiece con <c>Is</c>, <c>Has</c> o <c>Can</c>.</para>
    /// </summary>
    public int DurationMinutes { get; private set; }

    public bool IsOvernight { get; private set; }

    public ShiftPatternTemplate ShiftPatternTemplate { get; private set; } = null!;

    public static ShiftPatternTemplateDay Create(
        Guid idOrganization,
        Guid idShiftPatternTemplate,
        int cycleDayNumber,
        TimeOnly? startTime,
        TimeOnly? endTime,
        bool isRest,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var day = new ShiftPatternTemplateDay(
            Guid.NewGuid(), idOrganization, idShiftPatternTemplate, cycleDayNumber,
            actorId, actorName, occurredAt);

        day.Apply(startTime, endTime, isRest);
        return day;
    }

    public void Redeclare(
        TimeOnly? startTime,
        TimeOnly? endTime,
        bool isRest,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        Apply(startTime, endTime, isRest);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void Apply(TimeOnly? startTime, TimeOnly? endTime, bool isRest)
    {
        if (isRest)
        {
            StartTime = null;
            EndTime = null;
            IsRest = true;
            IsOvernight = false;
            DurationMinutes = 0;
            return;
        }

        if (startTime is null || endTime is null)
        {
            throw new ArgumentException("Un día de turno necesita hora de inicio y de fin.", nameof(startTime));
        }

        var inicio = startTime.Value;
        var fin = endTime.Value;
        var cruza = fin <= inicio;
        var minutos = cruza
            ? (24 * 60 - (inicio.Hour * 60 + inicio.Minute)) + (fin.Hour * 60 + fin.Minute)
            : (fin.Hour * 60 + fin.Minute) - (inicio.Hour * 60 + inicio.Minute);

        if (minutos is <= 0 or > 24 * 60)
        {
            throw new ArgumentOutOfRangeException(nameof(endTime), "La duración del turno debe estar entre 1 minuto y 24 horas.");
        }

        StartTime = inicio;
        EndTime = fin;
        IsRest = false;
        IsOvernight = cruza;
        DurationMinutes = minutos;
    }
}
