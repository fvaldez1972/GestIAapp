namespace GestIA.Application.Scheduling;

public interface ISchedulingService
{
    Task<IReadOnlyList<ScheduleVersionResponse>> ListScheduleVersionsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken);

    Task<ScheduleVersionResponse> CreateScheduleVersionAsync(
        CreateScheduleVersionRequest request,
        CancellationToken cancellationToken);

    Task<ScheduleVersionResponse> UpdateScheduleVersionAsync(
        Guid idScheduleVersion,
        UpdateScheduleVersionRequest request,
        CancellationToken cancellationToken);

    Task<ScheduleVersionResponse> PublishScheduleVersionAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        CancellationToken cancellationToken);

    Task<GenerateScheduledShiftsResponse> GenerateScheduledShiftsAsync(
        GenerateScheduledShiftsRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ScheduledShiftResponse>> ListScheduledShiftsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        CancellationToken cancellationToken);

    Task<ScheduledShiftResponse> CreateScheduledShiftAsync(
        CreateScheduledShiftRequest request,
        CancellationToken cancellationToken);

    Task<ScheduledShiftResponse> UpdateScheduledShiftAsync(
        Guid idScheduledShift,
        UpdateScheduledShiftRequest request,
        CancellationToken cancellationToken);

    Task DeactivateScheduledShiftAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        Guid idScheduledShift,
        CancellationToken cancellationToken);
}
