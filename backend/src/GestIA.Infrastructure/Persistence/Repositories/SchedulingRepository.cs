using GestIA.Application.Scheduling;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class SchedulingRepository(GestIaDbContext dbContext) : ISchedulingRepository
{
    public Task<ServiceEntity?> GetServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken) =>
        dbContext.Services.SingleOrDefaultAsync(
            service =>
                service.IdService == idService &&
                service.IdClient == idClient &&
                service.Client.IdOrganization == idOrganization,
            cancellationToken);

    public Task<Position?> GetPositionAsync(Guid idService, Guid idPosition, CancellationToken cancellationToken) =>
        dbContext.Positions.SingleOrDefaultAsync(
            position => position.IdService == idService && position.IdPosition == idPosition,
            cancellationToken);

    public Task<Employee?> GetEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken) =>
        dbContext.Employees.SingleOrDefaultAsync(
            employee => employee.IdOrganization == idOrganization && employee.IdEmployee == idEmployee,
            cancellationToken);

    public Task<ScheduleVersion?> GetScheduleVersionAsync(Guid idService, Guid idScheduleVersion, CancellationToken cancellationToken) =>
        dbContext.ScheduleVersions.SingleOrDefaultAsync(
            version => version.IdService == idService && version.IdScheduleVersion == idScheduleVersion,
            cancellationToken);

    public async Task<IReadOnlyList<ScheduleVersion>> ListScheduleVersionsAsync(Guid idService, CancellationToken cancellationToken) =>
        await dbContext.ScheduleVersions
            .AsNoTracking()
            .Where(version => version.IdService == idService)
            .OrderByDescending(version => version.PeriodStartDate)
            .ThenBy(version => version.Name)
            .ToArrayAsync(cancellationToken);

    public Task AddScheduleVersionAsync(ScheduleVersion scheduleVersion, CancellationToken cancellationToken) =>
        dbContext.ScheduleVersions.AddAsync(scheduleVersion, cancellationToken).AsTask();

    public Task<ScheduledShift?> GetScheduledShiftAsync(
        Guid idScheduleVersion,
        Guid idScheduledShift,
        CancellationToken cancellationToken) =>
        dbContext.ScheduledShifts
            .Include(shift => shift.Position)
            .Include(shift => shift.Employee)
            .SingleOrDefaultAsync(
                shift =>
                    shift.IdScheduleVersion == idScheduleVersion &&
                    shift.IdScheduledShift == idScheduledShift,
                cancellationToken);

    public async Task<IReadOnlyList<ScheduledShift>> ListScheduledShiftsAsync(
        Guid idScheduleVersion,
        CancellationToken cancellationToken) =>
        await dbContext.ScheduledShifts
            .AsNoTracking()
            .Include(shift => shift.Position)
            .Include(shift => shift.Employee)
            .Where(shift => shift.IdScheduleVersion == idScheduleVersion)
            .OrderBy(shift => shift.ShiftDate)
            .ThenBy(shift => shift.StartTime)
            .ThenBy(shift => shift.Employee.FullName)
            .ToArrayAsync(cancellationToken);

    public async Task<bool> HasEmployeeShiftOverlapAsync(
        Guid idEmployee,
        DateOnly shiftDate,
        TimeOnly startTime,
        int durationMinutes,
        Guid? excludedScheduledShiftId,
        CancellationToken cancellationToken)
    {
        var newStart = Minutes(startTime);
        var newEnd = newStart + durationMinutes;
        var existingShifts = await dbContext.ScheduledShifts
            .AsNoTracking()
            .Where(shift =>
                shift.IdEmployee == idEmployee &&
                shift.ShiftDate == shiftDate &&
                (!excludedScheduledShiftId.HasValue || shift.IdScheduledShift != excludedScheduledShiftId.Value))
            .Select(shift => new
            {
                shift.StartTime,
                shift.DurationMinutes
            })
            .ToArrayAsync(cancellationToken);

        return existingShifts.Any(shift =>
        {
            var existingStart = Minutes(shift.StartTime);
            var existingEnd = existingStart + shift.DurationMinutes;
            return newStart < existingEnd && existingStart < newEnd;
        });
    }

    public Task<bool> HasPublishedVersionOverlapAsync(
        Guid idService,
        DateOnly periodStartDate,
        DateOnly periodEndDate,
        Guid? excludedScheduleVersionId,
        CancellationToken cancellationToken) =>
        dbContext.ScheduleVersions.AnyAsync(
            version =>
                version.IdService == idService &&
                version.Status == ScheduleVersionStatus.Published &&
                (!excludedScheduleVersionId.HasValue || version.IdScheduleVersion != excludedScheduleVersionId.Value) &&
                version.PeriodStartDate <= periodEndDate &&
                version.PeriodEndDate >= periodStartDate,
            cancellationToken);

    public Task AddScheduledShiftAsync(ScheduledShift scheduledShift, CancellationToken cancellationToken) =>
        dbContext.ScheduledShifts.AddAsync(scheduledShift, cancellationToken).AsTask();

    private static int Minutes(TimeOnly time) => time.Hour * 60 + time.Minute;
}
