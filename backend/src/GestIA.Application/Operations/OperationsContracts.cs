using GestIA.Domain.Operations;

namespace GestIA.Application.Operations;

public sealed record AttendanceQuery(Guid IdOrganization, Guid IdClient, Guid IdService, DateOnly? Date);

public sealed record UpsertAttendanceRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdScheduledShift,
    AttendanceStatus Status,
    TimeOnly? ActualStartTime,
    TimeOnly? ActualEndTime,
    int MinutesLate,
    string? Notes);

public sealed record AttendanceRecordResponse(
    Guid IdAttendanceRecord,
    Guid IdScheduledShift,
    Guid IdEmployee,
    string EmployeeCode,
    string EmployeeName,
    DateOnly AttendanceDate,
    AttendanceStatus Status,
    TimeOnly? ActualStartTime,
    TimeOnly? ActualEndTime,
    int MinutesLate,
    string? Notes,
    bool Active);

public sealed record CreateIncidentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    string Description,
    string? ResolutionNotes);

public sealed record UpdateIncidentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    string Description,
    string? ResolutionNotes);

public sealed record IncidentResponse(
    Guid IdIncident,
    Guid IdService,
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    string? EmployeeCode,
    string? EmployeeName,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    string Description,
    string? ResolutionNotes,
    bool Active);

public sealed record CreateCoverageRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdScheduledShift,
    Guid IdReplacementEmployee,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    CoverageStatus Status,
    string? Notes);

public sealed record UpdateCoverageRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdReplacementEmployee,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    CoverageStatus Status,
    string? Notes);

public sealed record CoverageRecordResponse(
    Guid IdCoverageRecord,
    Guid IdScheduledShift,
    Guid IdOriginalEmployee,
    string OriginalEmployeeCode,
    string OriginalEmployeeName,
    Guid IdReplacementEmployee,
    string ReplacementEmployeeCode,
    string ReplacementEmployeeName,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    int DurationMinutes,
    CoverageStatus Status,
    string? Notes,
    bool Active);
