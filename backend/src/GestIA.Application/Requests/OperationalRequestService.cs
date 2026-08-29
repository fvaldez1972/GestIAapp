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

    public async Task<OperationalRequestExecutionPreviewResponse> PreviewExecutionAsync(
        Guid idOperationalRequest,
        ExecuteOperationalRequestRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);
        InputValidation.Optional(request.ExecutionNotes, nameof(request.ExecutionNotes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);

        var operationalRequest = await repository.GetAsync(request.IdOrganization, idOperationalRequest, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la solicitud.");

        return BuildExecutionPreview(operationalRequest, request);
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

        var preview = BuildExecutionPreview(operationalRequest, request);
        if (!preview.CanExecute)
        {
            throw new RequestValidationException(
                new Dictionary<string, string[]>
                {
                    ["execution"] = preview.MissingFields
                        .Concat(preview.Warnings)
                        .DefaultIfEmpty("La solicitud todavía no tiene los datos necesarios para ejecutarse.")
                        .ToArray()
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

    private static OperationalRequestExecutionPreviewResponse BuildExecutionPreview(
        OperationalRequest request,
        ExecuteOperationalRequestRequest execution)
    {
        var requiredFields = new List<string>();
        var missingFields = new List<string>();
        var impact = new List<string>();
        var warnings = new List<string>();

        requiredFields.Add("Solicitud aprobada");
        if (request.Status != OperationalRequestStatus.Approved)
        {
            missingFields.Add("La solicitud debe estar aprobada antes de ejecutarse.");
        }

        switch (request.RequestType)
        {
            case OperationalRequestType.NewClient:
                impact.Add(request.IdClient.HasValue
                    ? "Ligará la solicitud al cliente ya seleccionado."
                    : "Creará un nuevo cliente real.");
                if (execution.ClientSite is not null)
                {
                    impact.Add("Creará una sede para el cliente.");
                }

                if (execution.Service is not null)
                {
                    impact.Add("Creará un servicio asociado al cliente.");
                }

                RequireClientInputOrLinkedClient(request, execution, requiredFields, missingFields);
                if (execution.Client is not null)
                {
                    RequireNewClientFields(execution.Client, requiredFields, missingFields);
                }

                if (execution.ClientSite is not null)
                {
                    RequireClientSiteFields(execution.ClientSite, requiredFields, missingFields);
                }

                if (execution.Service is not null)
                {
                    RequireServiceFields(execution.Service, execution.ClientSite, requiredFields, missingFields);
                }

                if (execution.ServiceConfiguration is not null)
                {
                    if (execution.Service is null && !request.IdService.HasValue)
                    {
                        missingFields.Add("Para crear configuración se necesita crear o ligar un servicio.");
                    }

                    RequireConfigurationFields(execution.ServiceConfiguration, requiredFields, missingFields);
                }

                break;
            case OperationalRequestType.NewService:
                impact.Add(request.IdClient.HasValue
                    ? "Usará el cliente ligado a la solicitud."
                    : "Creará el cliente antes de crear el servicio.");
                impact.Add(request.IdService.HasValue
                    ? "Ligará la solicitud al servicio existente."
                    : "Creará un nuevo servicio real.");
                if (execution.ServiceConfiguration is not null)
                {
                    impact.Add("Creará la configuración operativa inicial del servicio.");
                }

                RequireClientInputOrLinkedClient(request, execution, requiredFields, missingFields);
                if (execution.Client is not null)
                {
                    RequireNewClientFields(execution.Client, requiredFields, missingFields);
                }

                requiredFields.Add("Servicio nuevo o servicio ligado");
                if (!request.IdService.HasValue && execution.Service is null)
                {
                    missingFields.Add("Captura los datos del servicio o liga un servicio existente.");
                }

                if (execution.ClientSite is not null)
                {
                    RequireClientSiteFields(execution.ClientSite, requiredFields, missingFields);
                }

                if (execution.Service is not null)
                {
                    RequireServiceFields(execution.Service, execution.ClientSite, requiredFields, missingFields);
                }

                if (execution.ServiceConfiguration is not null)
                {
                    RequireConfigurationFields(execution.ServiceConfiguration, requiredFields, missingFields);
                }

                break;
            case OperationalRequestType.ServiceChange:
                impact.Add("Creará una nueva configuración para el servicio ligado.");
                RequireLinkedClientAndService(request, requiredFields, missingFields);
                requiredFields.Add("Nueva configuración de servicio");

                if (execution.ServiceConfiguration is null)
                {
                    missingFields.Add("Captura la nueva configuración del servicio.");
                }
                else
                {
                    RequireConfigurationFields(execution.ServiceConfiguration, requiredFields, missingFields);
                }

                break;
            case OperationalRequestType.StaffChange:
                impact.Add("Convertirá el movimiento de personal en una asignación real.");
                RequireLinkedClientAndService(request, requiredFields, missingFields);
                requiredFields.Add("Empleado");
                requiredFields.Add("Puesto");
                requiredFields.Add("Fecha de inicio");

                if (execution.StaffAssignment is null)
                {
                    missingFields.Add("Captura los datos del movimiento de personal.");
                }
                else
                {
                    if (execution.StaffAssignment.IdEmployee == Guid.Empty)
                    {
                        missingFields.Add("Selecciona el empleado.");
                    }

                    if (execution.StaffAssignment.IdPosition == Guid.Empty)
                    {
                        missingFields.Add("Selecciona el puesto.");
                    }
                }

                break;
            case OperationalRequestType.CoverageSupport:
                impact.Add("Convertirá el apoyo solicitado en una cobertura real.");
                RequireLinkedClientAndService(request, requiredFields, missingFields);
                requiredFields.Add("Turno programado");
                requiredFields.Add("Empleado de reemplazo");
                requiredFields.Add("Horario de cobertura");

                if (execution.Coverage is null)
                {
                    missingFields.Add("Captura los datos de la cobertura.");
                }
                else
                {
                    if (execution.Coverage.IdScheduledShift == Guid.Empty)
                    {
                        missingFields.Add("Selecciona el turno programado.");
                    }

                    if (execution.Coverage.IdReplacementEmployee == Guid.Empty)
                    {
                        missingFields.Add("Selecciona el empleado de reemplazo.");
                    }
                }

                break;
            case OperationalRequestType.Other:
                impact.Add("Cerrará la solicitud con nota de seguimiento.");
                requiredFields.Add("Nota de resolución o ejecución");
                if (string.IsNullOrWhiteSpace(request.ResolutionNotes) &&
                    string.IsNullOrWhiteSpace(execution.ExecutionNotes))
                {
                    missingFields.Add("Agrega una nota de resolución o ejecución antes de cerrar la solicitud.");
                }

                break;
        }

        var distinctRequiredFields = requiredFields.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var distinctMissingFields = missingFields.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        return new OperationalRequestExecutionPreviewResponse(
            request.IdOperationalRequest,
            request.RequestType,
            distinctMissingFields.Length == 0,
            distinctRequiredFields,
            distinctMissingFields,
            impact.Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
            warnings);
    }

    private static void RequireClientInputOrLinkedClient(
        OperationalRequest request,
        ExecuteOperationalRequestRequest execution,
        List<string> requiredFields,
        List<string> missingFields)
    {
        requiredFields.Add("Cliente ligado o datos de cliente nuevo");
        if (!request.IdClient.HasValue && execution.Client is null)
        {
            missingFields.Add("Liga un cliente existente o captura los datos del cliente nuevo.");
        }
    }

    private static void RequireLinkedClientAndService(
        OperationalRequest request,
        List<string> requiredFields,
        List<string> missingFields)
    {
        requiredFields.Add("Cliente ligado");
        requiredFields.Add("Servicio ligado");

        if (!request.IdClient.HasValue)
        {
            missingFields.Add("Liga un cliente antes de ejecutar esta solicitud.");
        }

        if (!request.IdService.HasValue)
        {
            missingFields.Add("Liga un servicio antes de ejecutar esta solicitud.");
        }
    }

    private static void RequireNewClientFields(
        OperationalRequestClientInput client,
        List<string> requiredFields,
        List<string> missingFields)
    {
        requiredFields.Add("Código de cliente");
        requiredFields.Add("Razón social");
        requiredFields.Add("RFC");
        AddMissingIf(string.IsNullOrWhiteSpace(client.CodeClient), "Captura el código del cliente.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(client.LegalName), "Captura la razón social del cliente.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(client.Rfc), "Captura el RFC del cliente.", missingFields);
    }

    private static void RequireClientSiteFields(
        OperationalRequestClientSiteInput site,
        List<string> requiredFields,
        List<string> missingFields)
    {
        requiredFields.Add("Código de sede");
        requiredFields.Add("Nombre de sede");
        requiredFields.Add("Dirección de sede");
        AddMissingIf(string.IsNullOrWhiteSpace(site.CodeClientSite), "Captura el código de la sede.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(site.Name), "Captura el nombre de la sede.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(site.Street), "Captura la calle de la sede.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(site.Municipality), "Captura el municipio de la sede.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(site.State), "Captura el estado de la sede.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(site.PostalCode), "Captura el código postal de la sede.", missingFields);
    }

    private static void RequireServiceFields(
        OperationalRequestServiceInput service,
        OperationalRequestClientSiteInput? clientSite,
        List<string> requiredFields,
        List<string> missingFields)
    {
        requiredFields.Add("Código de servicio");
        requiredFields.Add("Nombre de servicio");
        requiredFields.Add("Descripción de servicio");
        requiredFields.Add("Fecha de inicio del servicio");
        requiredFields.Add("Sede del servicio");

        AddMissingIf(string.IsNullOrWhiteSpace(service.CodeService), "Captura el código del servicio.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(service.Name), "Captura el nombre del servicio.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(service.Description), "Captura la descripción del servicio.", missingFields);
        if (!service.IdClientSite.HasValue && clientSite is null)
        {
            missingFields.Add("Selecciona una sede existente o captura los datos de la sede nueva.");
        }
    }

    private static void RequireConfigurationFields(
        OperationalRequestServiceConfigurationInput configuration,
        List<string> requiredFields,
        List<string> missingFields)
    {
        requiredFields.Add("Personal requerido");
        requiredFields.Add("Horas por día");
        requiredFields.Add("Días por semana");
        requiredFields.Add("Horas mensuales promedio");
        requiredFields.Add("Descripción de horario");

        AddMissingIf(configuration.RequiredWorkerCount <= 0, "El personal requerido debe ser mayor a cero.", missingFields);
        AddMissingIf(configuration.HoursPerDay <= 0, "Las horas por día deben ser mayores a cero.", missingFields);
        AddMissingIf(configuration.DaysPerWeek <= 0, "Los días por semana deben ser mayores a cero.", missingFields);
        AddMissingIf(configuration.AverageMonthlyHours <= 0, "Las horas mensuales promedio deben ser mayores a cero.", missingFields);
        AddMissingIf(string.IsNullOrWhiteSpace(configuration.WorkScheduleDescription), "Captura la descripción del horario.", missingFields);
    }

    private static void AddMissingIf(bool condition, string message, List<string> missingFields)
    {
        if (condition)
        {
            missingFields.Add(message);
        }
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
