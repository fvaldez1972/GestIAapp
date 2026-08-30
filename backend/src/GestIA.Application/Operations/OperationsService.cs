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

            if (AttendanceChanged(existing, profile) && !request.IdApprovalRequest.HasValue)
            {
                throw new RequestValidationException(new Dictionary<string, string[]>
                {
                    [nameof(request.IdApprovalRequest)] =
                        ["Para corregir una asistencia ya capturada necesitas seleccionar una autorización aprobada."]
                });
            }

            if (AttendanceChanged(existing, profile) && request.IdApprovalRequest.HasValue)
            {
                await EnsureApprovedApprovalRequestAsync(
                    request.IdOrganization,
                    request.IdService,
                    ApprovalRequestType.AttendanceCorrection,
                    "AttendanceRecord",
                    existing.IdAttendanceRecord,
                    request.IdApprovalRequest.Value,
                    cancellationToken);
            }

            existing.UpdateProfile(
                profile with
                {
                    Notes = BuildAttendanceCorrectionNotes(profile.Notes, correctionAuthorizationNotes, request.IdApprovalRequest)
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

    public async Task<IReadOnlyList<ApprovalRequestResponse>> ListApprovalRequestsAsync(
        ApprovalRequestQuery query,
        CancellationToken cancellationToken)
    {
        if (query.IdService.HasValue)
        {
            await EnsureServiceByOrganizationAsync(query.IdOrganization, query.IdService.Value, cancellationToken);
        }

        var approvals = await repository.ListApprovalRequestsAsync(
            query.IdOrganization,
            query.IdService,
            query.Status,
            cancellationToken);
        return approvals.Select(Map).ToArray();
    }

    public async Task<ApprovalRequestResponse> CreateApprovalRequestAsync(
        CreateApprovalRequestRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceByOrganizationAsync(request.IdOrganization, request.IdService, cancellationToken);
        await EnsureApprovalEntityBelongsToServiceAsync(request.IdService, request.EntityType, request.EntityId, cancellationToken);

        var profile = ValidateApprovalProfile(
            request.IdOrganization,
            request.IdService,
            request.ApprovalType,
            request.EntityType,
            request.EntityId,
            request.Reason,
            request.RequestedChangeSummary,
            request.AssignedApproverName,
            request.IdOperationEvidence);

        if (request.IdOperationEvidence.HasValue &&
            await repository.GetEvidenceAsync(request.IdService, request.IdOperationEvidence.Value, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró la evidencia ligada a la autorización.");
        }

        var approval = ApprovalRequest.Create(
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddApprovalRequestAsync(approval, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(approval);
    }

    public async Task<ApprovalRequestResponse> DecideApprovalRequestAsync(
        Guid idApprovalRequest,
        DecideApprovalRequestRequest request,
        CancellationToken cancellationToken)
    {
        var approval = await repository.GetApprovalRequestAsync(request.IdOrganization, idApprovalRequest, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la autorización solicitada.");

        if (approval.Status != ApprovalRequestStatus.Pending)
        {
            throw new ResourceConflictException("La autorización ya fue resuelta.");
        }

        if (request.Status is not ApprovalRequestStatus.Approved and not ApprovalRequestStatus.Rejected and not ApprovalRequestStatus.Cancelled)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(request.Status)] = ["La decisión debe ser aprobada, rechazada o cancelada."]
            });
        }

        var errors = new Dictionary<string, string[]>();
        var decisionNotes = InputValidation.Optional(request.DecisionNotes, nameof(request.DecisionNotes), 1200, errors);
        InputValidation.ThrowIfInvalid(errors);

        approval.Decide(
            request.Status,
            decisionNotes,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(approval);
    }

    public async Task<IReadOnlyList<OperationDayClosureResponse>> ListDayClosuresAsync(
        OperationDayClosureQuery query,
        CancellationToken cancellationToken)
    {
        if (query.IdService.HasValue)
        {
            await EnsureServiceByOrganizationAsync(query.IdOrganization, query.IdService.Value, cancellationToken);
        }

        var closures = await repository.ListDayClosuresAsync(
            query.IdOrganization,
            query.IdService,
            query.FromDate,
            query.ToDate,
            cancellationToken);
        return closures.Select(Map).ToArray();
    }

    public async Task<OperationDayClosureResponse> CloseOperationDayAsync(
        Guid idClient,
        Guid idService,
        CloseOperationDayRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, idClient, idService, cancellationToken);

        if (await repository.GetDayClosureAsync(idService, request.OperationDate, cancellationToken) is not null)
        {
            throw new ResourceConflictException("El día operativo ya tiene un cierre registrado.");
        }

        var shifts = await repository.ListScheduledShiftsAsync(idService, request.OperationDate, cancellationToken);
        if (shifts.Count == 0)
        {
            throw new ResourceConflictException("No se puede cerrar un día sin turnos publicados.");
        }

        var attendance = await repository.ListAttendanceAsync(idService, request.OperationDate, cancellationToken);
        var incidents = await repository.ListIncidentsAsync(idService, cancellationToken);
        var coverages = await repository.ListCoveragesAsync(idService, cancellationToken);
        var openIncidents = incidents.Count(incident =>
            incident.IncidentDate == request.OperationDate &&
            (incident.Status is IncidentStatus.Open or IncidentStatus.InReview));
        var coverageRecords = coverages.Count(coverage => coverage.ScheduledShift.ShiftDate == request.OperationDate);
        var pendingAttendance = shifts.Count(shift =>
            attendance.All(record => record.IdScheduledShift != shift.IdScheduledShift));

        if (pendingAttendance > 0 || openIncidents > 0)
        {
            throw new ResourceConflictException(
                $"No se puede cerrar el día: {pendingAttendance} turno(s) sin asistencia y {openIncidents} incidencia(s) abierta(s).");
        }

        var closureErrors = new Dictionary<string, string[]>();
        var notes = InputValidation.Optional(request.Notes, nameof(request.Notes), 1200, closureErrors);
        InputValidation.ThrowIfInvalid(closureErrors);

        var profile = new OperationDayClosureProfile(
            request.IdOrganization,
            idService,
            request.OperationDate,
            shifts.Count,
            attendance.Count,
            pendingAttendance,
            openIncidents,
            coverageRecords,
            notes);

        var closure = OperationDayClosure.Create(
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddDayClosureAsync(closure, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(closure);
    }

    public async Task<OperationDayClosureResponse> ReopenOperationDayAsync(
        Guid idClient,
        Guid idService,
        Guid idOperationDayClosure,
        ReopenOperationDayRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, idClient, idService, cancellationToken);
        var closure = await repository.GetDayClosureAsync(idService, idOperationDayClosure, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el cierre operativo solicitado.");

        var errors = new Dictionary<string, string[]>();
        var reason = InputValidation.Required(request.Reason, nameof(request.Reason), 1200, errors);
        InputValidation.ThrowIfInvalid(errors);

        closure.Reopen(reason, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(closure);
    }

    private async Task EnsureServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken)
    {
        if (await repository.GetServiceAsync(idOrganization, idClient, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
        }
    }

    private async Task EnsureServiceByOrganizationAsync(Guid idOrganization, Guid idService, CancellationToken cancellationToken)
    {
        if (idOrganization == Guid.Empty || idService == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idOrganization)] = ["La organización es obligatoria."],
                [nameof(idService)] = ["El servicio es obligatorio."]
            });
        }

        if (await repository.GetServiceAsync(idOrganization, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
        }
    }

    private async Task EnsureApprovalEntityBelongsToServiceAsync(
        Guid idService,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken)
    {
        var normalizedEntityType = entityType.Trim();
        var exists = normalizedEntityType switch
        {
            "AttendanceRecord" => await repository.AttendanceBelongsToServiceAsync(idService, entityId, cancellationToken),
            "Incident" => await repository.IncidentBelongsToServiceAsync(idService, entityId, cancellationToken),
            "CoverageRecord" => await repository.CoverageBelongsToServiceAsync(idService, entityId, cancellationToken),
            "OperationEvidence" => await repository.GetEvidenceAsync(idService, entityId, cancellationToken) is not null,
            "ServiceConfiguration" => true,
            "BusinessDocument" => true,
            _ => true
        };

        if (!exists)
        {
            throw new ResourceNotFoundException("No se encontró el registro relacionado a la autorización.");
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
        return BuildAttendanceCorrectionNotes(notes, correctionAuthorizationNotes, null);
    }

    private static string? BuildAttendanceCorrectionNotes(
        string? notes,
        string? correctionAuthorizationNotes,
        Guid? idApprovalRequest)
    {
        if (string.IsNullOrWhiteSpace(correctionAuthorizationNotes) && !idApprovalRequest.HasValue)
        {
            return notes;
        }

        var approvalReference = idApprovalRequest.HasValue ? $"Autorización aprobada: {idApprovalRequest.Value}" : null;
        var correctionNote = string.Join(
            " · ",
            new[] { approvalReference, string.IsNullOrWhiteSpace(correctionAuthorizationNotes) ? null : $"Nota: {correctionAuthorizationNotes.Trim()}" }
                .Where(value => !string.IsNullOrWhiteSpace(value)));

        return string.IsNullOrWhiteSpace(notes)
            ? correctionNote
            : $"{notes.Trim()} | {correctionNote}";
    }

    private async Task EnsureApprovedApprovalRequestAsync(
        Guid idOrganization,
        Guid idService,
        ApprovalRequestType approvalType,
        string entityType,
        Guid entityId,
        Guid idApprovalRequest,
        CancellationToken cancellationToken)
    {
        var approval = await repository.GetApprovalRequestAsync(idOrganization, idApprovalRequest, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la autorización seleccionada.");

        if (approval.IdService != idService ||
            approval.ApprovalType != approvalType ||
            !string.Equals(approval.EntityType, entityType, StringComparison.OrdinalIgnoreCase) ||
            approval.EntityId != entityId)
        {
            throw new ResourceConflictException("La autorización seleccionada no corresponde al registro que se intenta corregir.");
        }

        if (approval.Status != ApprovalRequestStatus.Approved)
        {
            throw new ResourceConflictException("La autorización seleccionada todavía no está aprobada.");
        }
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

    private static ApprovalRequestProfile ValidateApprovalProfile(
        Guid idOrganization,
        Guid idService,
        ApprovalRequestType approvalType,
        string entityType,
        Guid entityId,
        string reason,
        string? requestedChangeSummary,
        string? assignedApproverName,
        Guid? idOperationEvidence)
    {
        var errors = new Dictionary<string, string[]>();
        if (idOrganization == Guid.Empty)
        {
            errors[nameof(idOrganization)] = ["La organización es obligatoria."];
        }

        if (idService == Guid.Empty)
        {
            errors[nameof(idService)] = ["El servicio es obligatorio."];
        }

        if (entityId == Guid.Empty)
        {
            errors[nameof(entityId)] = ["El registro relacionado es obligatorio."];
        }

        var normalizedEntityType = InputValidation.Required(entityType, nameof(entityType), 80, errors);
        var normalizedReason = InputValidation.Required(reason, nameof(reason), 1200, errors);
        var normalizedSummary = InputValidation.Optional(requestedChangeSummary, nameof(requestedChangeSummary), 2000, errors);
        var normalizedApproverName = InputValidation.Optional(assignedApproverName, nameof(assignedApproverName), 100, errors);
        InputValidation.ThrowIfInvalid(errors);

        return new ApprovalRequestProfile(
            idOrganization,
            idService,
            approvalType,
            normalizedEntityType,
            entityId,
            normalizedReason,
            normalizedSummary,
            normalizedApproverName,
            idOperationEvidence);
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

    private static ApprovalRequestResponse Map(ApprovalRequest approval) =>
        new(
            approval.IdApprovalRequest,
            approval.IdOrganization,
            approval.IdService,
            approval.ApprovalType,
            approval.EntityType,
            approval.EntityId,
            approval.Reason,
            approval.RequestedChangeSummary,
            approval.AssignedApproverName,
            approval.IdOperationEvidence,
            approval.Status,
            approval.RequestedAt,
            approval.CreatedByName,
            approval.DecidedAt,
            approval.DecidedByName,
            approval.DecisionNotes,
            approval.Active);

    private static OperationDayClosureResponse Map(OperationDayClosure closure) =>
        new(
            closure.IdOperationDayClosure,
            closure.IdOrganization,
            closure.IdService,
            closure.OperationDate,
            closure.ExpectedShifts,
            closure.AttendanceRecords,
            closure.PendingAttendance,
            closure.OpenIncidents,
            closure.CoverageRecords,
            closure.Notes,
            closure.Status,
            closure.ClosedAt,
            closure.ClosedByName,
            closure.ReopenedAt,
            closure.ReopenedByName,
            closure.ReopenReason,
            closure.Active);

    private static int DurationMinutes(TimeOnly startTime, TimeOnly endTime, bool isOvernight)
    {
        var startMinutes = startTime.Hour * 60 + startTime.Minute;
        var endMinutes = endTime.Hour * 60 + endTime.Minute;
        return isOvernight
            ? (24 * 60 - startMinutes) + endMinutes
            : endMinutes - startMinutes;
    }
}
