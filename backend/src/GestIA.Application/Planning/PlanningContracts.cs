using GestIA.Domain.Planning;

namespace GestIA.Application.Planning;

/// <summary>
/// El alta de una posicion del servicio.
///
/// <para><c>CodePosition</c> es opcional: sin el, lo pone el servidor con la forma <c>P-01</c>,
/// consecutivo por servicio. Es el mismo trato que el codigo de servicio, de cliente y de
/// organizacion: un identificador de conveniencia, no la clave del registro.</para>
/// </summary>
public sealed record CreatePositionRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    string? CodePosition,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes,
    Guid? IdJobPositionCatalogItem = null,
    decimal MonthlyPrice = 0m,
    string CurrencyCode = "MXN",
    bool IsTaxIncluded = false);

public sealed record UpdatePositionRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes,
    Guid? IdJobPositionCatalogItem = null,
    decimal MonthlyPrice = 0m,
    string CurrencyCode = "MXN",
    bool IsTaxIncluded = false);

public sealed record PositionResponse(
    Guid IdPosition,
    Guid IdService,
    string CodePosition,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    Guid? IdJobPositionCatalogItem,
    string? Notes,
    bool Active,
    decimal MonthlyPrice,
    string CurrencyCode,
    bool IsTaxIncluded);

/// <summary>
/// El alta de un patron de turnos. <c>CodeShiftPattern</c> es opcional: sin el, lo pone el servidor
/// con la forma <c>PAT-01</c>, consecutivo por posicion.
/// </summary>
public sealed record CreateShiftPatternRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdPosition,
    string? CodeShiftPattern,
    string Name,
    string? Description,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate);

public sealed record UpdateShiftPatternRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdPosition,
    string Name,
    string? Description,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate);

public sealed record ShiftPatternResponse(
    Guid IdShiftPattern,
    Guid IdPosition,
    string CodeShiftPattern,
    string Name,
    string? Description,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    bool Active);

public sealed record CreateShiftSegmentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdPosition,
    Guid IdShiftPattern,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    int RequiredWorkerCount,
    string? Notes);

public sealed record UpdateShiftSegmentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdPosition,
    Guid IdShiftPattern,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    int RequiredWorkerCount,
    string? Notes);

public sealed record ShiftSegmentResponse(
    Guid IdShiftSegment,
    Guid IdShiftPattern,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    int RequiredWorkerCount,
    int DurationMinutes,
    string? Notes,
    bool Active);

public sealed record PositionDetailResponse(
    PositionResponse Position,
    IReadOnlyList<ShiftPatternResponse> ShiftPatterns);

public sealed record ShiftPatternDetailResponse(
    ShiftPatternResponse ShiftPattern,
    IReadOnlyList<ShiftSegmentResponse> Segments);

