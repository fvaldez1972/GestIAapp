using GestIA.Application.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Scheduling;

public sealed class SchedulingService(
    ISchedulingRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : ISchedulingService
{
    public async Task<IReadOnlyList<ScheduleVersionResponse>> ListScheduleVersionsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var versions = await repository.ListScheduleVersionsAsync(idService, cancellationToken);
        return versions.Select(Map).ToArray();
    }

    public async Task<ScheduleVersionResponse> CreateScheduleVersionAsync(
        CreateScheduleVersionRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var profile = ValidateVersionProfile(request.Name, request.PeriodStartDate, request.PeriodEndDate, request.Notes);
        var version = ScheduleVersion.Create(
            request.IdService,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddScheduleVersionAsync(version, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(version);
    }

    public async Task<ScheduleVersionResponse> UpdateScheduleVersionAsync(
        Guid idScheduleVersion,
        UpdateScheduleVersionRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var version = await EnsureVersionAsync(request.IdService, idScheduleVersion, cancellationToken);
        var profile = ValidateVersionProfile(request.Name, request.PeriodStartDate, request.PeriodEndDate, request.Notes);

        version.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(version);
    }

    public async Task<ScheduleVersionResponse> PublishScheduleVersionAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var version = await EnsureVersionAsync(idService, idScheduleVersion, cancellationToken);
        var shifts = await repository.ListScheduledShiftsAsync(idScheduleVersion, cancellationToken);
        if (!shifts.Any())
        {
            throw new ResourceConflictException("No se puede publicar una planeación sin turnos programados.");
        }

        if (await repository.HasPublishedVersionOverlapAsync(
            idService,
            version.PeriodStartDate,
            version.PeriodEndDate,
            idScheduleVersion,
            cancellationToken))
        {
            throw new ResourceConflictException("Ya existe una planeación publicada que se traslapa con este periodo.");
        }

        version.Publish(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(version);
    }

    public async Task<IReadOnlyList<ScheduledShiftResponse>> ListScheduledShiftsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        await EnsureVersionAsync(idService, idScheduleVersion, cancellationToken);
        var shifts = await repository.ListScheduledShiftsAsync(idScheduleVersion, cancellationToken);
        return shifts.Select(Map).ToArray();
    }

    public async Task<ScheduledShiftResponse> CreateScheduledShiftAsync(
        CreateScheduledShiftRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var version = await EnsureVersionAsync(request.IdService, request.IdScheduleVersion, cancellationToken);
        version.EnsureDraft();
        await EnsurePositionAsync(request.IdService, request.IdPosition, cancellationToken);
        var employee = await EnsureActiveEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var profile = ValidateShiftProfile(
            request.IdPosition,
            employee.IdEmployee,
            request.ShiftDate,
            request.StartTime,
            request.EndTime,
            request.IsOvernight,
            request.Notes);
        EnsureShiftInsidePeriod(version, profile.ShiftDate);
        await EnsureNoShiftOverlapAsync(profile, null, cancellationToken);

        var shift = ScheduledShift.Create(
            request.IdScheduleVersion,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddScheduledShiftAsync(shift, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetScheduledShiftAsync(request.IdScheduleVersion, shift.IdScheduledShift, cancellationToken) ?? shift);
    }

    public async Task<ScheduledShiftResponse> UpdateScheduledShiftAsync(
        Guid idScheduledShift,
        UpdateScheduledShiftRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var version = await EnsureVersionAsync(request.IdService, request.IdScheduleVersion, cancellationToken);
        version.EnsureDraft();
        var shift = await EnsureShiftAsync(request.IdScheduleVersion, idScheduledShift, cancellationToken);
        await EnsurePositionAsync(request.IdService, request.IdPosition, cancellationToken);
        var employee = await EnsureActiveEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var profile = ValidateShiftProfile(
            request.IdPosition,
            employee.IdEmployee,
            request.ShiftDate,
            request.StartTime,
            request.EndTime,
            request.IsOvernight,
            request.Notes);
        EnsureShiftInsidePeriod(version, profile.ShiftDate);
        await EnsureNoShiftOverlapAsync(profile, idScheduledShift, cancellationToken);

        shift.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetScheduledShiftAsync(request.IdScheduleVersion, idScheduledShift, cancellationToken) ?? shift);
    }

    public async Task DeactivateScheduledShiftAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        Guid idScheduledShift,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var version = await EnsureVersionAsync(idService, idScheduleVersion, cancellationToken);
        version.EnsureDraft();
        var shift = await EnsureShiftAsync(idScheduleVersion, idScheduledShift, cancellationToken);
        shift.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (idOrganization == Guid.Empty)
        {
            errors[nameof(idOrganization)] = ["La organización es obligatoria."];
        }

        if (idClient == Guid.Empty)
        {
            errors[nameof(idClient)] = ["El cliente es obligatorio."];
        }

        if (idService == Guid.Empty)
        {
            errors[nameof(idService)] = ["El servicio es obligatorio."];
        }

        InputValidation.ThrowIfInvalid(errors);
        if (await repository.GetServiceAsync(idOrganization, idClient, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
        }
    }

    private async Task<ScheduleVersion> EnsureVersionAsync(Guid idService, Guid idScheduleVersion, CancellationToken cancellationToken) =>
        await repository.GetScheduleVersionAsync(idService, idScheduleVersion, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la versión de planeación solicitada.");

    private async Task<ScheduledShift> EnsureShiftAsync(Guid idScheduleVersion, Guid idScheduledShift, CancellationToken cancellationToken) =>
        await repository.GetScheduledShiftAsync(idScheduleVersion, idScheduledShift, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el turno programado solicitado.");

    private async Task EnsurePositionAsync(Guid idService, Guid idPosition, CancellationToken cancellationToken)
    {
        if (idPosition == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idPosition)] = ["La posición es obligatoria."]
            });
        }

        if (await repository.GetPositionAsync(idService, idPosition, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró la posición solicitada.");
        }
    }

    private async Task<Employee> EnsureActiveEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken)
    {
        if (idEmployee == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idEmployee)] = ["El empleado es obligatorio."]
            });
        }

        var employee = await repository.GetEmployeeAsync(idOrganization, idEmployee, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el empleado solicitado.");
        if (employee.Status != EmployeeStatus.Active)
        {
            throw new ResourceConflictException("Solo se pueden programar empleados activos.");
        }

        return employee;
    }

    private async Task EnsureNoShiftOverlapAsync(
        ScheduledShiftProfile profile,
        Guid? excludedScheduledShiftId,
        CancellationToken cancellationToken)
    {
        var duration = DurationMinutes(profile.StartTime, profile.EndTime, profile.IsOvernight);
        if (await repository.HasEmployeeShiftOverlapAsync(
            profile.IdEmployee,
            profile.ShiftDate,
            profile.StartTime,
            duration,
            excludedScheduledShiftId,
            cancellationToken))
        {
            throw new ResourceConflictException("El empleado ya tiene un turno programado que se traslapa.");
        }
    }

    private static ScheduleVersionProfile ValidateVersionProfile(
        string name,
        DateOnly periodStartDate,
        DateOnly periodEndDate,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        var normalizedName = InputValidation.Required(name, nameof(name), 150, errors);
        var normalizedNotes = InputValidation.Optional(notes, nameof(notes), 1000, errors);
        if (periodStartDate == default)
        {
            errors[nameof(periodStartDate)] = ["La fecha inicial es obligatoria."];
        }

        if (periodEndDate == default)
        {
            errors[nameof(periodEndDate)] = ["La fecha final es obligatoria."];
        }

        if (periodEndDate < periodStartDate)
        {
            errors[nameof(periodEndDate)] = ["La fecha final no puede ser menor que la inicial."];
        }

        InputValidation.ThrowIfInvalid(errors);
        return new ScheduleVersionProfile(normalizedName, periodStartDate, periodEndDate, normalizedNotes);
    }

    private static ScheduledShiftProfile ValidateShiftProfile(
        Guid idPosition,
        Guid idEmployee,
        DateOnly shiftDate,
        TimeOnly startTime,
        TimeOnly endTime,
        bool isOvernight,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        if (shiftDate == default)
        {
            errors[nameof(shiftDate)] = ["La fecha del turno es obligatoria."];
        }

        var duration = DurationMinutes(startTime, endTime, isOvernight);
        if (duration <= 0 || duration > 24 * 60)
        {
            errors[nameof(endTime)] = ["La duración del turno no es válida."];
        }

        var normalizedNotes = InputValidation.Optional(notes, nameof(notes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);
        return new ScheduledShiftProfile(idPosition, idEmployee, shiftDate, startTime, endTime, isOvernight, normalizedNotes);
    }

    private static void EnsureShiftInsidePeriod(ScheduleVersion version, DateOnly shiftDate)
    {
        if (shiftDate < version.PeriodStartDate || shiftDate > version.PeriodEndDate)
        {
            throw new ResourceConflictException("El turno debe quedar dentro del periodo de la planeación.");
        }
    }

    private static ScheduleVersionResponse Map(ScheduleVersion version) =>
        new(
            version.IdScheduleVersion,
            version.IdService,
            version.Name,
            version.PeriodStartDate,
            version.PeriodEndDate,
            version.Status,
            version.PublishedAt,
            version.PublishedByName,
            version.Notes,
            version.Active);

    private static ScheduledShiftResponse Map(ScheduledShift shift) =>
        new(
            shift.IdScheduledShift,
            shift.IdScheduleVersion,
            shift.IdPosition,
            shift.Position.CodePosition,
            shift.Position.Name,
            shift.IdEmployee,
            shift.Employee.CodeEmployee,
            shift.Employee.FullName,
            shift.ShiftDate,
            shift.StartTime,
            shift.EndTime,
            shift.IsOvernight,
            shift.DurationMinutes,
            shift.Notes,
            shift.Active);

    private static int DurationMinutes(TimeOnly startTime, TimeOnly endTime, bool isOvernight)
    {
        var startMinutes = startTime.Hour * 60 + startTime.Minute;
        var endMinutes = endTime.Hour * 60 + endTime.Minute;
        return isOvernight
            ? (24 * 60 - startMinutes) + endMinutes
            : endMinutes - startMinutes;
    }
}
