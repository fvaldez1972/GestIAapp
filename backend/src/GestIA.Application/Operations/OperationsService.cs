using GestIA.Application.Common;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Operations;

public sealed class OperationsService(
    IOperationsRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IOperationsService
{
    public async Task<IReadOnlyList<AttendanceRecordResponse>> ListAttendanceAsync(
        AttendanceQuery query,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(query.IdOrganization, query.IdClient, query.IdService, cancellationToken);
        var records = await repository.ListAttendanceAsync(query.IdService, query.Date, cancellationToken);
        return records.Select(Map).ToArray();
    }

    public async Task<AttendanceRecordResponse> UpsertAttendanceAsync(
        UpsertAttendanceRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var shift = await EnsureScheduledShiftAsync(request.IdService, request.IdScheduledShift, cancellationToken);
        EnsurePublished(shift);
        var profile = ValidateAttendanceProfile(
            request.Status,
            request.ActualStartTime,
            request.ActualEndTime,
            request.MinutesLate,
            request.Notes);

        var existing = await repository.GetAttendanceByShiftAsync(request.IdScheduledShift, cancellationToken);
        if (existing is null)
        {
            existing = AttendanceRecord.Create(
                shift.IdScheduledShift,
                shift.IdEmployee,
                shift.ShiftDate,
                profile,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);
            await repository.AddAttendanceAsync(existing, cancellationToken);
        }
        else
        {
            var authorizationErrors = new Dictionary<string, string[]>();
            var correctionAuthorizationNotes = InputValidation.Optional(
                request.CorrectionAuthorizationNotes,
                nameof(request.CorrectionAuthorizationNotes),
                1000,
                authorizationErrors);
            InputValidation.ThrowIfInvalid(authorizationErrors);

            if (AttendanceChanged(existing, profile) && string.IsNullOrWhiteSpace(correctionAuthorizationNotes))
            {
                throw new RequestValidationException(new Dictionary<string, string[]>
                {
                    [nameof(request.CorrectionAuthorizationNotes)] =
                        ["Para corregir una asistencia ya capturada necesitas indicar la autorización o motivo de corrección."]
                });
            }

            existing.UpdateProfile(
                profile with
                {
                    Notes = BuildAttendanceCorrectionNotes(profile.Notes, correctionAuthorizationNotes)
                },
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetAttendanceByShiftAsync(request.IdScheduledShift, cancellationToken) ?? existing);
    }

    public async Task<IReadOnlyList<IncidentResponse>> ListIncidentsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var incidents = await repository.ListIncidentsAsync(idService, cancellationToken);
        return incidents.Select(Map).ToArray();
    }

    public async Task<IncidentResponse> CreateIncidentAsync(
        CreateIncidentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        await EnsureOptionalShiftAndEmployeeAsync(
            request.IdOrganization,
            request.IdService,
            request.IdScheduledShift,
            request.IdEmployee,
            cancellationToken);
        var profile = ValidateIncidentProfile(
            request.IdScheduledShift,
            request.IdEmployee,
            request.IncidentDate,
            request.IncidentType,
            request.Severity,
            request.Status,
            request.Description,
            request.ResolutionNotes);
        var incident = Incident.Create(
            request.IdService,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);
        await repository.AddIncidentAsync(incident, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetIncidentAsync(request.IdService, incident.IdIncident, cancellationToken) ?? incident);
    }

    public async Task<IncidentResponse> UpdateIncidentAsync(
        Guid idIncident,
        UpdateIncidentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        await EnsureOptionalShiftAndEmployeeAsync(
            request.IdOrganization,
            request.IdService,
            request.IdScheduledShift,
            request.IdEmployee,
            cancellationToken);
        var incident = await repository.GetIncidentAsync(request.IdService, idIncident, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la incidencia solicitada.");
        var profile = ValidateIncidentProfile(
            request.IdScheduledShift,
            request.IdEmployee,
            request.IncidentDate,
            request.IncidentType,
            request.Severity,
            request.Status,
            request.Description,
            request.ResolutionNotes);
        incident.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetIncidentAsync(request.IdService, idIncident, cancellationToken) ?? incident);
    }

    public async Task<IReadOnlyList<CoverageRecordResponse>> ListCoveragesAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var coverages = await repository.ListCoveragesAsync(idService, cancellationToken);
        return coverages.Select(Map).ToArray();
    }

    public async Task<CoverageRecordResponse> CreateCoverageAsync(
        CreateCoverageRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var shift = await EnsureScheduledShiftAsync(request.IdService, request.IdScheduledShift, cancellationToken);
        EnsurePublished(shift);
        var replacement = await EnsureActiveEmployeeAsync(request.IdOrganization, request.IdReplacementEmployee, cancellationToken);
        if (replacement.IdEmployee == shift.IdEmployee)
        {
            throw new ResourceConflictException("El sustituto no puede ser el mismo empleado original.");
        }

        var profile = ValidateCoverageProfile(
            replacement.IdEmployee,
            request.CoverageStartTime,
            request.CoverageEndTime,
            request.IsOvernight,
            request.Status,
            request.Notes);
        var coverage = CoverageRecord.Create(
            shift.IdScheduledShift,
            shift.IdEmployee,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);
        await repository.AddCoverageAsync(coverage, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetCoverageAsync(request.IdService, coverage.IdCoverageRecord, cancellationToken) ?? coverage);
    }

    public async Task<CoverageRecordResponse> UpdateCoverageAsync(
        Guid idCoverageRecord,
        UpdateCoverageRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var coverage = await repository.GetCoverageAsync(request.IdService, idCoverageRecord, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la cobertura solicitada.");
        var replacement = await EnsureActiveEmployeeAsync(request.IdOrganization, request.IdReplacementEmployee, cancellationToken);
        if (replacement.IdEmployee == coverage.IdOriginalEmployee)
        {
            throw new ResourceConflictException("El sustituto no puede ser el mismo empleado original.");
        }

        var profile = ValidateCoverageProfile(
            replacement.IdEmployee,
            request.CoverageStartTime,
            request.CoverageEndTime,
            request.IsOvernight,
            request.Status,
            request.Notes);
        coverage.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetCoverageAsync(request.IdService, idCoverageRecord, cancellationToken) ?? coverage);
    }

    public async Task<IReadOnlyList<OperationEvidenceResponse>> ListEvidencesAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid? relatedRecordId,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var evidences = await repository.ListEvidencesAsync(idService, relatedRecordId, cancellationToken);
        return evidences.Select(Map).ToArray();
    }

    public async Task<OperationEvidenceResponse> CreateEvidenceAsync(
        OperationEvidenceInput request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        await EnsureEvidenceRelationAsync(request.IdService, request.IdAttendanceRecord, request.IdIncident, request.IdCoverageRecord, cancellationToken);
        var profile = ValidateEvidenceProfile(
            request.IdAttendanceRecord,
            request.IdIncident,
            request.IdCoverageRecord,
            request.EvidenceType,
            request.Title,
            request.StorageReference,
            request.Notes);
        var evidence = OperationEvidence.Create(
            request.IdService,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddEvidenceAsync(evidence, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetEvidenceAsync(request.IdService, evidence.IdOperationEvidence, cancellationToken) ?? evidence);
    }

    public async Task<OperationEvidenceResponse> UpdateEvidenceAsync(
        Guid idOperationEvidence,
        OperationEvidenceInput request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        await EnsureEvidenceRelationAsync(request.IdService, request.IdAttendanceRecord, request.IdIncident, request.IdCoverageRecord, cancellationToken);
        var evidence = await repository.GetEvidenceAsync(request.IdService, idOperationEvidence, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la evidencia solicitada.");
        var profile = ValidateEvidenceProfile(
            request.IdAttendanceRecord,
            request.IdIncident,
            request.IdCoverageRecord,
            request.EvidenceType,
            request.Title,
            request.StorageReference,
            request.Notes);

        evidence.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(await repository.GetEvidenceAsync(request.IdService, idOperationEvidence, cancellationToken) ?? evidence);
    }

    public async Task DeactivateEvidenceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idOperationEvidence,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var evidence = await repository.GetEvidenceAsync(idService, idOperationEvidence, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la evidencia solicitada.");

        evidence.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken)
    {
        if (await repository.GetServiceAsync(idOrganization, idClient, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
        }
    }

    private async Task EnsureEvidenceRelationAsync(
        Guid idService,
        Guid? idAttendanceRecord,
        Guid? idIncident,
        Guid? idCoverageRecord,
        CancellationToken cancellationToken)
    {
        var relatedRecords = new[] { idAttendanceRecord, idIncident, idCoverageRecord }
            .Count(value => value.HasValue && value.Value != Guid.Empty);

        if (relatedRecords != 1)
        {
            throw new RequestValidationException(
                new Dictionary<string, string[]>
                {
                    [nameof(idAttendanceRecord)] = ["La evidencia debe estar ligada a un solo registro operativo."]
                });
        }

        if (idAttendanceRecord.HasValue &&
            !await repository.AttendanceBelongsToServiceAsync(idService, idAttendanceRecord.Value, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró la asistencia relacionada.");
        }

        if (idIncident.HasValue &&
            !await repository.IncidentBelongsToServiceAsync(idService, idIncident.Value, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró la incidencia relacionada.");
        }

        if (idCoverageRecord.HasValue &&
            !await repository.CoverageBelongsToServiceAsync(idService, idCoverageRecord.Value, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró la cobertura relacionada.");
        }
    }

    private async Task<ScheduledShift> EnsureScheduledShiftAsync(Guid idService, Guid idScheduledShift, CancellationToken cancellationToken) =>
        await repository.GetScheduledShiftAsync(idService, idScheduledShift, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el turno programado solicitado.");

    private async Task<Employee> EnsureActiveEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken)
    {
        var employee = await repository.GetEmployeeAsync(idOrganization, idEmployee, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el empleado solicitado.");
        if (employee.Status != EmployeeStatus.Active)
        {
            throw new ResourceConflictException("Solo se pueden usar empleados activos.");
        }

        return employee;
    }

    private async Task EnsureOptionalShiftAndEmployeeAsync(
        Guid idOrganization,
        Guid idService,
        Guid? idScheduledShift,
        Guid? idEmployee,
        CancellationToken cancellationToken)
    {
        if (idScheduledShift.HasValue)
        {
            await EnsureScheduledShiftAsync(idService, idScheduledShift.Value, cancellationToken);
        }

        if (idEmployee.HasValue)
        {
            await EnsureActiveEmployeeAsync(idOrganization, idEmployee.Value, cancellationToken);
        }
    }

    private static void EnsurePublished(ScheduledShift shift)
    {
        if (shift.ScheduleVersion.Status != ScheduleVersionStatus.Published)
        {
            throw new ResourceConflictException("Solo se puede operar asistencia/cobertura sobre planeaciones publicadas.");
        }
    }

    private static AttendanceRecordProfile ValidateAttendanceProfile(
        AttendanceStatus status,
        TimeOnly? actualStartTime,
        TimeOnly? actualEndTime,
        int minutesLate,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        if (minutesLate < 0)
        {
            errors[nameof(minutesLate)] = ["Los minutos de retardo no pueden ser negativos."];
        }

        var normalizedNotes = InputValidation.Optional(notes, nameof(notes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);
        return new AttendanceRecordProfile(status, actualStartTime, actualEndTime, minutesLate, normalizedNotes);
    }

    private static bool AttendanceChanged(AttendanceRecord record, AttendanceRecordProfile profile) =>
        record.Status != profile.Status ||
        record.ActualStartTime != profile.ActualStartTime ||
        record.ActualEndTime != profile.ActualEndTime ||
        record.MinutesLate != profile.MinutesLate ||
        !string.Equals(record.Notes, profile.Notes, StringComparison.Ordinal);

    private static string? BuildAttendanceCorrectionNotes(string? notes, string? correctionAuthorizationNotes)
    {
        if (string.IsNullOrWhiteSpace(correctionAuthorizationNotes))
        {
            return notes;
        }

        var correctionNote = $"Corrección autorizada: {correctionAuthorizationNotes.Trim()}";
        return string.IsNullOrWhiteSpace(notes)
            ? correctionNote
            : $"{notes.Trim()} | {correctionNote}";
    }

    private static IncidentProfile ValidateIncidentProfile(
        Guid? idScheduledShift,
        Guid? idEmployee,
        DateOnly incidentDate,
        string incidentType,
        IncidentSeverity severity,
        IncidentStatus status,
        string description,
        string? resolutionNotes)
    {
        var errors = new Dictionary<string, string[]>();
        var normalizedType = InputValidation.Required(incidentType, nameof(incidentType), 80, errors);
        var normalizedDescription = InputValidation.Required(description, nameof(description), 2000, errors);
        var normalizedResolution = InputValidation.Optional(resolutionNotes, nameof(resolutionNotes), 2000, errors);
        if (incidentDate == default)
        {
            errors[nameof(incidentDate)] = ["La fecha de incidencia es obligatoria."];
        }

        InputValidation.ThrowIfInvalid(errors);
        return new IncidentProfile(idScheduledShift, idEmployee, incidentDate, normalizedType, severity, status, normalizedDescription, normalizedResolution);
    }

    private static CoverageRecordProfile ValidateCoverageProfile(
        Guid idReplacementEmployee,
        TimeOnly coverageStartTime,
        TimeOnly coverageEndTime,
        bool isOvernight,
        CoverageStatus status,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        var duration = DurationMinutes(coverageStartTime, coverageEndTime, isOvernight);
        if (duration <= 0 || duration > 24 * 60)
        {
            errors[nameof(coverageEndTime)] = ["La duración de cobertura no es válida."];
        }

        var normalizedNotes = InputValidation.Optional(notes, nameof(notes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);
        return new CoverageRecordProfile(idReplacementEmployee, coverageStartTime, coverageEndTime, isOvernight, status, normalizedNotes);
    }

    private static OperationEvidenceProfile ValidateEvidenceProfile(
        Guid? idAttendanceRecord,
        Guid? idIncident,
        Guid? idCoverageRecord,
        OperationEvidenceType evidenceType,
        string title,
        string storageReference,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        var normalizedTitle = InputValidation.Required(title, nameof(title), 180, errors);
        var normalizedReference = InputValidation.Required(storageReference, nameof(storageReference), 500, errors);
        var normalizedNotes = InputValidation.Optional(notes, nameof(notes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);
        return new OperationEvidenceProfile(
            idAttendanceRecord,
            idIncident,
            idCoverageRecord,
            evidenceType,
            normalizedTitle,
            normalizedReference,
            normalizedNotes);
    }

    private static AttendanceRecordResponse Map(AttendanceRecord record) =>
        new(
            record.IdAttendanceRecord,
            record.IdScheduledShift,
            record.IdEmployee,
            record.Employee.CodeEmployee,
            record.Employee.FullName,
            record.AttendanceDate,
            record.Status,
            record.ActualStartTime,
            record.ActualEndTime,
            record.MinutesLate,
            record.Notes,
            record.Active);

    private static IncidentResponse Map(Incident incident) =>
        new(
            incident.IdIncident,
            incident.IdService,
            incident.IdScheduledShift,
            incident.IdEmployee,
            incident.Employee?.CodeEmployee,
            incident.Employee?.FullName,
            incident.IncidentDate,
            incident.IncidentType,
            incident.Severity,
            incident.Status,
            incident.Description,
            incident.ResolutionNotes,
            incident.Active);

    private static CoverageRecordResponse Map(CoverageRecord coverage) =>
        new(
            coverage.IdCoverageRecord,
            coverage.IdScheduledShift,
            coverage.IdOriginalEmployee,
            coverage.OriginalEmployee.CodeEmployee,
            coverage.OriginalEmployee.FullName,
            coverage.IdReplacementEmployee,
            coverage.ReplacementEmployee.CodeEmployee,
            coverage.ReplacementEmployee.FullName,
            coverage.CoverageStartTime,
            coverage.CoverageEndTime,
            coverage.IsOvernight,
            coverage.DurationMinutes,
            coverage.Status,
            coverage.Notes,
            coverage.Active);

    private static OperationEvidenceResponse Map(OperationEvidence evidence) =>
        new(
            evidence.IdOperationEvidence,
            evidence.IdService,
            evidence.IdAttendanceRecord,
            evidence.IdIncident,
            evidence.IdCoverageRecord,
            evidence.EvidenceType,
            evidence.Title,
            evidence.StorageReference,
            evidence.Notes,
            evidence.Active);

    private static int DurationMinutes(TimeOnly startTime, TimeOnly endTime, bool isOvernight)
    {
        var startMinutes = startTime.Hour * 60 + startTime.Minute;
        var endMinutes = endTime.Hour * 60 + endTime.Minute;
        return isOvernight
            ? (24 * 60 - startMinutes) + endMinutes
            : endMinutes - startMinutes;
    }
}
