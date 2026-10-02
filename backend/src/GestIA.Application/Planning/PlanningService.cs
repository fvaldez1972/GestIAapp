using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;

namespace GestIA.Application.Planning;

public sealed class PlanningService(
    IPlanningRepository repository,
    ICatalogService catalogService,
    IShiftPatternTemplateRepository shiftPatternTemplates,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IPlanningService
{
    public async Task<IReadOnlyList<PositionVacancyResponse>> ListPositionVacancyAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        DateOnly? operationDate,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);

        return await repository.ListPositionVacancyAsync(
            idService,
            operationDate ?? clock.Today,
            cancellationToken);
    }

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
        var service = await EnsureServiceAsync(
            request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        // Opcional a proposito: sin codigo lo pone el servidor, consecutivo por servicio.
        var code = string.IsNullOrWhiteSpace(request.CodePosition)
            ? $"P-{await repository.HighestPositionCodeNumberAsync(request.IdService, cancellationToken) + 1:00}"
            : NormalizeCode(request.CodePosition, nameof(request.CodePosition));
        var profile = ValidatePosition(
            request.Name, request.RequiredWorkerCount, request.RequiredSkillProfile,
            request.Notes, request.StartDate, request.EndDate, service, request.IdJobPositionCatalogItem,
            request.Price, request.CurrencyCode, request.IsTaxIncluded, request.PriceFrequency,
            request.IdShiftPatternTemplate,
            request.IdSexCatalogItem, request.IdAgeRangeCatalogItem, request.IdEducationLevelCatalogItem);
        await EnsureJobPositionAsync(request.IdOrganization, profile.IdJobPositionCatalogItem, cancellationToken);
        await EnsureShiftPatternTemplateAsync(
            request.IdOrganization, profile.IdShiftPatternTemplate, cancellationToken, required: true);

        if (await repository.IsPositionCodeInUseAsync(request.IdService, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una posición con el código '{code}'.");
        }

        var position = Position.Create(
            request.IdOrganization,
            request.IdService,
            code,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddPositionAsync(position, cancellationToken);
        await SyncEquipmentAsync(
            request.IdOrganization, position, request.IdRequiredEquipmentCatalogItems, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(position);
    }

    public async Task<PositionResponse> UpdatePositionAsync(
        Guid idPosition,
        UpdatePositionRequest request,
        CancellationToken cancellationToken)
    {
        var service = await EnsureServiceAsync(
            request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var position = await EnsurePositionAsync(request.IdService, idPosition, cancellationToken);
        var profile = ValidatePosition(
            request.Name, request.RequiredWorkerCount, request.RequiredSkillProfile,
            request.Notes, request.StartDate, request.EndDate, service, request.IdJobPositionCatalogItem,
            request.Price, request.CurrencyCode, request.IsTaxIncluded, request.PriceFrequency,
            request.IdShiftPatternTemplate,
            request.IdSexCatalogItem, request.IdAgeRangeCatalogItem, request.IdEducationLevelCatalogItem);
        await EnsureJobPositionAsync(request.IdOrganization, profile.IdJobPositionCatalogItem, cancellationToken);
        await EnsureShiftPatternTemplateAsync(
            request.IdOrganization, profile.IdShiftPatternTemplate, cancellationToken);

        position.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await SyncEquipmentAsync(
            request.IdOrganization, position, request.IdRequiredEquipmentCatalogItems, cancellationToken);
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
        var code = string.IsNullOrWhiteSpace(request.CodeShiftPattern)
            ? $"PAT-{await repository.HighestShiftPatternCodeNumberAsync(request.IdPosition, cancellationToken) + 1:00}"
            : NormalizeCode(request.CodeShiftPattern, nameof(request.CodeShiftPattern));
        var profile = ValidateShiftPattern(request.Name, request.Description, request.EffectiveFromDate, request.EffectiveToDate);

        if (await repository.IsShiftPatternCodeInUseAsync(request.IdPosition, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un patrón con el código '{code}'.");
        }

        var pattern = ShiftPattern.Create(
            request.IdOrganization,
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
            request.IdOrganization,
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

    /// <summary>
    /// Que el servicio exista, y <b>devolverlo</b>: la vigencia de la posición se compara contra la
    /// suya, y volver a leerlo en cada llamada sería un viaje de más a la base.
    /// </summary>
    private async Task<Service> EnsureServiceAsync(Guid idOrganization, Guid idClient, Guid idService, CancellationToken cancellationToken)
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

        return await repository.GetServiceAsync(idOrganization, idClient, idService, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
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

    /// <summary>
    /// El puesto es opcional. Un nulo no bloquea nada: significa que no se declaró, no que la
    /// posición acepte a cualquiera.
    /// </summary>
    private async Task EnsureJobPositionAsync(
        Guid idOrganization,
        Guid? idJobPositionCatalogItem,
        CancellationToken cancellationToken)
    {
        if (idJobPositionCatalogItem is { } id)
        {
            await catalogService.EnsureJobPositionCatalogItemAsync(idOrganization, id, cancellationToken);
        }
    }

    /// <summary>
    /// Comprueba en el servidor que el patrón elegido se puede asignar.
    ///
    /// <para>El desplegable ya sólo ofrece patrones completos de la propia organización, pero eso
    /// es cromo: ocultar una opción no es autorización, y una posición apuntando a un patrón con
    /// días sin declarar generaría turnos con huecos que nadie pidió.</para>
    /// </summary>
    /// <summary>
    /// Que el patrón exista, esté activo y tenga su ciclo completo.
    ///
    /// <para><b>Y que lo haya, cuando la posición es nueva.</b> Desde el 19 de septiembre de 2026
    /// una posición no nace sin patrón del catálogo: sin él no se pueden proyectar turnos ni
    /// publicar la planeación, y la posición existía igual, en silencio, hasta que alguien
    /// intentaba planear.</para>
    ///
    /// <para><b>Al editar no se exige, y es deliberado.</b> Quedan posiciones capturadas antes de
    /// esta regla sin patrón —las que la migración no pudo reconciliar— y exigirlo aquí impediría
    /// corregirles el nombre o el precio hasta resolver su horario, que es un problema aparte. La
    /// pantalla las marca para revisión; eso es lo que las cierra, no un candado.</para>
    /// </summary>
    private async Task EnsureShiftPatternTemplateAsync(
        Guid idOrganization,
        Guid? idShiftPatternTemplate,
        CancellationToken cancellationToken,
        bool required = false)
    {
        if (idShiftPatternTemplate is not { } id)
        {
            if (required)
            {
                throw new RequestValidationException(new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
                {
                    ["idShiftPatternTemplate"] =
                        ["Elige el patrón de turno del catálogo. Sin patrón no se pueden proyectar turnos ni publicar la planeación."]
                });
            }

            return;
        }

        if (!await shiftPatternTemplates.IsAssignableAsync(idOrganization, id, cancellationToken))
        {
            throw new RequestValidationException(new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                ["idShiftPatternTemplate"] =
                    ["El patrón de turno no existe, está retirado o tiene días del ciclo sin declarar."]
            });
        }
    }

    private static PositionProfile ValidatePosition(
        string name,
        int requiredWorkerCount,
        string? requiredSkillProfile,
        string? notes,
        DateOnly? startDate,
        DateOnly? endDate,
        Service service,
        Guid? idJobPositionCatalogItem,
        decimal price,
        string currencyCode,
        bool isTaxIncluded,
        PaymentFrequency priceFrequency,
        Guid? idShiftPatternTemplate,
        Guid? idSexCatalogItem,
        Guid? idAgeRangeCatalogItem,
        Guid? idEducationLevelCatalogItem)
    {
        var errors = new Dictionary<string, string[]>();
        Required(name, nameof(name), 150, errors);
        MaxLength(requiredSkillProfile, nameof(requiredSkillProfile), 1000, errors);
        MaxLength(notes, nameof(notes), 1000, errors);
        if (requiredWorkerCount <= 0)
        {
            errors[nameof(requiredWorkerCount)] = ["La cantidad requerida debe ser mayor a cero."];
        }

        if (price < 0)
        {
            errors[nameof(price)] = ["El precio no puede ser negativo."];
        }

        // Sin fechas propias, la posicion hereda la vigencia del servicio: es lo que tenia
        // implicitamente antes de que la columna existiera, y deja que el alta siga siendo minima.
        var inicio = startDate ?? service.StartDate;
        var fin = endDate ?? service.EndDate;
        ValidateValidity(inicio, fin, service, errors);

        ThrowIfInvalid(errors);
        return new PositionProfile(
            name,
            requiredWorkerCount,
            requiredSkillProfile,
            notes,
            inicio,
            fin,
            idJobPositionCatalogItem,
            price,
            string.IsNullOrWhiteSpace(currencyCode) ? "MXN" : currencyCode,
            isTaxIncluded,
            priceFrequency,
            idShiftPatternTemplate,
            idSexCatalogItem,
            idAgeRangeCatalogItem,
            idEducationLevelCatalogItem);
    }

    /// <summary>
    /// Que la vigencia del puesto quepa dentro de la del servicio.
    ///
    /// <para><b>Es error y no aviso, por decisión tomada.</b> Un puesto que empieza antes de que el
    /// servicio exista, o que sigue vigente después de que el contrato terminó, produce demanda de
    /// planeación para días en los que no hay nada que cubrir: turnos que generar, vacantes que
    /// reportar y personas a las que asignar un servicio que ya no se presta. Dejarlo pasar con un
    /// aviso habría trasladado la corrección a quien lee el tablero tres semanas después.</para>
    ///
    /// <para>Un servicio sin fecha de término no acota por arriba: ahí un puesto permanente es
    /// legítimo.</para>
    /// </summary>
    private static void ValidateValidity(
        DateOnly startDate,
        DateOnly? endDate,
        Service service,
        Dictionary<string, string[]> errors)
    {
        if (endDate is { } fin && fin < startDate)
        {
            errors[nameof(endDate)] = ["La fecha de fin no puede ser anterior a la de inicio."];
        }

        if (startDate < service.StartDate)
        {
            errors[nameof(startDate)] =
                [$"La posición no puede empezar antes que el servicio, que inicia el {service.StartDate:dd/MM/yyyy}."];
        }

        if (service.EndDate is not { } finServicio)
        {
            return;
        }

        if (startDate > finServicio)
        {
            errors[nameof(startDate)] =
                [$"La posición no puede empezar después de que el servicio termina, el {finServicio:dd/MM/yyyy}."];
        }

        // Un puesto sin fin dentro de un servicio que sí lo tiene seguiría pidiendo gente el día
        // después de que el contrato acabó. No hace falta exigir la fecha como error: una petición
        // sin fecha de fin hereda la del servicio, así que aquí sólo puede llegar una que alguien
        // escribió a mano.
        if (endDate is { } finPosicion && finPosicion > finServicio)
        {
            errors[nameof(endDate)] =
                [$"La posición no puede terminar después que el servicio, que acaba el {finServicio:dd/MM/yyyy}."];
        }
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

    /// <summary>
    /// El perfil de la posición, ya resuelto contra el catálogo.
    ///
    /// <para>El equipo llega resuelto y no como una lista de identificadores porque la pantalla lo
    /// enseña por nombre, y pedirle que lo resuelva obligaría a que cada pantalla que muestre una
    /// posición cargara antes el catálogo entero de equipos.</para>
    /// </summary>
    /// <summary>
    /// Deja el equipo de la posición como dice la petición, sin borrar nada.
    ///
    /// <para><b>Retirar una pieza la desactiva, no la elimina</b>, y volver a pedirla reactiva la
    /// fila que ya estaba. Es la misma regla que rige en todo el sistema —los registros no se
    /// borran— y aquí además evita que el índice único choque: la pieza retirada sigue ocupando su
    /// sitio, así que insertar otra igual fallaría.</para>
    ///
    /// <para>Un <c>null</c> deja el equipo como estaba; una lista vacía lo retira entero. La
    /// diferencia importa porque una pantalla que edita sólo el precio no manda el equipo, y
    /// tratarlo como «vacío» le borraría lo que no venía a tocar.</para>
    /// </summary>
    private async Task SyncEquipmentAsync(
        Guid idOrganization,
        Position position,
        IReadOnlyList<Guid>? idCatalogItems,
        CancellationToken cancellationToken)
    {
        if (idCatalogItems is null)
        {
            return;
        }

        var pedidos = idCatalogItems.Distinct().ToArray();

        if (!await repository.AreEquipmentCatalogItemsUsableAsync(idOrganization, pedidos, cancellationToken))
        {
            throw new RequestValidationException(new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                ["idRequiredEquipmentCatalogItems"] =
                    ["Elige equipo activo del catálogo de equipo requerido."]
            });
        }

        var existentes = await repository.ListPositionEquipmentAsync(position.IdPosition, cancellationToken);

        foreach (var existente in existentes)
        {
            var sigue = pedidos.Contains(existente.IdEquipmentCatalogItem);

            if (sigue && !existente.Active)
            {
                existente.Activate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            }
            else if (!sigue && existente.Active)
            {
                existente.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            }
        }

        foreach (var nuevo in pedidos.Where(id => existentes.All(item => item.IdEquipmentCatalogItem != id)))
        {
            await repository.AddPositionEquipmentAsync(
                PositionRequiredEquipment.Create(
                    idOrganization, position.IdPosition, nuevo,
                    actorContext.ActorId, actorContext.ActorName, clock.UtcNow),
                cancellationToken);
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
            position.IdJobPositionCatalogItem,
            position.Notes,
            position.StartDate,
            position.EndDate,
            position.Active,
            position.Price,
            position.CurrencyCode,
            position.IsTaxIncluded,
            position.PriceFrequency,
            position.IdShiftPatternTemplate,
            position.IdSexCatalogItem,
            position.IdAgeRangeCatalogItem,
            position.IdEducationLevelCatalogItem,
            position.RequiredEquipment
                .Where(item => item.Active)
                .Select(item => new PositionEquipmentResponse(
                    item.IdEquipmentCatalogItem,
                    item.EquipmentCatalogItem?.Name ?? "Equipo no encontrado"))
                .ToArray());

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

