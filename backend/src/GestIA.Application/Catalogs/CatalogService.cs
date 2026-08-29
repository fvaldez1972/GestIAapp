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
        await EnsureCatalogCodeAvailableAsync(
            request.IdOrganization,
            profile.Type,
            profile.Code,
            null,
            cancellationToken);

        var item = BusinessCatalogItem.Create(
            request.IdOrganization,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

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
        var profile = ValidateCatalogProfile(request);
        await EnsureCatalogCodeAvailableAsync(
            request.IdOrganization,
            profile.Type,
            profile.Code,
            idCatalogItem,
            cancellationToken);

        item.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
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
            ?? throw new ResourceNotFoundException("No se encontró la habilidad del empleado.");
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
            ?? throw new ResourceNotFoundException("No se encontró la habilidad del empleado.");
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

        foreach (var requirement in requirements)
        {
            reasons.Add(EvaluateRequirement(requirement, skills, documents, evaluations, referenceDate));
        }

        if (reasons.Count == 0)
        {
            reasons.Add(new EligibilityReasonResponse(
                "General",
                "Reglas configuradas",
                false,
                true,
                "No hay reglas configuradas que bloqueen al empleado."));
        }

        return reasons;
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
                requirement.IsBlocking,
                false,
                requirement.Description ?? "Restricción configurada para este alcance."),
            _ => new EligibilityReasonResponse(ScopeLabel(requirement), requirement.Name, requirement.IsBlocking, false, "Tipo de regla no soportado.")
        };

    private static EligibilityReasonResponse EvaluateSkill(
        EligibilityRequirement requirement,
        IReadOnlyList<EmployeeSkill> skills,
        DateOnly referenceDate)
    {
        var skill = skills.FirstOrDefault(item =>
            item.Active &&
            item.SkillCatalogItem.Code.Equals(requirement.RequiredCode, StringComparison.OrdinalIgnoreCase) &&
            (!item.ExpiresDate.HasValue || item.ExpiresDate.Value >= referenceDate));

        return new EligibilityReasonResponse(
            ScopeLabel(requirement),
            requirement.Name,
            requirement.IsBlocking,
            skill is not null,
            skill is not null
                ? $"Cuenta con habilidad {skill.SkillCatalogItem.Name}."
                : $"Falta habilidad requerida: {requirement.RequiredCode}.");
    }

    private static EligibilityReasonResponse EvaluateDocument(
        EligibilityRequirement requirement,
        IReadOnlyList<EmployeeDocument> documents,
        DateOnly referenceDate)
    {
        var document = documents.FirstOrDefault(item =>
            item.Active &&
            item.DocumentType.ToString().Equals(requirement.RequiredCode, StringComparison.OrdinalIgnoreCase) &&
            (item.Status is EmployeeDocumentStatus.Validated or EmployeeDocumentStatus.Received) &&
            (!item.ExpiresDate.HasValue || item.ExpiresDate.Value >= referenceDate));

        return new EligibilityReasonResponse(
            ScopeLabel(requirement),
            requirement.Name,
            requirement.IsBlocking,
            document is not null,
            document is not null
                ? $"Documento vigente: {document.DocumentType}."
                : $"Falta documento vigente o validado: {requirement.RequiredCode}.");
    }

    private static EligibilityReasonResponse EvaluateEvaluation(
        EligibilityRequirement requirement,
        IReadOnlyList<EmployeeEvaluation> evaluations,
        DateOnly referenceDate)
    {
        var evaluation = evaluations.FirstOrDefault(item =>
            item.Active &&
            item.EvaluationType.ToString().Equals(requirement.RequiredCode, StringComparison.OrdinalIgnoreCase) &&
            (item.Result is EmployeeEvaluationResult.Approved or EmployeeEvaluationResult.ApprovedWithObservations) &&
            (!item.ExpiresDate.HasValue || item.ExpiresDate.Value >= referenceDate));

        return new EligibilityReasonResponse(
            ScopeLabel(requirement),
            requirement.Name,
            requirement.IsBlocking,
            evaluation is not null,
            evaluation is not null
                ? $"Evaluación aprobada: {evaluation.EvaluationType}."
                : $"Falta evaluación aprobada/vigente: {requirement.RequiredCode}.");
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

    private async Task EnsureSkillCatalogItemAsync(
        Guid idOrganization,
        Guid idSkillCatalogItem,
        CancellationToken cancellationToken)
    {
        var item = await repository.GetCatalogItemAsync(idOrganization, idSkillCatalogItem, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la habilidad seleccionada.");

        if (item.Type != BusinessCatalogItemType.Skill)
        {
            throw new ResourceConflictException("El catálogo seleccionado no es una habilidad.");
        }
    }

    private async Task EnsureCatalogCodeAvailableAsync(
        Guid idOrganization,
        BusinessCatalogItemType type,
        string code,
        Guid? excludedId,
        CancellationToken cancellationToken)
    {
        if (await repository.CatalogCodeExistsAsync(idOrganization, type, code, excludedId, cancellationToken))
        {
            throw new ResourceConflictException("Ya existe un catálogo con esa clave para el mismo tipo.");
        }
    }

    private static BusinessCatalogItemProfile ValidateCatalogProfile(CatalogItemInput request)
    {
        var errors = new Dictionary<string, string[]>();
        var code = InputValidation.Required(request.Code, nameof(request.Code), 80, errors);
        var name = InputValidation.Required(request.Name, nameof(request.Name), 160, errors);
        var description = InputValidation.Optional(request.Description, nameof(request.Description), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);
        return new BusinessCatalogItemProfile(request.Type, code, name, description);
    }

    private static EligibilityRequirementProfile ValidateRequirementProfile(EligibilityRequirementInput request)
    {
        var errors = new Dictionary<string, string[]>();
        var code = InputValidation.Required(request.RequiredCode, nameof(request.RequiredCode), 80, errors);
        var name = InputValidation.Required(request.Name, nameof(request.Name), 160, errors);
        var description = InputValidation.Optional(request.Description, nameof(request.Description), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);
        return new EligibilityRequirementProfile(
            request.TargetType,
            request.IdClient,
            request.IdService,
            request.IdPosition,
            request.RequirementType,
            code,
            name,
            description,
            request.IsBlocking);
    }

    private static EmployeeSkillProfile ValidateEmployeeSkillProfile(EmployeeSkillInput request)
    {
        var errors = new Dictionary<string, string[]>();
        var notes = InputValidation.Optional(request.Notes, nameof(request.Notes), 1000, errors);

        if (request.IdSkillCatalogItem == Guid.Empty)
        {
            errors[nameof(request.IdSkillCatalogItem)] = ["La habilidad es obligatoria."];
        }

        if (request.ExpiresDate < request.AcquiredDate)
        {
            errors[nameof(request.ExpiresDate)] = ["La fecha de vencimiento no puede ser menor que la fecha de obtención."];
        }

        InputValidation.ThrowIfInvalid(errors);
        return new EmployeeSkillProfile(request.IdSkillCatalogItem, request.AcquiredDate, request.ExpiresDate, notes);
    }

    private static CatalogItemResponse MapCatalogItem(BusinessCatalogItem item) =>
        new(item.IdBusinessCatalogItem, item.IdOrganization, item.Type, item.Code, item.Name, item.Description, item.Active);

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
            requirement.RequiredCode,
            requirement.Name,
            requirement.Description,
            requirement.IsBlocking,
            requirement.Active);

    private static EmployeeSkillResponse MapEmployeeSkill(EmployeeSkill skill) =>
        new(
            skill.IdEmployeeSkill,
            skill.IdEmployee,
            skill.IdSkillCatalogItem,
            skill.SkillCatalogItem.Code,
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
