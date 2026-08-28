using GestIA.Application.Common;
using GestIA.Domain.Planning;

namespace GestIA.Application.Planning;

public sealed class PlanningService(
    IPlanningRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IPlanningService
{
    public async Task<IReadOnlyList<PositionResponse>> ListPositionsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var positions = await repository.ListPositionsAsync(idService, cancellationToken);
        return positions.Select(Map).ToArray();
    }

    public async Task<PositionResponse> CreatePositionAsync(
        CreatePositionRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var code = NormalizeCode(request.CodePosition, nameof(request.CodePosition));
        var profile = ValidatePosition(request.Name, request.RequiredWorkerCount, request.RequiredSkillProfile, request.Notes);

        if (await repository.IsPositionCodeInUseAsync(request.IdService, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una posición con el código '{code}'.");
        }

        var position = Position.Create(
            request.IdService,
            code,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddPositionAsync(position, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(position);
    }

    public async Task<PositionResponse> UpdatePositionAsync(
        Guid idPosition,
        UpdatePositionRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var position = await EnsurePositionAsync(request.IdService, idPosition, cancellationToken);
        var profile = ValidatePosition(request.Name, request.RequiredWorkerCount, request.RequiredSkillProfile, request.Notes);

        position.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(position);
    }

    public async Task DeactivatePositionAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var position = await EnsurePositionAsync(idService, idPosition, cancellationToken);
        position.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ShiftPatternResponse>> ListShiftPatternsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken)
    {
        await EnsurePositionInServiceAsync(idOrganization, idClient, idService, idPosition, cancellationToken);
        var patterns = await repository.ListShiftPatternsAsync(idPosition, cancellationToken);
        return patterns.Select(Map).ToArray();
    }

    public async Task<ShiftPatternResponse> CreateShiftPatternAsync(
        CreateShiftPatternRequest request,
        CancellationToken cancellationToken)
    {
        await EnsurePositionInServiceAsync(request.IdOrganization, request.IdClient, request.IdService, request.IdPosition, cancellationToken);
        var code = NormalizeCode(request.CodeShiftPattern, nameof(request.CodeShiftPattern));
        var profile = ValidateShiftPattern(request.Name, request.Description, request.EffectiveFromDate, request.EffectiveToDate);

        if (await repository.IsShiftPatternCodeInUseAsync(request.IdPosition, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un patrón con el código '{code}'.");
        }

        var pattern = ShiftPattern.Create(
            request.IdPosition,
            code,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddShiftPatternAsync(pattern, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(pattern);
    }

    public async Task<ShiftPatternResponse> UpdateShiftPatternAsync(
        Guid idShiftPattern,
        UpdateShiftPatternRequest request,
        CancellationToken cancellationToken)
    {
        await EnsurePositionInServiceAsync(request.IdOrganization, request.IdClient, request.IdService, request.IdPosition, cancellationToken);
        var pattern = await EnsureShiftPatternAsync(request.IdPosition, idShiftPattern, cancellationToken);
        var profile = ValidateShiftPattern(request.Name, request.Description, request.EffectiveFromDate, request.EffectiveToDate);

        pattern.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(pattern);
    }

    public async Task DeactivateShiftPatternAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        Guid idShiftPattern,
        CancellationToken cancellationToken)
    {
        await EnsurePositionInServiceAsync(idOrganization, idClient, idService, idPosition, cancellationToken);
        var pattern = await EnsureShiftPatternAsync(idPosition, idShiftPattern, cancellationToken);
        pattern.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ShiftSegmentResponse>> ListShiftSegmentsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        Guid idShiftPattern,
        CancellationToken cancellationToken)
    {
        await EnsureShiftPatternInPositionAsync(idOrganization, idClient, idService, idPosition, idShiftPattern, cancellationToken);
        var segments = await repository.ListShiftSegmentsAsync(idShiftPattern, cancellationToken);
        return segments.Select(Map).ToArray();
    }

    public async Task<ShiftSegmentResponse> CreateShiftSegmentAsync(
        CreateShiftSegmentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureShiftPatternInPositionAsync(
            request.IdOrganization,
            request.IdClient,
            request.IdService,
            request.IdPosition,
            request.IdShiftPattern,
            cancellationToken);
        var profile = ValidateShiftSegment(
            request.DayOfWeek,
            request.StartTime,
            request.EndTime,
            request.IsOvernight,
            request.RequiredWorkerCount,
            request.Notes);
        await EnsureNoOverlapAsync(request.IdShiftPattern, profile, null, cancellationToken);

        var segment = ShiftSegment.Create(
            request.IdShiftPattern,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddShiftSegmentAsync(segment, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(segment);
    }

    public async Task<ShiftSegmentResponse> UpdateShiftSegmentAsync(
        Guid idShiftSegment,
        UpdateShiftSegmentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureShiftPatternInPositionAsync(
            request.IdOrganization,
            request.IdClient,
            request.IdService,
            request.IdPosition,
            request.IdShiftPattern,
            cancellationToken);
        var segment = await EnsureShiftSegmentAsync(request.IdShiftPattern, idShiftSegment, cancellationToken);
        var profile = ValidateShiftSegment(
            request.DayOfWeek,
            request.StartTime,
            request.EndTime,
            request.IsOvernight,
            request.RequiredWorkerCount,
            request.Notes);
        await EnsureNoOverlapAsync(request.IdShiftPattern, profile, idShiftSegment, cancellationToken);

        segment.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(segment);
    }

    public async Task DeactivateShiftSegmentAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        Guid idShiftPattern,
        Guid idShiftSegment,
        CancellationToken cancellationToken)
    {
        await EnsureShiftPatternInPositionAsync(idOrganization, idClient, idService, idPosition, idShiftPattern, cancellationToken);
        var segment = await EnsureShiftSegmentAsync(idShiftPattern, idShiftSegment, cancellationToken);
        segment.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken)
    {
        if (idOrganization == Guid.Empty || idClient == Guid.Empty || idService == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idOrganization)] = ["La organización es obligatoria."],
                [nameof(idClient)] = ["El cliente es obligatorio."],
                [nameof(idService)] = ["El servicio es obligatorio."]
            });
        }

        if (await repository.GetServiceAsync(idOrganization, idClient, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
        }
    }

    private async Task<Position> EnsurePositionAsync(Guid idService, Guid idPosition, CancellationToken cancellationToken) =>
        await repository.GetPositionAsync(idService, idPosition, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la posición solicitada.");

    private async Task<ShiftPattern> EnsureShiftPatternAsync(Guid idPosition, Guid idShiftPattern, CancellationToken cancellationToken) =>
        await repository.GetShiftPatternAsync(idPosition, idShiftPattern, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el patrón de turno solicitado.");

    private async Task<ShiftSegment> EnsureShiftSegmentAsync(Guid idShiftPattern, Guid idShiftSegment, CancellationToken cancellationToken) =>
        await repository.GetShiftSegmentAsync(idShiftPattern, idShiftSegment, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el segmento de turno solicitado.");

    private async Task EnsurePositionInServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        await EnsurePositionAsync(idService, idPosition, cancellationToken);
    }

    private async Task EnsureShiftPatternInPositionAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        Guid idShiftPattern,
        CancellationToken cancellationToken)
    {
        await EnsurePositionInServiceAsync(idOrganization, idClient, idService, idPosition, cancellationToken);
        await EnsureShiftPatternAsync(idPosition, idShiftPattern, cancellationToken);
    }

    private async Task EnsureNoOverlapAsync(
        Guid idShiftPattern,
        ShiftSegmentProfile profile,
        Guid? excludedShiftSegmentId,
        CancellationToken cancellationToken)
    {
        if (await repository.HasSegmentOverlapAsync(
                idShiftPattern,
                profile.DayOfWeek,
                profile.StartTime,
                profile.EndTime,
                profile.IsOvernight,
                excludedShiftSegmentId,
                cancellationToken))
        {
            throw new ResourceConflictException("El segmento se traslapa con otro segmento del mismo día.");
        }
    }

    private static PositionProfile ValidatePosition(
        string name,
        int requiredWorkerCount,
        string? requiredSkillProfile,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        Required(name, nameof(name), 150, errors);
        MaxLength(requiredSkillProfile, nameof(requiredSkillProfile), 1000, errors);
        MaxLength(notes, nameof(notes), 1000, errors);
        if (requiredWorkerCount <= 0)
        {
            errors[nameof(requiredWorkerCount)] = ["La cantidad requerida debe ser mayor a cero."];
        }

        ThrowIfInvalid(errors);
        return new PositionProfile(name, requiredWorkerCount, requiredSkillProfile, notes);
    }

    private static ShiftPatternProfile ValidateShiftPattern(
        string name,
        string? description,
        DateOnly effectiveFromDate,
        DateOnly? effectiveToDate)
    {
        var errors = new Dictionary<string, string[]>();
        Required(name, nameof(name), 150, errors);
        MaxLength(description, nameof(description), 1000, errors);
        if (effectiveToDate < effectiveFromDate)
        {
            errors[nameof(effectiveToDate)] = ["La fecha fin no puede ser menor a la fecha inicio."];
        }

        ThrowIfInvalid(errors);
        return new ShiftPatternProfile(name, description, effectiveFromDate, effectiveToDate);
    }

    private static ShiftSegmentProfile ValidateShiftSegment(
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        bool isOvernight,
        int requiredWorkerCount,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        MaxLength(notes, nameof(notes), 1000, errors);
        if (requiredWorkerCount <= 0)
        {
            errors[nameof(requiredWorkerCount)] = ["La cantidad requerida debe ser mayor a cero."];
        }

        var duration = DurationMinutes(startTime, endTime, isOvernight);
        if (duration <= 0 || duration > 1440)
        {
            errors[nameof(endTime)] = ["El horario debe tener duración mayor a cero y menor o igual a 24 horas."];
        }

        ThrowIfInvalid(errors);
        return new ShiftSegmentProfile(dayOfWeek, startTime, endTime, isOvernight, requiredWorkerCount, notes);
    }

    private static int DurationMinutes(TimeOnly startTime, TimeOnly endTime, bool isOvernight)
    {
        var start = startTime.Hour * 60 + startTime.Minute;
        var end = endTime.Hour * 60 + endTime.Minute;
        return isOvernight ? (1440 - start) + end : end - start;
    }

    private static string NormalizeCode(string value, string fieldName)
    {
        var errors = new Dictionary<string, string[]>();
        Required(value, fieldName, 40, errors);
        ThrowIfInvalid(errors);
        return value.Trim().ToUpperInvariant();
    }

    private static void Required(string? value, string fieldName, int maximumLength, Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[fieldName] = ["El campo es obligatorio."];
            return;
        }

        MaxLength(value, fieldName, maximumLength, errors);
    }

    private static void MaxLength(string? value, string fieldName, int maximumLength, Dictionary<string, string[]> errors)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.Trim().Length > maximumLength)
        {
            errors[fieldName] = [$"No puede exceder {maximumLength} caracteres."];
        }
    }

    private static void ThrowIfInvalid(Dictionary<string, string[]> errors)
    {
        if (errors.Count > 0)
        {
            throw new RequestValidationException(errors);
        }
    }

    private static PositionResponse Map(Position position) =>
        new(
            position.IdPosition,
            position.IdService,
            position.CodePosition,
            position.Name,
            position.RequiredWorkerCount,
            position.RequiredSkillProfile,
            position.Notes,
            position.Active);

    private static ShiftPatternResponse Map(ShiftPattern shiftPattern) =>
        new(
            shiftPattern.IdShiftPattern,
            shiftPattern.IdPosition,
            shiftPattern.CodeShiftPattern,
            shiftPattern.Name,
            shiftPattern.Description,
            shiftPattern.EffectiveFromDate,
            shiftPattern.EffectiveToDate,
            shiftPattern.Active);

    private static ShiftSegmentResponse Map(ShiftSegment shiftSegment) =>
        new(
            shiftSegment.IdShiftSegment,
            shiftSegment.IdShiftPattern,
            shiftSegment.DayOfWeek,
            shiftSegment.StartTime,
            shiftSegment.EndTime,
            shiftSegment.IsOvernight,
            shiftSegment.RequiredWorkerCount,
            shiftSegment.DurationMinutes,
            shiftSegment.Notes,
            shiftSegment.Active);
}

