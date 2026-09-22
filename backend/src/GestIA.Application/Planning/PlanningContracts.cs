using GestIA.Domain.Common;
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
    decimal Price = 0m,
    string CurrencyCode = "MXN",
    bool IsTaxIncluded = false,
    PaymentFrequency PriceFrequency = PaymentFrequency.Monthly,
    Guid? IdShiftPatternTemplate = null,
    /// <summary>El sexo que el cliente pide para la posición. Es del puesto, no de la persona.</summary>
    Guid? IdSexCatalogItem = null,
    Guid? IdAgeRangeCatalogItem = null,
    Guid? IdEducationLevelCatalogItem = null,
    /// <summary>
    /// El equipo que el cliente pide, que casi nunca es uno. Nulo deja el equipo como estaba; una
    /// lista vacía lo retira.
    /// </summary>
    IReadOnlyList<Guid>? IdRequiredEquipmentCatalogItems = null,
    /// <summary>
    /// Desde cuándo hace falta el puesto. <b>Nulo hereda el inicio del servicio</b>, que es lo que
    /// una posición sin vigencia propia tenía implícitamente.
    /// </summary>
    DateOnly? StartDate = null,
    /// <summary>
    /// Hasta cuándo. Nulo hereda el fin del servicio, incluido cuando el servicio no tiene: ahí el
    /// puesto es permanente.
    /// </summary>
    DateOnly? EndDate = null);

public sealed record UpdatePositionRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes,
    Guid? IdJobPositionCatalogItem = null,
    decimal Price = 0m,
    string CurrencyCode = "MXN",
    bool IsTaxIncluded = false,
    PaymentFrequency PriceFrequency = PaymentFrequency.Monthly,
    Guid? IdShiftPatternTemplate = null,
    /// <summary>El sexo que el cliente pide para la posición. Es del puesto, no de la persona.</summary>
    Guid? IdSexCatalogItem = null,
    Guid? IdAgeRangeCatalogItem = null,
    Guid? IdEducationLevelCatalogItem = null,
    /// <summary>
    /// El equipo que el cliente pide, que casi nunca es uno. Nulo deja el equipo como estaba; una
    /// lista vacía lo retira.
    /// </summary>
    IReadOnlyList<Guid>? IdRequiredEquipmentCatalogItems = null,
    /// <summary>
    /// Desde cuándo hace falta el puesto. <b>Nulo hereda el inicio del servicio</b>, que es lo que
    /// una posición sin vigencia propia tenía implícitamente.
    /// </summary>
    DateOnly? StartDate = null,
    /// <summary>
    /// Hasta cuándo. Nulo hereda el fin del servicio, incluido cuando el servicio no tiene: ahí el
    /// puesto es permanente.
    /// </summary>
    DateOnly? EndDate = null);

public sealed record PositionResponse(
    Guid IdPosition,
    Guid IdService,
    string CodePosition,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    Guid? IdJobPositionCatalogItem,
    string? Notes,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool Active,
    decimal Price,
    string CurrencyCode,
    bool IsTaxIncluded,
    /// <summary>Cada cuándo se cobra el precio. Un importe sin su periodo no significa nada.</summary>
    PaymentFrequency PriceFrequency,
    /// <summary>
    /// El patrón del catálogo que sigue la posición. Nulo mientras la posición conserve su patrón
    /// propio, capturado antes de que existiera el catálogo.
    /// </summary>
    Guid? IdShiftPatternTemplate,
    Guid? IdSexCatalogItem,
    Guid? IdAgeRangeCatalogItem,
    Guid? IdEducationLevelCatalogItem,
    /// <summary>El equipo requerido, resuelto: identificador y nombre de cada pieza.</summary>
    IReadOnlyList<PositionEquipmentResponse> RequiredEquipment);

/// <summary>Una pieza del equipo que una posición requiere.</summary>
public sealed record PositionEquipmentResponse(Guid IdCatalogItem, string Name);

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

