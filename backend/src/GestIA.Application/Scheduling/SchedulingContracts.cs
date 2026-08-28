using GestIA.Domain.Planning;

namespace GestIA.Application.Scheduling;

public sealed record CreateScheduleVersionRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    string Name,
    DateOnly PeriodStartDate,
    DateOnly PeriodEndDate,
    string? Notes);

public sealed record UpdateScheduleVersionRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    string Name,
    DateOnly PeriodStartDate,
    DateOnly PeriodEndDate,
    string? Notes);

public sealed record ScheduleVersionResponse(
    Guid IdScheduleVersion,
    Guid IdService,
    string Name,
    DateOnly PeriodStartDate,
    DateOnly PeriodEndDate,
    ScheduleVersionStatus Status,
    DateTime? PublishedAt,
    string? PublishedByName,
    string? Notes,
    bool Active);

public sealed record CreateScheduledShiftRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdScheduleVersion,
    Guid IdPosition,
    Guid IdEmployee,
    DateOnly ShiftDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    string? Notes);

public sealed record UpdateScheduledShiftRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdScheduleVersion,
    Guid IdPosition,
    Guid IdEmployee,
    DateOnly ShiftDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    string? Notes);

public sealed record ScheduledShiftResponse(
    Guid IdScheduledShift,
    Guid IdScheduleVersion,
    Guid IdPosition,
    string PositionCode,
    string PositionName,
    Guid IdEmployee,
    string EmployeeCode,
    string EmployeeName,
    DateOnly ShiftDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsOvernight,
    int DurationMinutes,
    string? Notes,
    bool Active);
