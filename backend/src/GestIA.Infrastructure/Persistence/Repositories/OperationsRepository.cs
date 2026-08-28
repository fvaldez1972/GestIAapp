using GestIA.Application.Operations;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class OperationsRepository(GestIaDbContext dbContext) : IOperationsRepository
{
    public Task<ServiceEntity?> GetServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken) =>
        dbContext.Services.SingleOrDefaultAsync(
            service =>
                service.IdService == idService &&
                service.IdClient == idClient &&
                service.Client.IdOrganization == idOrganization,
            cancellationToken);

    public Task<ScheduledShift?> GetScheduledShiftAsync(Guid idService, Guid idScheduledShift, CancellationToken cancellationToken) =>
        dbContext.ScheduledShifts
            .Include(shift => shift.ScheduleVersion)
            .Include(shift => shift.Employee)
            .SingleOrDefaultAsync(
                shift =>
                    shift.IdScheduledShift == idScheduledShift &&
                    shift.ScheduleVersion.IdService == idService,
                cancellationToken);

    public Task<Employee?> GetEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken) =>
        dbContext.Employees.SingleOrDefaultAsync(
            employee => employee.IdOrganization == idOrganization && employee.IdEmployee == idEmployee,
            cancellationToken);

    public Task<AttendanceRecord?> GetAttendanceByShiftAsync(Guid idScheduledShift, CancellationToken cancellationToken) =>
        dbContext.AttendanceRecords
            .Include(record => record.Employee)
            .SingleOrDefaultAsync(record => record.IdScheduledShift == idScheduledShift, cancellationToken);

    public async Task<IReadOnlyList<AttendanceRecord>> ListAttendanceAsync(
        Guid idService,
        DateOnly? attendanceDate,
        CancellationToken cancellationToken) =>
        await dbContext.AttendanceRecords
            .AsNoTracking()
            .Include(record => record.Employee)
            .Include(record => record.ScheduledShift)
                .ThenInclude(shift => shift.ScheduleVersion)
            .Where(record =>
                record.ScheduledShift.ScheduleVersion.IdService == idService &&
                (!attendanceDate.HasValue || record.AttendanceDate == attendanceDate.Value))
            .OrderBy(record => record.AttendanceDate)
            .ThenBy(record => record.Employee.FullName)
            .ToArrayAsync(cancellationToken);

    public Task AddAttendanceAsync(AttendanceRecord attendance, CancellationToken cancellationToken) =>
        dbContext.AttendanceRecords.AddAsync(attendance, cancellationToken).AsTask();

    public Task<Incident?> GetIncidentAsync(Guid idService, Guid idIncident, CancellationToken cancellationToken) =>
        dbContext.Incidents
            .Include(incident => incident.Employee)
            .SingleOrDefaultAsync(
                incident => incident.IdService == idService && incident.IdIncident == idIncident,
                cancellationToken);

    public async Task<IReadOnlyList<Incident>> ListIncidentsAsync(Guid idService, CancellationToken cancellationToken) =>
        await dbContext.Incidents
            .AsNoTracking()
            .Include(incident => incident.Employee)
            .Where(incident => incident.IdService == idService)
            .OrderByDescending(incident => incident.IncidentDate)
            .ThenBy(incident => incident.Severity)
            .ToArrayAsync(cancellationToken);

    public Task AddIncidentAsync(Incident incident, CancellationToken cancellationToken) =>
        dbContext.Incidents.AddAsync(incident, cancellationToken).AsTask();

    public Task<CoverageRecord?> GetCoverageAsync(Guid idService, Guid idCoverageRecord, CancellationToken cancellationToken) =>
        dbContext.CoverageRecords
            .Include(coverage => coverage.OriginalEmployee)
            .Include(coverage => coverage.ReplacementEmployee)
            .Include(coverage => coverage.ScheduledShift)
                .ThenInclude(shift => shift.ScheduleVersion)
            .SingleOrDefaultAsync(
                coverage =>
                    coverage.IdCoverageRecord == idCoverageRecord &&
                    coverage.ScheduledShift.ScheduleVersion.IdService == idService,
                cancellationToken);

    public async Task<IReadOnlyList<CoverageRecord>> ListCoveragesAsync(Guid idService, CancellationToken cancellationToken) =>
        await dbContext.CoverageRecords
            .AsNoTracking()
            .Include(coverage => coverage.OriginalEmployee)
            .Include(coverage => coverage.ReplacementEmployee)
            .Include(coverage => coverage.ScheduledShift)
                .ThenInclude(shift => shift.ScheduleVersion)
            .Where(coverage => coverage.ScheduledShift.ScheduleVersion.IdService == idService)
            .OrderByDescending(coverage => coverage.ScheduledShift.ShiftDate)
            .ThenBy(coverage => coverage.CoverageStartTime)
            .ToArrayAsync(cancellationToken);

    public Task AddCoverageAsync(CoverageRecord coverage, CancellationToken cancellationToken) =>
        dbContext.CoverageRecords.AddAsync(coverage, cancellationToken).AsTask();
}
