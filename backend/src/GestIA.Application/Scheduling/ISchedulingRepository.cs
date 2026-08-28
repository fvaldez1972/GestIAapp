using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Application.Scheduling;

public interface ISchedulingRepository
{
    Task<ServiceEntity?> GetServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken);

    Task<Position?> GetPositionAsync(Guid idService, Guid idPosition, CancellationToken cancellationToken);

    Task<Employee?> GetEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken);

    Task<ScheduleVersion?> GetScheduleVersionAsync(Guid idService, Guid idScheduleVersion, CancellationToken cancellationToken);

    Task<IReadOnlyList<ScheduleVersion>> ListScheduleVersionsAsync(Guid idService, CancellationToken cancellationToken);

    Task AddScheduleVersionAsync(ScheduleVersion scheduleVersion, CancellationToken cancellationToken);

    Task<IReadOnlyList<ShiftPattern>> ListShiftPatternsForServiceAsync(
        Guid idService,
        DateOnly periodStartDate,
        DateOnly periodEndDate,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ServiceAssignment>> ListAssignmentsForServiceAsync(
        Guid idService,
        DateOnly periodStartDate,
        DateOnly periodEndDate,
        CancellationToken cancellationToken);

    Task<ScheduledShift?> GetScheduledShiftAsync(Guid idScheduleVersion, Guid idScheduledShift, CancellationToken cancellationToken);

    Task<IReadOnlyList<ScheduledShift>> ListScheduledShiftsAsync(Guid idScheduleVersion, CancellationToken cancellationToken);

    Task<bool> HasEmployeeShiftOverlapAsync(
        Guid idEmployee,
        DateOnly shiftDate,
        TimeOnly startTime,
        int durationMinutes,
        Guid? excludedScheduledShiftId,
        CancellationToken cancellationToken);

    Task<bool> HasPublishedVersionOverlapAsync(
        Guid idService,
        DateOnly periodStartDate,
        DateOnly periodEndDate,
        Guid? excludedScheduleVersionId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ScheduleVersion>> ListOverlappingPublishedVersionsAsync(
        Guid idService,
        DateOnly periodStartDate,
        DateOnly periodEndDate,
        Guid excludedScheduleVersionId,
        CancellationToken cancellationToken);

    Task AddScheduledShiftAsync(ScheduledShift scheduledShift, CancellationToken cancellationToken);
}
