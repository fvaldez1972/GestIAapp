using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Application.Operations;

public interface IOperationsRepository
{
    Task<ServiceEntity?> GetServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken);

    Task<ScheduledShift?> GetScheduledShiftAsync(Guid idService, Guid idScheduledShift, CancellationToken cancellationToken);

    Task<Employee?> GetEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken);

    Task<AttendanceRecord?> GetAttendanceByShiftAsync(Guid idScheduledShift, CancellationToken cancellationToken);

    Task<IReadOnlyList<AttendanceRecord>> ListAttendanceAsync(Guid idService, DateOnly? attendanceDate, CancellationToken cancellationToken);

    Task AddAttendanceAsync(AttendanceRecord attendance, CancellationToken cancellationToken);

    Task<Incident?> GetIncidentAsync(Guid idService, Guid idIncident, CancellationToken cancellationToken);

    Task<IReadOnlyList<Incident>> ListIncidentsAsync(Guid idService, CancellationToken cancellationToken);

    Task AddIncidentAsync(Incident incident, CancellationToken cancellationToken);

    Task<CoverageRecord?> GetCoverageAsync(Guid idService, Guid idCoverageRecord, CancellationToken cancellationToken);

    Task<IReadOnlyList<CoverageRecord>> ListCoveragesAsync(Guid idService, CancellationToken cancellationToken);

    Task AddCoverageAsync(CoverageRecord coverage, CancellationToken cancellationToken);
}
