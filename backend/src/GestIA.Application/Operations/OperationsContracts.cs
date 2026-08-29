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
    string? Notes,
    string? CorrectionAuthorizationNotes,
    Guid? IdApprovalRequest);

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

public sealed record OperationEvidenceInput(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid? IdAttendanceRecord,
    Guid? IdIncident,
    Guid? IdCoverageRecord,
    OperationEvidenceType EvidenceType,
    string Title,
    string StorageReference,
    string? Notes);

public sealed record OperationEvidenceResponse(
    Guid IdOperationEvidence,
    Guid IdService,
    Guid? IdAttendanceRecord,
    Guid? IdIncident,
    Guid? IdCoverageRecord,
    OperationEvidenceType EvidenceType,
    string Title,
    string StorageReference,
    string? Notes,
    bool Active);

public sealed record ApprovalRequestQuery(
    Guid IdOrganization,
    Guid? IdService,
    ApprovalRequestStatus? Status);

public sealed record CreateApprovalRequestRequest(
    Guid IdOrganization,
    Guid IdService,
    ApprovalRequestType ApprovalType,
    string EntityType,
    Guid EntityId,
    string Reason,
    string? RequestedChangeSummary,
    string? AssignedApproverName,
    Guid? IdOperationEvidence);

public sealed record DecideApprovalRequestRequest(
    Guid IdOrganization,
    ApprovalRequestStatus Status,
    string? DecisionNotes);

public sealed record ApprovalRequestResponse(
    Guid IdApprovalRequest,
    Guid IdOrganization,
    Guid IdService,
    ApprovalRequestType ApprovalType,
    string EntityType,
    Guid EntityId,
    string Reason,
    string? RequestedChangeSummary,
    string? AssignedApproverName,
    Guid? IdOperationEvidence,
    ApprovalRequestStatus Status,
    DateTime RequestedAt,
    string RequestedByName,
    DateTime? DecidedAt,
    string? DecidedByName,
    string? DecisionNotes,
    bool Active);

public sealed record OperationDayClosureQuery(
    Guid IdOrganization,
    Guid? IdService,
    DateOnly? FromDate,
    DateOnly? ToDate);

public sealed record CloseOperationDayRequest(
    Guid IdOrganization,
    DateOnly OperationDate,
    string? Notes);

public sealed record ReopenOperationDayRequest(
    Guid IdOrganization,
    string Reason);

public sealed record OperationDayClosureResponse(
    Guid IdOperationDayClosure,
    Guid IdOrganization,
    Guid IdService,
    DateOnly OperationDate,
    int ExpectedShifts,
    int AttendanceRecords,
    int PendingAttendance,
    int OpenIncidents,
    int CoverageRecords,
    string? Notes,
    OperationDayClosureStatus Status,
    DateTime ClosedAt,
    string ClosedByName,
    DateTime? ReopenedAt,
    string? ReopenedByName,
    string? ReopenReason,
    bool Active);
