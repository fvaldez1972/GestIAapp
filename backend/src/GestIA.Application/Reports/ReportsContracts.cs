namespace GestIA.Application.Reports;

public sealed record OperationsSummaryQuery(
    Guid IdOrganization,
    Guid? IdClient,
    Guid? IdService,
    DateOnly? FromDate,
    DateOnly? ToDate);

public sealed record OperationsSummaryResponse(
    int AttendanceRecords,
    int PresentAttendance,
    int LateAttendance,
    int AbsentAttendance,
    int ExcusedAttendance,
    int Incidents,
    int OpenIncidents,
    int CriticalIncidents,
    int CoverageRecords,
    int ConfirmedCoverages,
    int CompletedCoverages,
    int CoveredMinutes,
    int PendingApprovals,
    int ClosedOperationDays);

public sealed record OperationsServiceSummaryResponse(
    Guid IdClient,
    string ClientName,
    Guid IdService,
    string CodeService,
    string ServiceName,
    int AttendanceRecords,
    int PresentAttendance,
    int LateAttendance,
    int AbsentAttendance,
    int ExcusedAttendance,
    int Incidents,
    int OpenIncidents,
    int CriticalIncidents,
    int CoverageRecords,
    int ConfirmedCoverages,
    int CompletedCoverages,
    int CoveredMinutes,
    int PendingApprovals,
    int ClosedOperationDays);

public sealed record WorkforceEligibilityQuery(
    Guid IdOrganization,
    DateOnly ReferenceDate,
    string? Search);

public sealed record WorkforceEligibilityResponse(
    Guid IdEmployee,
    string CodeEmployee,
    string FullName,
    string? JobTitle,
    bool IsEligible,
    IReadOnlyList<string> Reasons,
    int ExpiredDocuments,
    int RejectedDocuments,
    int InvalidEvaluations);
