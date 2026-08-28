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
    int CoveredMinutes);
