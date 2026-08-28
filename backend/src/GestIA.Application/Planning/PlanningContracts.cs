using GestIA.Domain.Planning;

namespace GestIA.Application.Planning;

public sealed record CreatePositionRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    string CodePosition,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes);

public sealed record UpdatePositionRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes);

public sealed record PositionResponse(
    Guid IdPosition,
    Guid IdService,
    string CodePosition,
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes,
    bool Active);

public sealed record CreateShiftPatternRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdPosition,
    string CodeShiftPattern,
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

