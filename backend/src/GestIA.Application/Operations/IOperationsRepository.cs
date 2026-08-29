using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Application.Operations;

public interface IOperationsRepository
{
    Task<ServiceEntity?> GetServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken);

    Task<ServiceEntity?> GetServiceAsync(Guid idOrganization, Guid idService, CancellationToken cancellationToken);

    Task<ScheduledShift?> GetScheduledShiftAsync(Guid idService, Guid idScheduledShift, CancellationToken cancellationToken);

    Task<Employee?> GetEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken);

    Task<AttendanceRecord?> GetAttendanceByShiftAsync(Guid idScheduledShift, CancellationToken cancellationToken);

    Task<IReadOnlyList<AttendanceRecord>> ListAttendanceAsync(Guid idService, DateOnly? attendanceDate, CancellationToken cancellationToken);

    Task AddAttendanceAsync(AttendanceRecord attendance, CancellationToken cancellationToken);

    Task<IReadOnlyList<ScheduledShift>> ListScheduledShiftsAsync(Guid idService, DateOnly shiftDate, CancellationToken cancellationToken);

    Task<Incident?> GetIncidentAsync(Guid idService, Guid idIncident, CancellationToken cancellationToken);

    Task<IReadOnlyList<Incident>> ListIncidentsAsync(Guid idService, CancellationToken cancellationToken);

    Task AddIncidentAsync(Incident incident, CancellationToken cancellationToken);

    Task<CoverageRecord?> GetCoverageAsync(Guid idService, Guid idCoverageRecord, CancellationToken cancellationToken);

    Task<IReadOnlyList<CoverageRecord>> ListCoveragesAsync(Guid idService, CancellationToken cancellationToken);

    Task AddCoverageAsync(CoverageRecord coverage, CancellationToken cancellationToken);

    Task<bool> AttendanceBelongsToServiceAsync(Guid idService, Guid idAttendanceRecord, CancellationToken cancellationToken);

    Task<bool> IncidentBelongsToServiceAsync(Guid idService, Guid idIncident, CancellationToken cancellationToken);

    Task<bool> CoverageBelongsToServiceAsync(Guid idService, Guid idCoverageRecord, CancellationToken cancellationToken);

    Task<OperationEvidence?> GetEvidenceAsync(Guid idService, Guid idOperationEvidence, CancellationToken cancellationToken);

    Task<IReadOnlyList<OperationEvidence>> ListEvidencesAsync(
        Guid idService,
        Guid? relatedRecordId,
        CancellationToken cancellationToken);

    Task AddEvidenceAsync(OperationEvidence evidence, CancellationToken cancellationToken);

    Task<IReadOnlyList<ApprovalRequest>> ListApprovalRequestsAsync(
        Guid idOrganization,
        Guid? idService,
        ApprovalRequestStatus? status,
        CancellationToken cancellationToken);

    Task<ApprovalRequest?> GetApprovalRequestAsync(Guid idOrganization, Guid idApprovalRequest, CancellationToken cancellationToken);

    Task AddApprovalRequestAsync(ApprovalRequest approvalRequest, CancellationToken cancellationToken);

    Task<IReadOnlyList<OperationDayClosure>> ListDayClosuresAsync(
        Guid idOrganization,
        Guid? idService,
        DateOnly? fromDate,
        DateOnly? toDate,
        CancellationToken cancellationToken);

    Task<OperationDayClosure?> GetDayClosureAsync(Guid idService, DateOnly operationDate, CancellationToken cancellationToken);

    Task<OperationDayClosure?> GetDayClosureAsync(Guid idService, Guid idOperationDayClosure, CancellationToken cancellationToken);

    Task AddDayClosureAsync(OperationDayClosure closure, CancellationToken cancellationToken);
}
