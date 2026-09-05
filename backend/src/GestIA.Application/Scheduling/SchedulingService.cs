using GestIA.Application.Common;
using GestIA.Application.Catalogs;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Scheduling;

public sealed class SchedulingService(
    ISchedulingRepository repository,
    ICatalogService catalogService,
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
            request.IdOrganization,
            request.IdService,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddScheduleVersionAsync(version, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(version);
    }

    public Task<ScheduleVersionResponse> UpdateScheduleVersionAsync(
        Guid idScheduleVersion,
        UpdateScheduleVersionRequest request,
        CancellationToken cancellationToken) =>
        repository.ExecuteAtomicAsync(token => UpdateScheduleVersionCoreAsync(idScheduleVersion, request, token), cancellationToken);

    private async Task<ScheduleVersionResponse> UpdateScheduleVersionCoreAsync(
        Guid idScheduleVersion,
        UpdateScheduleVersionRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var version = await EnsureVersionAsync(request.IdService, idScheduleVersion, cancellationToken);
        var profile = ValidateVersionProfile(request.Name, request.PeriodStartDate, request.PeriodEndDate, request.Notes);

        var shifts = await repository.ListScheduledShiftsAsync(idScheduleVersion, cancellationToken);
        if (shifts.Any(shift => shift.ShiftDate < profile.PeriodStartDate || shift.ShiftDate > profile.PeriodEndDate))
        {
            throw new ResourceConflictException("El periodo debe incluir todos los turnos existentes.");
        }

        version.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(version);
    }

    public Task<ScheduleVersionResponse> PublishScheduleVersionAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        CancellationToken cancellationToken) =>
        repository.ExecuteAtomicAsync(token => PublishScheduleVersionCoreAsync(idOrganization, idClient, idService, idScheduleVersion, token), cancellationToken);

    private async Task<ScheduleVersionResponse> PublishScheduleVersionCoreAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var version = await EnsureVersionAsync(idService, idScheduleVersion, cancellationToken);
        version.EnsureDraft();
        var shifts = await repository.ListScheduledShiftsAsync(idScheduleVersion, cancellationToken);
        if (!shifts.Any())
        {
            throw new ResourceConflictException("No se puede publicar una planeación sin turnos programados.");
        }

        var coverageGaps = await FindCoverageGapsAsync(idService, version, shifts, cancellationToken);
        if (coverageGaps.Length > 0)
        {
            throw new ResourceConflictException(
                $"No se puede publicar la planeación porque hay posiciones sin cubrir. {string.Join(" ", coverageGaps.Take(5))}");
        }

        foreach (var shift in shifts)
        {
            await EnsureActiveEmployeeAsync(idOrganization, shift.IdEmployee, cancellationToken);
            await EnsurePositionAsync(idService, shift.IdPosition, cancellationToken);
            await EnsureNoShiftOverlapAsync(
                idOrganization, idScheduleVersion,
                new ScheduledShiftProfile(shift.IdPosition, shift.IdEmployee, shift.ShiftDate,
                    shift.StartTime, shift.EndTime, shift.IsOvernight, shift.Notes),
                shift.IdScheduledShift, cancellationToken);
            if (shift.ShiftDate < version.PeriodStartDate || shift.ShiftDate > version.PeriodEndDate)
            {
                throw new ResourceConflictException("Hay turnos fuera del periodo de la planeación.");
            }

            var eligibility = await catalogService.CheckEligibilityAsync(
                new EligibilityCheckQuery(idOrganization, shift.IdEmployee, idClient, idService, shift.IdPosition, shift.ShiftDate),
                cancellationToken);
            if (!eligibility.IsEligible)
            {
                var reasons = eligibility.Reasons.Where(reason => reason.IsBlocking && !reason.Passed).Select(reason => reason.Message);
                throw new ResourceConflictException($"No se puede publicar: {eligibility.EmployeeName}. {string.Join(" ", reasons)}");
            }
        }

        var overlappingPublishedVersions = await repository.ListOverlappingPublishedVersionsAsync(
            idService,
            version.PeriodStartDate,
            version.PeriodEndDate,
            idScheduleVersion,
            cancellationToken);

        foreach (var publishedVersion in overlappingPublishedVersions)
        {
            if (publishedVersion.PeriodStartDate < version.PeriodStartDate ||
                publishedVersion.PeriodEndDate > version.PeriodEndDate)
            {
                throw new ResourceConflictException("La nueva version debe cubrir todo el periodo publicado que reemplaza.");
            }

            if (await repository.HasOperationalActivityAsync(publishedVersion.IdScheduleVersion, cancellationToken))
            {
                throw new ResourceConflictException("No se puede reemplazar una planeacion con actividad operativa registrada.");
            }

            publishedVersion.MarkSuperseded(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        }

        version.Publish(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(version);
    }

    public Task<GenerateScheduledShiftsResponse> GenerateScheduledShiftsAsync(
        GenerateScheduledShiftsRequest request,
        CancellationToken cancellationToken) =>
        repository.ExecuteAtomicAsync(token => GenerateScheduledShiftsCoreAsync(request, token), cancellationToken);

    private async Task<GenerateScheduledShiftsResponse> GenerateScheduledShiftsCoreAsync(
        GenerateScheduledShiftsRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var version = await EnsureVersionAsync(request.IdService, request.IdScheduleVersion, cancellationToken);
        version.EnsureDraft();

        var patterns = await repository.ListShiftPatternsForServiceAsync(
            request.IdService,
            version.PeriodStartDate,
            version.PeriodEndDate,
            cancellationToken);
        if (!patterns.Any())
        {
            throw new ResourceConflictException("No hay patrones de turno vigentes para generar la planeación.");
        }

        var patternsWithoutSegments = patterns
            .Where(pattern => !pattern.Segments.Any(segment => segment.Active))
            .Select(pattern => pattern.CodeShiftPattern)
            .Take(5)
            .ToArray();
        if (patternsWithoutSegments.Length > 0)
        {
            throw new ResourceConflictException(
                $"No se puede generar la planeación porque hay patrones sin segmentos activos: {string.Join(", ", patternsWithoutSegments)}.");
        }

        var assignments = await repository.ListAssignmentsForServiceAsync(
            request.IdService,
            version.PeriodStartDate,
            version.PeriodEndDate,
            cancellationToken);

        var warnings = new List<string>();
        var existingShifts = (await repository.ListScheduledShiftsAsync(request.IdScheduleVersion, cancellationToken)).ToList();
        var createdShifts = 0;
        var skippedShifts = 0;
        var missingAssignments = 0;

        for (var shiftDate = version.PeriodStartDate; shiftDate <= version.PeriodEndDate; shiftDate = shiftDate.AddDays(1))
        {
            var patternsForDate = patterns
                .Where(pattern =>
                    pattern.EffectiveFromDate <= shiftDate &&
                    (pattern.EffectiveToDate == null || pattern.EffectiveToDate >= shiftDate))
                .GroupBy(pattern => pattern.IdPosition)
                .Select(group => group.OrderByDescending(pattern => pattern.EffectiveFromDate).First());

            foreach (var pattern in patternsForDate)
            {
                var segments = pattern.Segments
                    .Where(segment => segment.DayOfWeek == shiftDate.DayOfWeek)
                    .OrderBy(segment => segment.StartTime)
                    .ToArray();

                foreach (var segment in segments)
                {
                    var candidates = assignments
                        .Where(assignment =>
                            assignment.IdPosition == pattern.IdPosition &&
                            assignment.StartDate <= shiftDate &&
                            (assignment.EndDate == null || assignment.EndDate >= shiftDate))
                        .GroupBy(assignment => assignment.IdEmployee)
                        .Select(group => group
                            .OrderByDescending(assignment => assignment.IsPrimary)
                            .ThenBy(assignment => assignment.AssignmentType)
                            .First())
                        .OrderByDescending(assignment => assignment.IsPrimary)
                        .ThenBy(assignment => assignment.AssignmentType)
                        .ThenBy(assignment => assignment.Employee.FullName)
                        .ToArray();

                    var assignedForSegment = existingShifts.Count(shift =>
                        shift.IdPosition == pattern.IdPosition && shift.ShiftDate == shiftDate &&
                        shift.StartTime == segment.StartTime && shift.EndTime == segment.EndTime &&
                        shift.IsOvernight == segment.IsOvernight);
                    if (assignedForSegment > 0 && !request.SkipExisting)
                    {
                        throw new ResourceConflictException("Ya existen turnos para el segmento. Activa la opcion de omitir existentes.");
                    }
                    skippedShifts += assignedForSegment;
                    foreach (var assignment in candidates)
                    {
                        if (assignedForSegment >= segment.RequiredWorkerCount)
                        {
                            break;
                        }

                        var profile = new ScheduledShiftProfile(
                            pattern.IdPosition,
                            assignment.IdEmployee,
                            shiftDate,
                            segment.StartTime,
                            segment.EndTime,
                            segment.IsOvernight,
                            $"Generado desde patrón {pattern.CodeShiftPattern}");

                        var duration = DurationMinutes(profile.StartTime, profile.EndTime, profile.IsOvernight);
                        var hasOverlap = await repository.HasEmployeeShiftOverlapAsync(
                            request.IdOrganization,
                            request.IdScheduleVersion,
                            profile.IdEmployee,
                            profile.ShiftDate,
                            profile.StartTime,
                            duration,
                            null,
                            cancellationToken);

                        if (hasOverlap)
                        {
                            if (!request.SkipExisting)
                            {
                                throw new ResourceConflictException(
                                    "Ya existen turnos que se traslapan. Activa la opción de omitir existentes para completar sólo los faltantes.");
                            }

                            skippedShifts++;
                            continue;
                        }

                        var shift = ScheduledShift.Create(
                            request.IdOrganization,
                            request.IdScheduleVersion,
                            profile,
                            actorContext.ActorId,
                            actorContext.ActorName,
                            clock.UtcNow);

                        await repository.AddScheduledShiftAsync(shift, cancellationToken);
                        existingShifts.Add(shift);
                        assignedForSegment++;
                        createdShifts++;
                    }

                    if (assignedForSegment < segment.RequiredWorkerCount)
                    {
                        var missing = segment.RequiredWorkerCount - assignedForSegment;
                        missingAssignments += missing;
                        if (warnings.Count < 25)
                        {
                            warnings.Add(
                                $"{shiftDate:yyyy-MM-dd} · {pattern.Position.CodePosition}: faltan {missing} elemento(s) para el horario {segment.StartTime:HH\\:mm}-{segment.EndTime:HH\\:mm}.");
                        }
                    }
                }
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new GenerateScheduledShiftsResponse(createdShifts, skippedShifts, missingAssignments, warnings);
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

    public Task<ScheduledShiftResponse> CreateScheduledShiftAsync(
        CreateScheduledShiftRequest request,
        CancellationToken cancellationToken) =>
        repository.ExecuteAtomicAsync(token => CreateScheduledShiftCoreAsync(request, token), cancellationToken);

    private async Task<ScheduledShiftResponse> CreateScheduledShiftCoreAsync(
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
        await EnsureNoShiftOverlapAsync(request.IdOrganization, request.IdScheduleVersion, profile, null, cancellationToken);

        var shift = ScheduledShift.Create(
            request.IdOrganization,
            request.IdScheduleVersion,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddScheduledShiftAsync(shift, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetScheduledShiftAsync(request.IdScheduleVersion, shift.IdScheduledShift, cancellationToken) ?? shift);
    }

    public Task<ScheduledShiftResponse> UpdateScheduledShiftAsync(
        Guid idScheduledShift,
        UpdateScheduledShiftRequest request,
        CancellationToken cancellationToken) =>
        repository.ExecuteAtomicAsync(token => UpdateScheduledShiftCoreAsync(idScheduledShift, request, token), cancellationToken);

    private async Task<ScheduledShiftResponse> UpdateScheduledShiftCoreAsync(
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
        await EnsureNoShiftOverlapAsync(request.IdOrganization, request.IdScheduleVersion, profile, idScheduledShift, cancellationToken);

        shift.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetScheduledShiftAsync(request.IdScheduleVersion, idScheduledShift, cancellationToken) ?? shift);
    }

    public Task DeactivateScheduledShiftAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idScheduleVersion,
        Guid idScheduledShift,
        CancellationToken cancellationToken) =>
        repository.ExecuteAtomicAsync(async token =>
        {
            await DeactivateScheduledShiftCoreAsync(idOrganization, idClient, idService, idScheduleVersion, idScheduledShift, token);
            return true;
        }, cancellationToken);

    private async Task DeactivateScheduledShiftCoreAsync(
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
        Guid idOrganization,
        Guid idScheduleVersion,
        ScheduledShiftProfile profile,
        Guid? excludedScheduledShiftId,
        CancellationToken cancellationToken)
    {
        var duration = DurationMinutes(profile.StartTime, profile.EndTime, profile.IsOvernight);
        if (await repository.HasEmployeeShiftOverlapAsync(
            idOrganization,
            idScheduleVersion,
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

    private async Task<string[]> FindCoverageGapsAsync(
        Guid idService,
        ScheduleVersion version,
        IReadOnlyList<ScheduledShift> shifts,
        CancellationToken cancellationToken)
    {
        var patterns = await repository.ListShiftPatternsForServiceAsync(
            idService,
            version.PeriodStartDate,
            version.PeriodEndDate,
            cancellationToken);

        if (!patterns.Any())
        {
            return [];
        }

        var patternsWithoutSegments = patterns
            .Where(pattern => !pattern.Segments.Any(segment => segment.Active))
            .Select(pattern => pattern.CodeShiftPattern)
            .Take(5)
            .ToArray();
        if (patternsWithoutSegments.Length > 0)
        {
            return patternsWithoutSegments
                .Select(patternCode => $"Patrón {patternCode}: falta al menos un segmento activo.")
                .ToArray();
        }

        var gaps = new List<string>();
        for (var shiftDate = version.PeriodStartDate; shiftDate <= version.PeriodEndDate; shiftDate = shiftDate.AddDays(1))
        {
            var patternsForDate = patterns
                .Where(pattern =>
                    pattern.EffectiveFromDate <= shiftDate &&
                    (pattern.EffectiveToDate == null || pattern.EffectiveToDate >= shiftDate))
                .GroupBy(pattern => pattern.IdPosition)
                .Select(group => group.OrderByDescending(pattern => pattern.EffectiveFromDate).First());

            foreach (var pattern in patternsForDate)
            {
                var segments = pattern.Segments
                    .Where(segment => segment.DayOfWeek == shiftDate.DayOfWeek)
                    .OrderBy(segment => segment.StartTime);

                foreach (var segment in segments)
                {
                    var assigned = shifts.Count(shift =>
                        shift.IdPosition == pattern.IdPosition &&
                        shift.ShiftDate == shiftDate &&
                        shift.StartTime == segment.StartTime &&
                        shift.EndTime == segment.EndTime &&
                        shift.IsOvernight == segment.IsOvernight);

                    if (assigned < segment.RequiredWorkerCount)
                    {
                        gaps.Add(
                            $"{shiftDate:yyyy-MM-dd} · {pattern.Position.CodePosition}: faltan {segment.RequiredWorkerCount - assigned} elemento(s) en {segment.StartTime:HH\\:mm}-{segment.EndTime:HH\\:mm}.");
                    }
                }
            }
        }

        return gaps.ToArray();
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
