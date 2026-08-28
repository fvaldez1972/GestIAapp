using GestIA.Application.Common;
using GestIA.Application.Assignments;
using GestIA.Application.Clients;
using GestIA.Application.Operations;
using GestIA.Application.Organizations;
using GestIA.Application.Services;
using GestIA.Domain.Requests;

namespace GestIA.Application.Requests;

public sealed class OperationalRequestService(
    IOperationalRequestRepository repository,
    IOrganizationRepository organizationRepository,
    IClientService clientService,
    IClientSiteService clientSiteService,
    IServiceManagementService serviceManagementService,
    IAssignmentService assignmentService,
    IOperationsService operationsService,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IOperationalRequestService
{
    public async Task<PagedResult<OperationalRequestResponse>> ListAsync(
        OperationalRequestQuery query,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(query.IdOrganization, errors);
        InputValidation.Page(query.Page, query.PageSize, errors);
        var search = InputValidation.Optional(query.Search, nameof(query.Search), 200, errors);
        InputValidation.ThrowIfInvalid(errors);

        var criteria = new OperationalRequestSearchCriteria(
            query.IdOrganization,
            query.Status,
            query.RequestType,
            search,
            (query.Page - 1) * query.PageSize,
            query.PageSize);
        var result = await repository.SearchAsync(criteria, cancellationToken);

        return new PagedResult<OperationalRequestResponse>(
            result.Items.Select(Map).ToArray(),
            result.TotalCount,
            query.Page,
            query.PageSize);
    }

    public async Task<OperationalRequestResponse> CreateAsync(
        CreateOperationalRequestRequest request,
        CancellationToken cancellationToken)
    {
        var input = Validate(request);

        if (!await organizationRepository.ExistsAsync(request.IdOrganization, cancellationToken))
        {
            throw new ResourceNotFoundException("La organización seleccionada no existe o está inactiva.");
        }

        if (await repository.IsCodeInUseAsync(request.IdOrganization, input.Code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una solicitud con el folio '{input.Code}'.");
        }

        var operationalRequest = OperationalRequest.Create(
            request.IdOrganization,
            request.IdClient,
            request.IdService,
            input.Code,
            request.RequestType,
            request.Priority,
            input.Title,
            input.Description,
            input.RequestedByName,
            request.NeededByDate,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddAsync(operationalRequest, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await repository.GetAsync(request.IdOrganization, operationalRequest.IdOperationalRequest, cancellationToken)
            ?? operationalRequest;
        return Map(saved);
    }

    public async Task<OperationalRequestResponse> UpdateAsync(
        Guid idOperationalRequest,
        UpdateOperationalRequestRequest request,
        CancellationToken cancellationToken)
    {
        var input = Validate(request);
        var operationalRequest = await repository.GetAsync(request.IdOrganization, idOperationalRequest, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la solicitud.");

        operationalRequest.UpdateDetails(
            request.IdClient,
            request.IdService,
            request.RequestType,
            request.Priority,
            input.Title,
            input.Description,
            input.RequestedByName,
            request.NeededByDate,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(operationalRequest);
    }

    public async Task<OperationalRequestResponse> ChangeStatusAsync(
        Guid idOperationalRequest,
        ChangeOperationalRequestStatusRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);
        var resolutionNotes = InputValidation.Optional(request.ResolutionNotes, nameof(request.ResolutionNotes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);

        var operationalRequest = await repository.GetAsync(request.IdOrganization, idOperationalRequest, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la solicitud.");

        operationalRequest.ChangeStatus(
            request.Status,
            resolutionNotes,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(operationalRequest);
    }

    public async Task<ExecuteOperationalRequestResponse> ExecuteAsync(
        Guid idOperationalRequest,
        ExecuteOperationalRequestRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);
        var executionNotes = InputValidation.Optional(request.ExecutionNotes, nameof(request.ExecutionNotes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);

        var operationalRequest = await repository.GetAsync(request.IdOrganization, idOperationalRequest, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la solicitud.");

        if (operationalRequest.Status != OperationalRequestStatus.Approved)
        {
            throw new ResourceConflictException("Sólo se pueden ejecutar solicitudes aprobadas.");
        }

        var warnings = ValidateExecutionReadiness(operationalRequest, request);
        if (warnings.Count > 0)
        {
            throw new RequestValidationException(
                new Dictionary<string, string[]>
                {
                    ["execution"] = warnings.ToArray()
                });
        }

        var execution = await ExecuteBusinessActionAsync(operationalRequest, request, cancellationToken);

        var linkedClientId = execution.IdClient ?? operationalRequest.IdClient;
        var linkedServiceId = execution.IdService ?? operationalRequest.IdService;
        if (linkedClientId != operationalRequest.IdClient || linkedServiceId != operationalRequest.IdService)
        {
            operationalRequest.UpdateDetails(
                linkedClientId,
                linkedServiceId,
                operationalRequest.RequestType,
                operationalRequest.Priority,
                operationalRequest.Title,
                operationalRequest.Description,
                operationalRequest.RequestedByName,
                operationalRequest.NeededByDate,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);
        }

        operationalRequest.ChangeStatus(
            OperationalRequestStatus.Completed,
            BuildExecutionNotes(execution.Outcome, executionNotes),
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new ExecuteOperationalRequestResponse(
            Map(operationalRequest),
            execution.Outcome,
            execution.Warnings,
            execution.ExecutedEntityKind,
            execution.ExecutedEntityId);
    }

    private static (string Code, string Title, string Description, string RequestedByName) Validate(
        CreateOperationalRequestRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);
        var code = InputValidation.Required(
            request.CodeOperationalRequest,
            nameof(request.CodeOperationalRequest),
            40,
            errors).ToUpperInvariant();
        var title = InputValidation.Required(request.Title, nameof(request.Title), 180, errors);
        var description = InputValidation.Required(request.Description, nameof(request.Description), 2000, errors);
        var requestedByName = InputValidation.Required(
            request.RequestedByName,
            nameof(request.RequestedByName),
            160,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return (code, title, description, requestedByName);
    }

    private static (string Title, string Description, string RequestedByName) Validate(
        UpdateOperationalRequestRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);
        var title = InputValidation.Required(request.Title, nameof(request.Title), 180, errors);
        var description = InputValidation.Required(request.Description, nameof(request.Description), 2000, errors);
        var requestedByName = InputValidation.Required(
            request.RequestedByName,
            nameof(request.RequestedByName),
            160,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return (title, description, requestedByName);
    }

    private static void ValidateOrganization(Guid idOrganization, Dictionary<string, string[]> errors)
    {
        if (idOrganization == Guid.Empty)
        {
            errors[nameof(idOrganization)] = ["La organización es obligatoria."];
        }
    }

    private async Task<ExecutionResult> ExecuteBusinessActionAsync(
        OperationalRequest operationalRequest,
        ExecuteOperationalRequestRequest request,
        CancellationToken cancellationToken)
    {
        var warnings = new List<string>();

        switch (operationalRequest.RequestType)
        {
            case OperationalRequestType.NewClient:
                return await ExecuteNewClientAsync(operationalRequest, request, warnings, cancellationToken);

            case OperationalRequestType.NewService:
                return await ExecuteNewServiceAsync(operationalRequest, request, warnings, cancellationToken);

            case OperationalRequestType.ServiceChange:
                return await ExecuteServiceChangeAsync(operationalRequest, request, warnings, cancellationToken);

            case OperationalRequestType.StaffChange:
                return await ExecuteStaffChangeAsync(operationalRequest, request, warnings, cancellationToken);

            case OperationalRequestType.CoverageSupport:
                return await ExecuteCoverageSupportAsync(operationalRequest, request, warnings, cancellationToken);

            case OperationalRequestType.Other:
            default:
                return new ExecutionResult(
                    "Solicitud ejecutada y cerrada con nota de seguimiento.",
                    null,
                    null,
                    operationalRequest.IdClient,
                    operationalRequest.IdService,
                    warnings);
        }
    }

    private async Task<ExecutionResult> ExecuteNewClientAsync(
        OperationalRequest operationalRequest,
        ExecuteOperationalRequestRequest request,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var idClient = operationalRequest.IdClient;
        string? entityKind = null;
        Guid? entityId = null;

        if (request.Client is not null)
        {
            var client = await clientService.CreateAsync(
                new CreateClientRequest(
                    request.IdOrganization,
                    request.Client.CodeClient,
                    request.Client.LegalName,
                    request.Client.TradeName,
                    request.Client.Rfc,
                    request.Client.Nationality,
                    request.Client.TaxActivity,
                    request.Client.TaxAddress,
                    request.Client.PublicRegistryDate,
                    request.Client.CommercialRegistryFolio,
                    request.Client.EmployerRegistrationNumber,
                    request.Client.IncorporationDate,
                    request.Client.IncorporationDeedNumber,
                    request.Client.LegalRepresentativeInstrumentNumber),
                cancellationToken);

            idClient = client.IdClient;
            entityKind = "Cliente";
            entityId = client.IdClient;
        }

        var site = request.ClientSite is not null
            ? await CreateClientSiteAsync(request.IdOrganization, RequireClient(idClient), request.ClientSite, cancellationToken)
            : null;

        var contract = request.ServiceContract is not null
            ? await CreateServiceContractAsync(request.IdOrganization, RequireClient(idClient), request.ServiceContract, cancellationToken)
            : null;

        var service = request.Service is not null
            ? await CreateServiceAsync(
                request.IdOrganization,
                RequireClient(idClient),
                request.Service with
                {
                    IdClientSite = request.Service.IdClientSite ?? site?.IdClientSite,
                    IdServiceContract = request.Service.IdServiceContract ?? contract?.IdServiceContract
                },
                cancellationToken)
            : null;

        if (request.ServiceConfiguration is not null)
        {
            if (service is null)
            {
                warnings.Add("La configuración de servicio no se creó porque no se creó ni ligó un servicio durante esta ejecución.");
            }
            else
            {
                await CreateConfigurationAsync(
                    request.IdOrganization,
                    RequireClient(idClient),
                    service.IdService,
                    request.ServiceConfiguration,
                    cancellationToken);
            }
        }

        return new ExecutionResult(
            service is not null
                ? "Solicitud ejecutada: cliente y servicio creados desde la solicitud."
                : "Solicitud ejecutada: cliente creado o ligado al expediente.",
            service is not null ? "Servicio" : entityKind,
            service?.IdService ?? entityId,
            idClient,
            service?.IdService ?? operationalRequest.IdService,
            warnings);
    }

    private async Task<ExecutionResult> ExecuteNewServiceAsync(
        OperationalRequest operationalRequest,
        ExecuteOperationalRequestRequest request,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var idClient = operationalRequest.IdClient;
        if (idClient is null && request.Client is not null)
        {
            var client = await clientService.CreateAsync(
                new CreateClientRequest(
                    request.IdOrganization,
                    request.Client.CodeClient,
                    request.Client.LegalName,
                    request.Client.TradeName,
                    request.Client.Rfc,
                    request.Client.Nationality,
                    request.Client.TaxActivity,
                    request.Client.TaxAddress,
                    request.Client.PublicRegistryDate,
                    request.Client.CommercialRegistryFolio,
                    request.Client.EmployerRegistrationNumber,
                    request.Client.IncorporationDate,
                    request.Client.IncorporationDeedNumber,
                    request.Client.LegalRepresentativeInstrumentNumber),
                cancellationToken);
            idClient = client.IdClient;
        }

        var clientId = RequireClient(idClient);
        var site = request.ClientSite is not null
            ? await CreateClientSiteAsync(request.IdOrganization, clientId, request.ClientSite, cancellationToken)
            : null;
        var contract = request.ServiceContract is not null
            ? await CreateServiceContractAsync(request.IdOrganization, clientId, request.ServiceContract, cancellationToken)
            : null;

        var service = request.Service is not null
            ? await CreateServiceAsync(
                request.IdOrganization,
                clientId,
                request.Service with
                {
                    IdClientSite = request.Service.IdClientSite ?? site?.IdClientSite,
                    IdServiceContract = request.Service.IdServiceContract ?? contract?.IdServiceContract
                },
                cancellationToken)
            : null;

        var idService = service?.IdService ?? operationalRequest.IdService;
        if (request.ServiceConfiguration is not null)
        {
            await CreateConfigurationAsync(
                request.IdOrganization,
                clientId,
                RequireService(idService),
                request.ServiceConfiguration,
                cancellationToken);
        }

        return new ExecutionResult(
            service is not null
                ? "Solicitud ejecutada: servicio creado desde la solicitud."
                : "Solicitud ejecutada: servicio ligado al expediente operativo.",
            "Servicio",
            idService,
            clientId,
            idService,
            warnings);
    }

    private async Task<ExecutionResult> ExecuteServiceChangeAsync(
        OperationalRequest operationalRequest,
        ExecuteOperationalRequestRequest request,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var idClient = RequireClient(operationalRequest.IdClient);
        var idService = RequireService(operationalRequest.IdService);
        var configuration = await CreateConfigurationAsync(
            request.IdOrganization,
            idClient,
            idService,
            request.ServiceConfiguration!,
            cancellationToken);

        return new ExecutionResult(
            "Solicitud ejecutada: se creó una nueva configuración vigente para el servicio.",
            "Configuración de servicio",
            configuration.IdServiceConfiguration,
            idClient,
            idService,
            warnings);
    }

    private async Task<ExecutionResult> ExecuteStaffChangeAsync(
        OperationalRequest operationalRequest,
        ExecuteOperationalRequestRequest request,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var idClient = RequireClient(operationalRequest.IdClient);
        var idService = RequireService(operationalRequest.IdService);
        var staff = request.StaffAssignment!;
        var assignment = await assignmentService.CreateAssignmentAsync(
            new CreateServiceAssignmentRequest(
                request.IdOrganization,
                idClient,
                idService,
                staff.IdEmployee,
                staff.IdPosition,
                staff.AssignmentType,
                staff.StartDate,
                staff.EndDate,
                staff.IsPrimary,
                staff.Notes),
            cancellationToken);

        return new ExecutionResult(
            "Solicitud ejecutada: movimiento de personal convertido en asignación real.",
            "Asignación",
            assignment.IdServiceAssignment,
            idClient,
            idService,
            warnings);
    }

    private async Task<ExecutionResult> ExecuteCoverageSupportAsync(
        OperationalRequest operationalRequest,
        ExecuteOperationalRequestRequest request,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        var idClient = RequireClient(operationalRequest.IdClient);
        var idService = RequireService(operationalRequest.IdService);
        var coverageInput = request.Coverage!;
        var coverage = await operationsService.CreateCoverageAsync(
            new CreateCoverageRequest(
                request.IdOrganization,
                idClient,
                idService,
                coverageInput.IdScheduledShift,
                coverageInput.IdReplacementEmployee,
                coverageInput.CoverageStartTime,
                coverageInput.CoverageEndTime,
                coverageInput.IsOvernight,
                coverageInput.Status,
                coverageInput.Notes),
            cancellationToken);

        return new ExecutionResult(
            "Solicitud ejecutada: apoyo de cobertura convertido en cobertura real.",
            "Cobertura",
            coverage.IdCoverageRecord,
            idClient,
            idService,
            warnings);
    }

    private Task<ClientSiteResponse> CreateClientSiteAsync(
        Guid idOrganization,
        Guid idClient,
        OperationalRequestClientSiteInput input,
        CancellationToken cancellationToken) =>
        clientSiteService.CreateAsync(
            new CreateClientSiteRequest(
                idOrganization,
                idClient,
                input.CodeClientSite,
                input.Name,
                input.Street,
                input.ExteriorNumber,
                input.InteriorNumber,
                input.Neighborhood,
                input.Municipality,
                input.State,
                input.PostalCode,
                input.CountryCode,
                input.AccessInstructions,
                input.TimeZoneId),
            cancellationToken);

    private Task<ServiceContractResponse> CreateServiceContractAsync(
        Guid idOrganization,
        Guid idClient,
        OperationalRequestServiceContractInput input,
        CancellationToken cancellationToken) =>
        serviceManagementService.CreateContractAsync(
            new CreateServiceContractRequest(
                idOrganization,
                idClient,
                input.CodeServiceContract,
                input.Status,
                input.SignedDate,
                input.EffectiveFromDate,
                input.EffectiveToDate,
                input.PaymentTermDays,
                input.TerminationNoticeDays,
                input.CurrencyCode,
                input.DocumentReference,
                input.Notes),
            cancellationToken);

    private Task<ServiceResponse> CreateServiceAsync(
        Guid idOrganization,
        Guid idClient,
        OperationalRequestServiceInput input,
        CancellationToken cancellationToken) =>
        serviceManagementService.CreateServiceAsync(
            new CreateServiceRequest(
                idOrganization,
                idClient,
                RequireGuid(input.IdClientSite, "clientSite.idClientSite", "La sede del cliente es obligatoria para crear el servicio."),
                input.IdServiceContract,
                input.CodeService,
                input.Name,
                input.Description,
                input.InvoiceDescription,
                input.StartDate,
                input.EndDate),
            cancellationToken);

    private Task<ServiceConfigurationResponse> CreateConfigurationAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        OperationalRequestServiceConfigurationInput input,
        CancellationToken cancellationToken) =>
        serviceManagementService.CreateConfigurationAsync(
            new CreateServiceConfigurationRequest(
                idOrganization,
                idClient,
                idService,
                input.EffectiveFromDate,
                input.EffectiveToDate,
                input.RequiredWorkerCount,
                input.HoursPerDay,
                input.DaysPerWeek,
                input.AverageMonthlyHours,
                input.PreparationLeadDays,
                input.WorkScheduleDescription,
                input.SpecificInstructions,
                input.MonthlyPrice,
                input.CurrencyCode,
                input.IsTaxIncluded),
            cancellationToken);

    private static List<string> ValidateExecutionReadiness(
        OperationalRequest request,
        ExecuteOperationalRequestRequest execution)
    {
        var warnings = new List<string>();

        switch (request.RequestType)
        {
            case OperationalRequestType.NewClient:
                if (!request.IdClient.HasValue && execution.Client is null)
                {
                    warnings.Add("Captura el bloque 'client' o liga un cliente antes de ejecutar una solicitud de alta de cliente.");
                }

                break;
            case OperationalRequestType.NewService:
                if (!request.IdClient.HasValue && execution.Client is null)
                {
                    warnings.Add("Liga un cliente o captura el bloque 'client' antes de crear un servicio.");
                }

                if (!request.IdService.HasValue && execution.Service is null)
                {
                    warnings.Add("Captura el bloque 'service' o liga un servicio antes de ejecutar una solicitud de nuevo servicio.");
                }

                if (execution.Service is not null &&
                    !execution.Service.IdClientSite.HasValue &&
                    execution.ClientSite is null)
                {
                    warnings.Add("Para crear un servicio necesitas indicar 'service.idClientSite' o capturar el bloque 'clientSite'.");
                }

                break;
            case OperationalRequestType.ServiceChange:
                if (!request.IdClient.HasValue)
                {
                    warnings.Add("Liga un cliente antes de ejecutar el cambio de configuración.");
                }

                if (!request.IdService.HasValue)
                {
                    warnings.Add("Liga un servicio antes de ejecutar el cambio de configuración.");
                }

                if (execution.ServiceConfiguration is null)
                {
                    warnings.Add("Captura el bloque 'serviceConfiguration' para aplicar el cambio de configuración.");
                }

                break;
            case OperationalRequestType.StaffChange:
                if (!request.IdClient.HasValue)
                {
                    warnings.Add("Liga un cliente antes de ejecutar el cambio de personal.");
                }

                if (!request.IdService.HasValue)
                {
                    warnings.Add("Liga un servicio antes de ejecutar el cambio de personal.");
                }

                if (execution.StaffAssignment is null)
                {
                    warnings.Add("Captura el bloque 'staffAssignment' para convertir la solicitud en asignación.");
                }

                break;
            case OperationalRequestType.CoverageSupport:
                if (!request.IdClient.HasValue)
                {
                    warnings.Add("Liga un cliente antes de ejecutar la cobertura.");
                }

                if (!request.IdService.HasValue)
                {
                    warnings.Add("Liga un servicio antes de ejecutar la cobertura.");
                }

                if (execution.Coverage is null)
                {
                    warnings.Add("Captura el bloque 'coverage' para convertir la solicitud en cobertura real.");
                }

                break;
            case OperationalRequestType.Other:
                if (string.IsNullOrWhiteSpace(request.ResolutionNotes))
                {
                    warnings.Add("Agrega una nota de resolución antes de ejecutar una solicitud de tipo Otro.");
                }

                break;
        }

        return warnings;
    }

    private static string BuildExecutionNotes(string outcome, string? executionNotes)
    {
        if (string.IsNullOrWhiteSpace(executionNotes))
        {
            return outcome;
        }

        return $"{outcome} {executionNotes.Trim()}";
    }

    private static Guid RequireClient(Guid? idClient) =>
        RequireGuid(idClient, "idClient", "El cliente es obligatorio para ejecutar esta solicitud.");

    private static Guid RequireService(Guid? idService) =>
        RequireGuid(idService, "idService", "El servicio es obligatorio para ejecutar esta solicitud.");

    private static Guid RequireGuid(Guid? value, string field, string message)
    {
        if (!value.HasValue || value.Value == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [field] = [message]
            });
        }

        return value.Value;
    }

    private static OperationalRequestResponse Map(OperationalRequest request) => new(
        request.IdOperationalRequest,
        request.IdOrganization,
        request.Organization?.LegalName ?? string.Empty,
        request.IdClient,
        request.Client?.TradeName ?? request.Client?.LegalName,
        request.IdService,
        request.Service?.Name,
        request.CodeOperationalRequest,
        request.RequestType,
        request.Status,
        request.Priority,
        request.Title,
        request.Description,
        request.RequestedByName,
        request.NeededByDate,
        request.ResolutionNotes,
        request.Active,
        request.CreatedAt,
        request.UpdatedAt);

    private sealed record ExecutionResult(
        string Outcome,
        string? ExecutedEntityKind,
        Guid? ExecutedEntityId,
        Guid? IdClient,
        Guid? IdService,
        IReadOnlyList<string> Warnings);
}
