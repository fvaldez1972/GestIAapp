using GestIA.Domain.Planning;

namespace GestIA.Application.Planning;

/// <summary>Un día del ciclo, tal como se captura en el constructor.</summary>
public sealed record ShiftPatternTemplateDayInput(
    int CycleDayNumber,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    bool IsRest);

public sealed record CreateShiftPatternTemplateRequest(
    Guid IdOrganization,
    string Name,
    string? Description,
    ShiftDaypart Daypart,
    int CycleDays,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    IReadOnlyList<ShiftPatternTemplateDayInput> Days);

public sealed record UpdateShiftPatternTemplateRequest(
    Guid IdOrganization,
    string Name,
    string? Description,
    ShiftDaypart Daypart,
    int CycleDays,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    IReadOnlyList<ShiftPatternTemplateDayInput> Days);

public sealed record ShiftPatternTemplateDayResponse(
    Guid IdShiftPatternTemplateDay,
    int CycleDayNumber,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    bool IsRest,
    bool IsOvernight,
    int DurationMinutes);

/// <summary>
/// Un patrón del catálogo, con lo que la pantalla necesita mostrar.
///
/// <para><b>Las tres últimas no se guardan: se calculan aquí.</b> Las horas por semana salen del
/// ciclo, y si excede la jornada legal depende del límite vigente <b>en la fecha desde la que rige
/// el patrón</b>. Guardarlas dejaría filas mintiendo el día que cambie la ley.</para>
/// </summary>
public sealed record ShiftPatternTemplateResponse(
    Guid IdShiftPatternTemplate,
    string Name,
    string? Description,
    ShiftDaypart Daypart,
    int CycleDays,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    bool Active,
    IReadOnlyList<ShiftPatternTemplateDayResponse> Days,
    /// <summary>Si todos los días del ciclo están declarados. Uno sin declarar no es un descanso.</summary>
    bool IsComplete,
    int RestDays,
    decimal WeeklyHours,
    /// <summary>El límite legal contra el que se juzgó, para que la pantalla diga contra qué mide.</summary>
    decimal WeeklyLimit,
    WeeklyHoursCompliance Compliance,
    /// <summary>Por cuántas horas excede. Cero cuando es conforme.</summary>
    decimal ExcessHours,
    /// <summary>El descanso descrito con lo que se puede afirmar del ciclo.</summary>
    string RestDescription);

/// <summary>Lo mínimo para ofrecer el patrón en el desplegable de una posición.</summary>
public sealed record ShiftPatternTemplateOptionResponse(
    Guid IdShiftPatternTemplate,
    string Name,
    ShiftDaypart Daypart,
    int CycleDays,
    decimal WeeklyHours,
    WeeklyHoursCompliance Compliance,
    decimal ExcessHours);
