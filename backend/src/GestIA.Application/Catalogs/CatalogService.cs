using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Catalogs;

public sealed class CatalogService(
    ICatalogRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : ICatalogService
{
    public async Task<IReadOnlyList<CatalogItemResponse>> ListCatalogItemsAsync(
        Guid idOrganization,
        BusinessCatalogItemType? type,
        CancellationToken cancellationToken)
    {
        await EnsureOrganizationAsync(idOrganization, cancellationToken);
        var items = await repository.ListCatalogItemsAsync(idOrganization, type, cancellationToken);
        return items.Select(MapCatalogItem).ToArray();
    }

    public async Task<CatalogItemResponse> CreateCatalogItemAsync(
        CatalogItemInput request,
        CancellationToken cancellationToken)
    {
        await EnsureOrganizationAsync(request.IdOrganization, cancellationToken);
        var profile = ValidateCatalogProfile(request);
        await ValidateParentAsync(request, cancellationToken);
        await EnsureCatalogNameAvailableAsync(
            request.IdOrganization,
            profile.Type,
            profile.Name,
            profile.IdParentCatalogItem,
            null,
            cancellationToken);

        var item = BusinessCatalogItem.Create(
            request.IdOrganization,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        if (request.Active == false) item.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);

        await repository.AddCatalogItemAsync(item, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return MapCatalogItem(item);
    }

    public async Task<CatalogItemResponse> UpdateCatalogItemAsync(
        Guid idCatalogItem,
        CatalogItemInput request,
        CancellationToken cancellationToken)
    {
        await EnsureOrganizationAsync(request.IdOrganization, cancellationToken);
        var item = await repository.GetCatalogItemAsync(request.IdOrganization, idCatalogItem, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el catálogo solicitado.");
        if (request.Type != item.Type)
            throw new ResourceConflictException("El tipo de un valor existente no puede cambiarse.");
        if (item.Type is BusinessCatalogItemType.State or BusinessCatalogItemType.City &&
            !string.Equals(request.Name?.Trim(), item.Name, StringComparison.Ordinal))
            throw new ResourceConflictException("El nombre geografico esta vinculado a domicilios y no puede cambiarse.");
        var profile = ValidateCatalogProfile(request, item);
        if (request.IdParentCatalogItem != item.IdParentCatalogItem)
            throw new ResourceConflictException("La relacion geografica existente no puede cambiarse; crea otro valor.");
        if (request.Active != false) await ValidateParentAsync(request, cancellationToken, item.IdBusinessCatalogItem);
        await EnsureCatalogNameAvailableAsync(
            request.IdOrganization,
            profile.Type,
            profile.Name,
            profile.IdParentCatalogItem,
            idCatalogItem,
            cancellationToken);

        item.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        if (request.Active.HasValue && request.Active.Value != item.Active)
        {
            if (request.Active.Value) item.Activate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
            else item.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        }
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return MapCatalogItem(item);
    }

    public async Task DeactivateCatalogItemAsync(
        Guid idOrganization,
        Guid idCatalogItem,
        CancellationToken cancellationToken)
    {
        var item = await repository.GetCatalogItemAsync(idOrganization, idCatalogItem, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el catálogo solicitado.");
        item.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EligibilityRequirementResponse>> ListEligibilityRequirementsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        await EnsureOrganizationAsync(idOrganization, cancellationToken);
        var requirements = await repository.ListEligibilityRequirementsAsync(idOrganization, cancellationToken);
        return requirements.Select(MapRequirement).ToArray();
    }

    public async Task<EligibilityRequirementResponse> CreateEligibilityRequirementAsync(
        EligibilityRequirementInput request,
        CancellationToken cancellationToken)
    {
        await ValidateRequirementTargetAsync(request, cancellationToken);
        var profile = ValidateRequirementProfile(request);
        var requirement = EligibilityRequirement.Create(
            request.IdOrganization,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddEligibilityRequirementAsync(requirement, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return MapRequirement(
            await repository.GetEligibilityRequirementAsync(
                request.IdOrganization,
                requirement.IdEligibilityRequirement,
                cancellationToken) ?? requirement);
    }

    public async Task<EligibilityRequirementResponse> UpdateEligibilityRequirementAsync(
        Guid idEligibilityRequirement,
        EligibilityRequirementInput request,
        CancellationToken cancellationToken)
    {
        await ValidateRequirementTargetAsync(request, cancellationToken);
        var requirement = await repository.GetEligibilityRequirementAsync(
                request.IdOrganization,
                idEligibilityRequirement,
                cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la regla de elegibilidad.");
        var profile = ValidateRequirementProfile(request);
        requirement.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return MapRequirement(
            await repository.GetEligibilityRequirementAsync(
                request.IdOrganization,
                idEligibilityRequirement,
                cancellationToken) ?? requirement);
    }

    public async Task DeactivateEligibilityRequirementAsync(
        Guid idOrganization,
        Guid idEligibilityRequirement,
        CancellationToken cancellationToken)
    {
        var requirement = await repository.GetEligibilityRequirementAsync(
                idOrganization,
                idEligibilityRequirement,
                cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la regla de elegibilidad.");
        requirement.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EmployeeSkillResponse>> ListEmployeeSkillsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var skills = await repository.ListEmployeeSkillsAsync(idOrganization, idEmployee, cancellationToken);
        return skills.Select(MapEmployeeSkill).ToArray();
    }

    public async Task<EmployeeSkillResponse> CreateEmployeeSkillAsync(
        EmployeeSkillInput request,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        await EnsureSkillCatalogItemAsync(request.IdOrganization, request.IdSkillCatalogItem, cancellationToken);
        var profile = ValidateEmployeeSkillProfile(request);
        var skill = EmployeeSkill.Create(
            request.IdOrganization,
            request.IdEmployee,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddEmployeeSkillAsync(skill, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return MapEmployeeSkill(
            await repository.GetEmployeeSkillAsync(
                request.IdOrganization,
                request.IdEmployee,
                skill.IdEmployeeSkill,
                cancellationToken) ?? skill);
    }

    public async Task<EmployeeSkillResponse> UpdateEmployeeSkillAsync(
        Guid idEmployeeSkill,
        EmployeeSkillInput request,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        await EnsureSkillCatalogItemAsync(request.IdOrganization, request.IdSkillCatalogItem, cancellationToken);
        var skill = await repository.GetEmployeeSkillAsync(
                request.IdOrganization,
                request.IdEmployee,
                idEmployeeSkill,
                cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la experiencia del empleado.");
        skill.UpdateProfile(
            ValidateEmployeeSkillProfile(request),
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return MapEmployeeSkill(
            await repository.GetEmployeeSkillAsync(
                request.IdOrganization,
                request.IdEmployee,
                idEmployeeSkill,
                cancellationToken) ?? skill);
    }

    public async Task DeactivateEmployeeSkillAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idEmployeeSkill,
        CancellationToken cancellationToken)
    {
        var skill = await repository.GetEmployeeSkillAsync(
                idOrganization,
                idEmployee,
                idEmployeeSkill,
                cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la experiencia del empleado.");
        skill.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<EligibilityCheckResponse> CheckEligibilityAsync(
        EligibilityCheckQuery query,
        CancellationToken cancellationToken)
    {
        var employee = await EnsureEmployeeAsync(query.IdOrganization, query.IdEmployee, cancellationToken);
        var context = await ResolveEligibilityContextAsync(query, cancellationToken);
        var reasons = await EvaluateEligibilityAsync(
            employee,
            context.IdClient,
            context.IdService,
            context.IdPosition,
            query.ReferenceDate,
            cancellationToken);

        return new EligibilityCheckResponse(
            employee.IdEmployee,
            employee.CodeEmployee,
            employee.FullName,
            reasons.All(reason => reason.Passed || !reason.IsBlocking),
            reasons);
    }

    /// <summary>
    /// Elegibilidad de varias personas contra el mismo contexto.
    ///
    /// <para>El contexto —cliente, servicio y posición— se resuelve <b>una vez</b>: es la posición
    /// la que pide los requisitos, y es la misma para toda la lista. Lo que sí se evalúa persona a
    /// persona son sus documentos, su experiencia y sus evaluaciones, que es de lo que trata la
    /// pregunta.</para>
    ///
    /// <para>Los identificadores repetidos se colapsan y el orden de la respuesta es el de la
    /// petición, para que quien la pidió pueda emparejar sin buscar. Una persona que no exista en
    /// la organización <b>se omite</b> en vez de tumbar la consulta entera: el selector prefiere
    /// enseñar nueve candidatos comprobados a no enseñar ninguno porque el décimo se dio de baja
    /// entre la carga de la pantalla y el clic.</para>
    /// </summary>
    public async Task<IReadOnlyList<EligibilityCheckResponse>> CheckEligibilityBatchAsync(
        EligibilityBatchQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        // Sin fecha, el día operativo. La decide aquí y no el endpoint: qué día es «hoy» para la
        // operación es una regla del sistema, no de la capa que recibe la petición.
        var referenceDate = query.ReferenceDate ?? clock.Today;

        var context = await ResolveEligibilityContextAsync(
            new EligibilityCheckQuery(
                query.IdOrganization,
                Guid.Empty,
                query.IdClient,
                query.IdService,
                query.IdPosition,
                referenceDate),
            cancellationToken);

        var results = new List<EligibilityCheckResponse>();

        foreach (var idEmployee in query.IdEmployees.Distinct())
        {
            Employee employee;

            try
            {
                employee = await EnsureEmployeeAsync(query.IdOrganization, idEmployee, cancellationToken);
            }
            catch (ResourceNotFoundException)
            {
                continue;
            }

            var reasons = await EvaluateEligibilityAsync(
                employee,
                context.IdClient,
                context.IdService,
                context.IdPosition,
                referenceDate,
                cancellationToken);

            results.Add(new EligibilityCheckResponse(
                employee.IdEmployee,
                employee.CodeEmployee,
                employee.FullName,
                reasons.All(reason => reason.Passed || !reason.IsBlocking),
                reasons));
        }

        return results;
    }

    public async Task<IReadOnlyList<EligibilityReasonResponse>> EvaluateEligibilityAsync(
        Employee employee,
        Guid? idClient,
        Guid? idService,
        Guid? idPosition,
        DateOnly referenceDate,
        CancellationToken cancellationToken)
    {
        var reasons = new List<EligibilityReasonResponse>();

        if (employee.Status != EmployeeStatus.Active)
        {
            reasons.Add(new EligibilityReasonResponse(
                "Empleado",
                "Estatus activo",
                true,
                false,
                $"El empleado tiene estatus {employee.Status}."));
        }

        var requirements = (await repository.ListEligibilityRequirementsAsync(employee.IdOrganization, cancellationToken))
            .Where(requirement =>
                requirement.Active &&
                (requirement.TargetType == EligibilityRequirementTargetType.Organization ||
                 (idClient.HasValue && requirement.IdClient == idClient.Value) ||
                 (idService.HasValue && requirement.IdService == idService.Value) ||
                 (idPosition.HasValue && requirement.IdPosition == idPosition.Value)))
            .ToArray();
        var skills = await repository.ListEmployeeSkillsAsync(employee.IdOrganization, employee.IdEmployee, cancellationToken);
        var documents = await repository.ListEmployeeDocumentsAsync(employee.IdEmployee, cancellationToken);
        var evaluations = await repository.ListEmployeeEvaluationsAsync(employee.IdEmployee, cancellationToken);
        var incidents = await repository.ListActiveAdministrativeIncidentsAsync(
            employee.IdOrganization, employee.IdEmployee, cancellationToken);

        foreach (var requirement in requirements)
        {
            reasons.Add(EvaluateRequirement(requirement, skills, documents, evaluations, referenceDate));
        }

        // Las incidencias van aparte del bucle de reglas, y no es un detalle de organización del
        // código: es que no son la misma clase de cosa.
        //
        // Una regla de elegibilidad pregunta «¿tiene esto?» y se cumple teniéndolo. Una incidencia
        // administrativa no se cumple: es un hecho en contra, y no hay nada que la persona pueda
        // «tener» para satisfacerla. Meterla como un quinto tipo de regla habría obligado a
        // inventar una regla por cada incidencia registrada, y a que el administrador creara una
        // regla para que su acta significara algo.
        reasons.AddRange(incidents.Select(EvaluateIncident));

        if (reasons.Count == 0)
        {
            reasons.Add(new EligibilityReasonResponse(
                "General",
                "Reglas configuradas",
                false,
                true,
                "No hay reglas configuradas ni incidencias activas que bloqueen al empleado."));
        }

        return reasons;
    }

    /// <summary>
    /// Una incidencia administrativa activa, leída como motivo de elegibilidad.
    ///
    /// <para><b>Siempre sale con <c>Passed</c> en falso</b>, y eso es lo correcto aunque parezca
    /// raro: el motivo no es «le falta algo», es «pasó algo». Lo que decide si además detiene la
    /// operación es la marca de su tipo en el catálogo. Una informativa queda entonces como un
    /// motivo no cumplido que no bloquea, que es exactamente lo que pide RN-PER-003: deja
    /// constancia y no impide operar.</para>
    ///
    /// <para><b>Sin alcance, por decisión.</b> Una incidencia bloquea en todas partes: no distingue
    /// cliente, servicio ni posición. Si alguien abandonó el puesto, no lo abandonó sólo para un
    /// cliente. Acotarlo más tarde es agregar un filtro; desacotarlo más tarde sería quitar una
    /// protección que ya estaba puesta, y por eso se empieza por el alcance amplio. Si negocio
    /// decide lo contrario, lo que cambia es una columna de alcance en <c>AdministrativeIncident</c>
    /// y esta comprobación.</para>
    /// </summary>
    private static EligibilityReasonResponse EvaluateIncident(AdministrativeIncident incident)
    {
        var tipo = incident.IncidentTypeCatalogItem?.Name ?? "Incidencia administrativa";
        var bloquea = incident.IncidentTypeCatalogItem?.IsBlocking ?? false;

        return new EligibilityReasonResponse(
            "Expediente",
            tipo,
            bloquea,
            false,
            // El tipo y la fecha, no «tiene una incidencia». Quien lee esto tiene que poder ir al
            // expediente y encontrar cuál es sin buscarla una por una.
            bloquea
                ? $"Incidencia administrativa activa: {tipo}, del {incident.OccurredDate:dd/MM/yyyy}. Impide asignar mientras no se retire."
                : $"Incidencia administrativa activa: {tipo}, del {incident.OccurredDate:dd/MM/yyyy}. Queda constancia y no impide asignar.");
    }

    private static EligibilityReasonResponse EvaluateRequirement(
        EligibilityRequirement requirement,
        IReadOnlyList<EmployeeSkill> skills,
        IReadOnlyList<EmployeeDocument> documents,
        IReadOnlyList<EmployeeEvaluation> evaluations,
        DateOnly referenceDate) =>
        requirement.RequirementType switch
        {
            EligibilityRequirementType.Skill => EvaluateSkill(requirement, skills, referenceDate),
            EligibilityRequirementType.Document => EvaluateDocument(requirement, documents, referenceDate),
            EligibilityRequirementType.Evaluation => EvaluateEvaluation(requirement, evaluations, referenceDate),
            EligibilityRequirementType.Restriction => new EligibilityReasonResponse(
                ScopeLabel(requirement),
                requirement.Name,
                Severity(requirement),
                false,
                requirement.Description ?? "Restricción configurada para este alcance."),
            _ => new EligibilityReasonResponse(ScopeLabel(requirement), requirement.Name, Severity(requirement), false, "Tipo de regla no soportado.")
        };

    /// <summary>
    /// Si incumplir la regla bloquea. <b>Lo dice el catálogo, y sólo el catálogo.</b>
    ///
    /// <para>Hasta el 19 de septiembre de 2026 la regla podía afinar la marca del catálogo, y eso
    /// permitía configurar el mismo requisito como bloqueante en un sitio e informativo en otro.
    /// Nadie lo había hecho —ninguna entrada del catálogo tenía dos severidades entre sus reglas—,
    /// pero el modelo lo consentía, y una contradicción que el sistema permite acaba ocurriendo.
    /// RF-POS-010 pidió una sola fuente y ésta es: el catálogo dice <b>qué tan grave</b>, la regla
    /// dice <b>a quién aplica</b>.</para>
    ///
    /// <para>La marca que las reglas tenían no se perdió: la migración de la retrocarga la copió a
    /// su entrada del catálogo antes de que esto dejara de leerla, porque sin ese paso las trece
    /// reglas que bloqueaban habrían pasado a informativas el día del despliegue.</para>
    ///
    /// <para>Cerrar en <c>false</c> cuando el catálogo calla sigue siendo deliberado: una entrada
    /// sin marca todavía no se ha decidido, y estrenar impidiendo asignar a todo el mundo sería
    /// peor que dejar constancia hasta que alguien la marque.</para>
    ///
    /// <para><b>La restricción es la excepción, y no por comodidad.</b> Una regla de tipo
    /// <c>Restriction</c> no exige nada: prohíbe, y por eso no apunta a ninguna entrada del
    /// catálogo. Si heredara de un catálogo que no tiene, quedaría informativa siempre, y una
    /// prohibición que no prohíbe es una nota. Se resuelve por lo que la regla <i>es</i>, no por
    /// una marca que alguien puso: no hay dos fuentes que se puedan contradecir, que es lo que
    /// RF-POS-010 vino a evitar.</para>
    /// </summary>
    private static bool Severity(EligibilityRequirement requirement) =>
        requirement.RequirementType is EligibilityRequirementType.Restriction
        || (requirement.RequiredCatalogItem?.IsBlocking ?? false);

    private static EligibilityReasonResponse EvaluateSkill(
        EligibilityRequirement requirement,
        IReadOnlyList<EmployeeSkill> skills,
        DateOnly referenceDate)
    {
        // Por identificador y no por texto: es exactamente la fila del catalogo que la regla
        // exige, sin que dos valores parecidos puedan confundirse.
        var skill = skills.FirstOrDefault(item =>
            item.Active &&
            item.IdSkillCatalogItem == requirement.IdRequiredCatalogItem &&
            (!item.ExpiresDate.HasValue || item.ExpiresDate.Value >= referenceDate));

        return new EligibilityReasonResponse(
            ScopeLabel(requirement),
            requirement.Name,
            Severity(requirement),
            skill is not null,
            skill is not null
                ? $"Cuenta con experiencia {skill.SkillCatalogItem.Name}."
                : $"Falta experiencia requerida: {requirement.RequiredCatalogItem?.Name ?? requirement.Name}.");
    }

    private static EligibilityReasonResponse EvaluateDocument(
        EligibilityRequirement requirement,
        IReadOnlyList<EmployeeDocument> documents,
        DateOnly referenceDate)
    {
        // Por identificador del catálogo, igual que la experiencia. El enum sigue comparándose como
        // respaldo para las filas que la conversión todavía no emparejó: sin él, un documento
        // anterior dejaría de cubrir un requisito que sí cubre.
        var document = documents.FirstOrDefault(item =>
            item.Active &&
            (item.IdDocumentCategoryCatalogItem.HasValue
                ? item.IdDocumentCategoryCatalogItem == requirement.IdRequiredCatalogItem
                : item.DocumentType == requirement.RequiredDocumentType) &&
            (item.Status is EmployeeDocumentStatus.Validated or EmployeeDocumentStatus.Received) &&
            (!item.ExpiresDate.HasValue || item.ExpiresDate.Value >= referenceDate));

        return new EligibilityReasonResponse(
            ScopeLabel(requirement),
            requirement.Name,
            Severity(requirement),
            document is not null,
            document is not null
                ? $"Documento vigente: {requirement.RequiredCatalogItem?.Name ?? requirement.Name}."
                : $"Falta documento vigente o validado: {requirement.RequiredCatalogItem?.Name ?? requirement.Name}.");
    }

    private static EligibilityReasonResponse EvaluateEvaluation(
        EligibilityRequirement requirement,
        IReadOnlyList<EmployeeEvaluation> evaluations,
        DateOnly referenceDate)
    {
        var evaluation = evaluations.FirstOrDefault(item =>
            item.Active &&
            (item.IdEvaluationCategoryCatalogItem.HasValue
                ? item.IdEvaluationCategoryCatalogItem == requirement.IdRequiredCatalogItem
                : item.EvaluationType == requirement.RequiredEvaluationType) &&
            (item.Result is EmployeeEvaluationResult.Approved or EmployeeEvaluationResult.ApprovedWithObservations) &&
            (!item.ExpiresDate.HasValue || item.ExpiresDate.Value >= referenceDate));

        return new EligibilityReasonResponse(
            ScopeLabel(requirement),
            requirement.Name,
            Severity(requirement),
            evaluation is not null,
            evaluation is not null
                ? $"Evaluación aprobada: {requirement.RequiredCatalogItem?.Name ?? requirement.Name}."
                : $"Falta evaluación aprobada/vigente: {requirement.RequiredCatalogItem?.Name ?? requirement.Name}.");
    }

    private async Task<(Guid? IdClient, Guid? IdService, Guid? IdPosition)> ResolveEligibilityContextAsync(
        EligibilityCheckQuery query,
        CancellationToken cancellationToken)
    {
        if (query.IdPosition.HasValue)
        {
            var position = await repository.GetPositionAsync(query.IdOrganization, query.IdPosition.Value, cancellationToken)
                ?? throw new ResourceNotFoundException("No se encontró la posición.");
            return (position.Service.IdClient, position.IdService, position.IdPosition);
        }

        if (query.IdService.HasValue)
        {
            var service = await repository.GetServiceAsync(query.IdOrganization, query.IdService.Value, cancellationToken)
                ?? throw new ResourceNotFoundException("No se encontró el servicio.");
            return (service.IdClient, service.IdService, null);
        }

        if (query.IdClient.HasValue)
        {
            await EnsureClientAsync(query.IdOrganization, query.IdClient.Value, cancellationToken);
            return (query.IdClient.Value, null, null);
        }

        return (null, null, null);
    }

    private async Task ValidateRequirementTargetAsync(
        EligibilityRequirementInput request,
        CancellationToken cancellationToken)
    {
        await EnsureOrganizationAsync(request.IdOrganization, cancellationToken);

        if (request.TargetType == EligibilityRequirementTargetType.Client && request.IdClient.HasValue)
        {
            await EnsureClientAsync(request.IdOrganization, request.IdClient.Value, cancellationToken);
        }
        else if (request.TargetType == EligibilityRequirementTargetType.Service && request.IdService.HasValue)
        {
            await EnsureServiceAsync(request.IdOrganization, request.IdService.Value, cancellationToken);
        }
        else if (request.TargetType == EligibilityRequirementTargetType.Position && request.IdPosition.HasValue)
        {
            await EnsurePositionAsync(request.IdOrganization, request.IdPosition.Value, cancellationToken);
        }
    }

    private async Task EnsureOrganizationAsync(Guid idOrganization, CancellationToken cancellationToken)
    {
        if (idOrganization == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idOrganization)] = ["La organización es obligatoria."]
            });
        }

        if (!await repository.OrganizationExistsAsync(idOrganization, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró la organización.");
        }
    }

    private async Task<Employee> EnsureEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        if (idEmployee == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idEmployee)] = ["El empleado es obligatorio."]
            });
        }

        return await repository.GetEmployeeAsync(idOrganization, idEmployee, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el empleado.");
    }

    private async Task EnsureClientAsync(Guid idOrganization, Guid idClient, CancellationToken cancellationToken)
    {
        if (await repository.GetClientAsync(idOrganization, idClient, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el cliente.");
        }
    }

    private async Task EnsureServiceAsync(Guid idOrganization, Guid idService, CancellationToken cancellationToken)
    {
        if (await repository.GetServiceAsync(idOrganization, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio.");
        }
    }

    private async Task EnsurePositionAsync(Guid idOrganization, Guid idPosition, CancellationToken cancellationToken)
    {
        if (await repository.GetPositionAsync(idOrganization, idPosition, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró la posición.");
        }
    }

    public async Task EnsureJobPositionCatalogItemAsync(
        Guid idOrganization,
        Guid idCatalogItem,
        CancellationToken cancellationToken)
    {
        var item = await repository.GetCatalogItemAsync(idOrganization, idCatalogItem, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el puesto seleccionado.");

        if (item.Type != BusinessCatalogItemType.JobPosition || !item.Active)
        {
            throw new ResourceConflictException("El catálogo seleccionado no es un puesto activo.");
        }
    }

    private async Task EnsureSkillCatalogItemAsync(
        Guid idOrganization,
        Guid idSkillCatalogItem,
        CancellationToken cancellationToken)
    {
        var item = await repository.GetCatalogItemAsync(idOrganization, idSkillCatalogItem, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la experiencia seleccionada.");

        if (item.Type != BusinessCatalogItemType.Skill || !item.Active)
        {
            throw new ResourceConflictException("El catálogo seleccionado no es una experiencia.");
        }
    }

    /// <summary>
    /// Que no haya ya un valor con el mismo nombre plegado bajo el mismo padre.
    ///
    /// <para><b>Quien de verdad lo impide es el indice unico de la base</b>, no esta comprobacion:
    /// dos peticiones a la vez la esquivarian. Esto existe para responder con un mensaje que se
    /// entiende, y el mensaje dice lo del borrado logico porque es la pregunta que sigue: aqui los
    /// registros no se borran, asi que desactivar un valor no libera su nombre.</para>
    /// </summary>
    private async Task EnsureCatalogNameAvailableAsync(
        Guid idOrganization,
        BusinessCatalogItemType type,
        string name,
        Guid? idParentCatalogItem,
        Guid? excludedId,
        CancellationToken cancellationToken)
    {
        var plegado = CatalogName.Normalize(name);

        if (await repository.CatalogNameExistsAsync(idOrganization, type, plegado, idParentCatalogItem, excludedId, cancellationToken))
        {
            throw new ResourceConflictException(
                $"Ya existe «{name.Trim()}» en este catálogo, aunque esté inactivo: aquí los " +
                "registros no se borran, así que su nombre sigue ocupado.");
        }
    }

    private static BusinessCatalogItemProfile ValidateCatalogProfile(CatalogItemInput request, BusinessCatalogItem? existing = null)
    {
        var errors = new Dictionary<string, string[]>();
        var name = InputValidation.Required(request.Name, nameof(request.Name), 160, errors);
        var description = InputValidation.Optional(request.Description, nameof(request.Description), 1000, errors);
        if (request.Type is BusinessCatalogItemType.State or BusinessCatalogItemType.City or BusinessCatalogItemType.JobPosition or BusinessCatalogItemType.CoverageReason && name.Length > 120)
            errors[nameof(request.Name)] = ["El nombre admite hasta 120 caracteres."];
        if (request.Type == BusinessCatalogItemType.Nationality && name.Length > 80)
            errors[nameof(request.Name)] = ["La nacionalidad admite hasta 80 caracteres."];
        if (!Enum.IsDefined(request.Type)) errors[nameof(request.Type)] = ["Selecciona un catalogo del sistema."];
        var order = request.Order ?? existing?.Order ?? 1;
        if (order < 1 || order > 100000) errors[nameof(request.Order)] = ["El orden debe estar entre 1 y 100000."];

        // La marca de bloqueo sólo la admiten los cuatro catálogos de la elegibilidad. Se avisa aquí
        // en vez de dejar que la entidad lance, porque desde aquí sale un 400 que nombra el campo y
        // desde allá saldría un error de argumento.
        var admiteMarca = BusinessCatalogItem.SupportsBlockingMark(request.Type);
        if (request.IsBlocking.HasValue && !admiteMarca)
        {
            errors[nameof(request.IsBlocking)] =
                ["Este catálogo no participa en la elegibilidad, así que no lleva marca de bloqueo."];
        }

        InputValidation.ThrowIfInvalid(errors);

        // Al editar sin mandar la marca se conserva la que tenía: una pantalla que sólo corrige el
        // nombre no debería convertir en informativa una entrada bloqueante.
        var isBlocking = admiteMarca ? request.IsBlocking ?? existing?.IsBlocking : null;
        return new BusinessCatalogItemProfile(request.Type, name, description, order, request.IdParentCatalogItem, isBlocking);
    }

    /// <summary>
    /// De qué tipo tiene que ser el padre de cada catálogo, y si es obligatorio tenerlo.
    ///
    /// <para>La geografía lo exige: un estado sin país y un municipio sin estado no significan nada.
    /// El grupo del tipo de documento <b>no</b>: agrupar es una comodidad, y obligar a crear
    /// «Identidad» antes de poder registrar «INE» invertiría el orden en que se trabaja.</para>
    /// </summary>
    private static readonly Dictionary<BusinessCatalogItemType, (BusinessCatalogItemType Parent, bool Required)> ParentRules =
        new()
        {
            [BusinessCatalogItemType.State] = (BusinessCatalogItemType.Country, true),
            [BusinessCatalogItemType.City] = (BusinessCatalogItemType.State, true),
            [BusinessCatalogItemType.EmployeeDocumentCategory] = (BusinessCatalogItemType.EmployeeDocumentGroup, false)
        };

    private async Task ValidateParentAsync(CatalogItemInput request, CancellationToken token, Guid? excludedId = null)
    {
        var tieneRegla = ParentRules.TryGetValue(request.Type, out var rule);
        BusinessCatalogItemType? expected = tieneRegla ? rule.Parent : null;
        var required = tieneRegla && rule.Required;

        if (expected is null && request.IdParentCatalogItem is null) return;
        if (expected is null)
            throw new ResourceConflictException("Este catalogo no cuelga de ningun otro.");
        if (request.IdParentCatalogItem is null)
        {
            if (!required) return;
            throw new ResourceConflictException("Selecciona la relacion geografica correspondiente.");
        }
        var parent = await repository.GetCatalogItemAsync(request.IdOrganization, request.IdParentCatalogItem.Value, token);
        if (parent is null || !parent.Active || parent.Type != expected)
            throw new ResourceConflictException("El valor del que cuelga debe estar activo y pertenecer a la misma organizacion.");
        var siblings = await repository.ListCatalogItemsAsync(request.IdOrganization, request.Type, token);
        if (siblings.Any(item => item.IdBusinessCatalogItem != excludedId && item.IdParentCatalogItem == request.IdParentCatalogItem &&
            string.Equals(item.Name, request.Name?.Trim(), StringComparison.OrdinalIgnoreCase)))
            throw new ResourceConflictException("Ya existe ese nombre dentro del valor seleccionado.");
        if (parent.IdParentCatalogItem is { } grandparentId)
        {
            var grandparent = await repository.GetCatalogItemAsync(request.IdOrganization, grandparentId, token);
            if (grandparent is null || !grandparent.Active) throw new ResourceConflictException("El pais no esta activo.");
        }
    }

    private static EligibilityRequirementProfile ValidateRequirementProfile(EligibilityRequirementInput request)
    {
        var errors = new Dictionary<string, string[]>();
        var name = InputValidation.Required(request.Name, nameof(request.Name), 160, errors);

        // Se dice aqui, con el nombre del campo que falta, para que el formulario pueda senalarlo.
        // La entidad lo vuelve a comprobar y la base lo garantiza con una restriccion.
        switch (request.RequirementType)
        {
            case EligibilityRequirementType.Skill when request.IdRequiredCatalogItem is null:
                errors[nameof(request.IdRequiredCatalogItem)] = ["Elige la experiencia que la regla exige."];
                break;
            case EligibilityRequirementType.Document when request.RequiredDocumentType is null:
                errors[nameof(request.RequiredDocumentType)] = ["Elige el tipo de documento que la regla exige."];
                break;
            case EligibilityRequirementType.Evaluation when request.RequiredEvaluationType is null:
                errors[nameof(request.RequiredEvaluationType)] = ["Elige el tipo de evaluación que la regla exige."];
                break;
            default:
                break;
        }

        var description = InputValidation.Optional(request.Description, nameof(request.Description), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);
        return new EligibilityRequirementProfile(
            request.TargetType,
            request.IdClient,
            request.IdService,
            request.IdPosition,
            request.RequirementType,
            request.IdRequiredCatalogItem,
            request.RequiredDocumentType,
            request.RequiredEvaluationType,
            name,
            description);
    }

    private static EmployeeSkillProfile ValidateEmployeeSkillProfile(EmployeeSkillInput request)
    {
        var errors = new Dictionary<string, string[]>();
        var notes = InputValidation.Optional(request.Notes, nameof(request.Notes), 1000, errors);

        if (request.IdSkillCatalogItem == Guid.Empty)
        {
            errors[nameof(request.IdSkillCatalogItem)] = ["La experiencia es obligatoria."];
        }

        if (request.ExpiresDate < request.AcquiredDate)
        {
            errors[nameof(request.ExpiresDate)] = ["La fecha de vencimiento no puede ser menor que la fecha de obtención."];
        }

        InputValidation.ThrowIfInvalid(errors);
        return new EmployeeSkillProfile(request.IdSkillCatalogItem, request.AcquiredDate, request.ExpiresDate, notes);
    }

    private static CatalogItemResponse MapCatalogItem(BusinessCatalogItem item) =>
        new(item.IdBusinessCatalogItem, item.IdOrganization, item.Type, item.Name, item.Description, item.Active,
            item.Order, item.UpdatedAt ?? item.CreatedAt, item.IdParentCatalogItem,
            item.IsBlocking, BusinessCatalogItem.SupportsBlockingMark(item.Type));

    private static EligibilityRequirementResponse MapRequirement(EligibilityRequirement requirement) =>
        new(
            requirement.IdEligibilityRequirement,
            requirement.IdOrganization,
            requirement.TargetType,
            requirement.IdClient,
            requirement.Client?.TradeName ?? requirement.Client?.LegalName,
            requirement.IdService,
            requirement.Service?.Name,
            requirement.IdPosition,
            requirement.Position?.Name,
            requirement.RequirementType,
            requirement.IdRequiredCatalogItem,
            requirement.RequiredCatalogItem?.Name,
            requirement.RequiredDocumentType,
            requirement.RequiredEvaluationType,
            requirement.Name,
            requirement.Description,
            Severity(requirement),
            requirement.Active);

    private static EmployeeSkillResponse MapEmployeeSkill(EmployeeSkill skill) =>
        new(
            skill.IdEmployeeSkill,
            skill.IdEmployee,
            skill.IdSkillCatalogItem,
            skill.SkillCatalogItem.Name,
            skill.AcquiredDate,
            skill.ExpiresDate,
            skill.Notes,
            skill.Active);

    private static string ScopeLabel(EligibilityRequirement requirement) =>
        requirement.TargetType switch
        {
            EligibilityRequirementTargetType.Organization => "Organización",
            EligibilityRequirementTargetType.Client => "Cliente",
            EligibilityRequirementTargetType.Service => "Servicio",
            EligibilityRequirementTargetType.Position => "Posición",
            _ => "General"
        };
}
