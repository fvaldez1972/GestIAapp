using GestIA.Application.Clients;
using GestIA.Application.Common;
using GestIA.Domain.Services;
using ServiceEntity = GestIA.Domain.Services.Service;
using ServiceConfigurationEntity = GestIA.Domain.Services.ServiceConfiguration;

namespace GestIA.Application.Services;

public sealed class ServiceManagementService(
    IClientRepository clientRepository,
    IClientSiteRepository siteRepository,
    IServiceManagementRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IServiceManagementService
{
    public async Task<IReadOnlyList<ServiceContractResponse>> ListContractsAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var contracts = await repository.ListContractsAsync(idClient, cancellationToken);
        return contracts.Select(Map).ToArray();
    }

    public async Task<ServiceContractResponse> CreateContractAsync(
        CreateServiceContractRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        var (code, terms) = Validate(request);

        if (await repository.IsContractCodeInUseAsync(request.IdClient, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un contrato con el código '{code}'.");
        }

        var contract = ServiceContract.Create(
            request.IdClient,
            code,
            terms,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddContractAsync(contract, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(contract);
    }

    public async Task<ServiceContractResponse> UpdateContractAsync(
        Guid idServiceContract,
        UpdateServiceContractRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        var terms = Validate(request);
        var contract = await repository.GetContractAsync(request.IdClient, idServiceContract, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el contrato solicitado.");

        contract.UpdateTerms(terms, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(contract);
    }

    public async Task DeactivateContractAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idServiceContract,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var contract = await repository.GetContractAsync(idClient, idServiceContract, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el contrato solicitado.");

        contract.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ServiceResponse>> ListServicesAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var services = await repository.ListServicesAsync(idClient, cancellationToken);
        return services.Select(Map).ToArray();
    }

    public async Task<ServiceResponse> CreateServiceAsync(
        CreateServiceRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        await EnsureSiteAsync(request.IdClient, request.IdClientSite, cancellationToken);
        await EnsureContractAsync(request.IdClient, request.IdServiceContract, cancellationToken);
        var (code, profile) = Validate(request);

        if (await repository.IsServiceCodeInUseAsync(request.IdClient, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un servicio con el código '{code}'.");
        }

        var service = ServiceEntity.Create(
            request.IdClient,
            request.IdClientSite,
            request.IdServiceContract,
            code,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddServiceAsync(service, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(service);
    }

    public async Task<ServiceResponse> UpdateServiceAsync(
        Guid idService,
        UpdateServiceRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        await EnsureSiteAsync(request.IdClient, request.IdClientSite, cancellationToken);
        await EnsureContractAsync(request.IdClient, request.IdServiceContract, cancellationToken);
        var profile = Validate(request);
        var service = await repository.GetServiceAsync(request.IdClient, idService, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el servicio solicitado.");

        service.UpdateProfile(
            request.IdClientSite,
            request.IdServiceContract,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(service);
    }

    public async Task DeactivateServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var service = await repository.GetServiceAsync(idClient, idService, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el servicio solicitado.");

        service.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ServiceConfigurationResponse>> ListConfigurationsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var configurations = await repository.ListConfigurationsAsync(idService, cancellationToken);
        return configurations.Select(Map).ToArray();
    }

    public async Task<ServiceConfigurationResponse> CreateConfigurationAsync(
        CreateServiceConfigurationRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var profile = Validate(request);

        if (await repository.IsConfigurationDateInUseAsync(
                request.IdService,
                profile.EffectiveFromDate,
                null,
                cancellationToken))
        {
            throw new ResourceConflictException("Ya existe una configuración con la misma fecha de inicio.");
        }

        var configuration = ServiceConfigurationEntity.Create(
            request.IdService,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddConfigurationAsync(configuration, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(configuration);
    }

    public async Task<ServiceConfigurationResponse> UpdateConfigurationAsync(
        Guid idServiceConfiguration,
        UpdateServiceConfigurationRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var profile = Validate(request);
        var configuration = await repository.GetConfigurationAsync(
                request.IdService,
                idServiceConfiguration,
                cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la configuración solicitada.");

        if (await repository.IsConfigurationDateInUseAsync(
                request.IdService,
                profile.EffectiveFromDate,
                idServiceConfiguration,
                cancellationToken))
        {
            throw new ResourceConflictException("Ya existe una configuración con la misma fecha de inicio.");
        }

        configuration.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(configuration);
    }

    public async Task DeactivateConfigurationAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idServiceConfiguration,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var configuration = await repository.GetConfigurationAsync(idService, idServiceConfiguration, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la configuración solicitada.");

        configuration.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureClientAsync(Guid idOrganization, Guid idClient, CancellationToken cancellationToken)
    {
        if (idOrganization == Guid.Empty || idClient == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idOrganization)] = ["La organización es obligatoria."],
                [nameof(idClient)] = ["El cliente es obligatorio."]
            });
        }

        if (await clientRepository.GetAsync(idOrganization, idClient, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el cliente solicitado.");
        }
    }

    private async Task EnsureSiteAsync(Guid idClient, Guid idClientSite, CancellationToken cancellationToken)
    {
        if (!await siteRepository.ExistsAsync(idClient, idClientSite, cancellationToken))
        {
            throw new ResourceNotFoundException("La sede seleccionada no pertenece al cliente.");
        }
    }

    private async Task EnsureContractAsync(Guid idClient, Guid? idServiceContract, CancellationToken cancellationToken)
    {
        if (!idServiceContract.HasValue)
        {
            return;
        }

        if (await repository.GetContractAsync(idClient, idServiceContract.Value, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("El contrato seleccionado no pertenece al cliente.");
        }
    }

    private async Task EnsureServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        if (await repository.GetServiceAsync(idClient, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
        }
    }

    private static (string Code, ServiceContractTerms Terms) Validate(CreateServiceContractRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var code = InputValidation.Required(request.CodeServiceContract, nameof(request.CodeServiceContract), 50, errors)
            .ToUpperInvariant();
        var terms = ValidateTerms(
            request.Status,
            request.SignedDate,
            request.EffectiveFromDate,
            request.EffectiveToDate,
            request.PaymentTermDays,
            request.TerminationNoticeDays,
            request.CurrencyCode,
            request.DocumentReference,
            request.Notes,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return (code, terms);
    }

    private static ServiceContractTerms Validate(UpdateServiceContractRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var terms = ValidateTerms(
            request.Status,
            request.SignedDate,
            request.EffectiveFromDate,
            request.EffectiveToDate,
            request.PaymentTermDays,
            request.TerminationNoticeDays,
            request.CurrencyCode,
            request.DocumentReference,
            request.Notes,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return terms;
    }

    private static ServiceContractTerms ValidateTerms(
        ServiceContractStatus status,
        DateOnly? signedDate,
        DateOnly effectiveFromDate,
        DateOnly? effectiveToDate,
        short paymentTermDays,
        short terminationNoticeDays,
        string? currencyCode,
        string? documentReference,
        string? notes,
        Dictionary<string, string[]> errors)
    {
        if (!Enum.IsDefined(status))
        {
            errors[nameof(status)] = ["El estado del contrato no es válido."];
        }

        if (effectiveToDate < effectiveFromDate)
        {
            errors[nameof(effectiveToDate)] = ["La fecha final no puede ser menor a la fecha inicial."];
        }

        if (paymentTermDays < 0)
        {
            errors[nameof(paymentTermDays)] = ["Los días de crédito no pueden ser negativos."];
        }

        if (terminationNoticeDays < 0)
        {
            errors[nameof(terminationNoticeDays)] = ["Los días de aviso no pueden ser negativos."];
        }

        return new ServiceContractTerms(
            status,
            signedDate,
            effectiveFromDate,
            effectiveToDate,
            paymentTermDays,
            terminationNoticeDays,
            (InputValidation.Optional(currencyCode, nameof(currencyCode), 3, errors) ?? "MXN").ToUpperInvariant(),
            InputValidation.Optional(documentReference, nameof(documentReference), 500, errors),
            InputValidation.Optional(notes, nameof(notes), 2000, errors));
    }

    private static (string Code, ServiceProfile Profile) Validate(CreateServiceRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var code = InputValidation.Required(request.CodeService, nameof(request.CodeService), 40, errors).ToUpperInvariant();
        var profile = ValidateServiceProfile(
            request.Name,
            request.Description,
            request.InvoiceDescription,
            request.StartDate,
            request.EndDate,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return (code, profile);
    }

    private static ServiceProfile Validate(UpdateServiceRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var profile = ValidateServiceProfile(
            request.Name,
            request.Description,
            request.InvoiceDescription,
            request.StartDate,
            request.EndDate,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return profile;
    }

    private static ServiceProfile ValidateServiceProfile(
        string name,
        string description,
        string? invoiceDescription,
        DateOnly startDate,
        DateOnly? endDate,
        Dictionary<string, string[]> errors)
    {
        if (endDate < startDate)
        {
            errors[nameof(endDate)] = ["La fecha final no puede ser menor a la fecha inicial."];
        }

        return new ServiceProfile(
            InputValidation.Required(name, nameof(name), 150, errors),
            InputValidation.Required(description, nameof(description), 1000, errors),
            InputValidation.Optional(invoiceDescription, nameof(invoiceDescription), 500, errors),
            startDate,
            endDate);
    }

    private static ServiceConfigurationProfile Validate(CreateServiceConfigurationRequest request) =>
        ValidateConfiguration(
            request.EffectiveFromDate,
            request.EffectiveToDate,
            request.RequiredWorkerCount,
            request.HoursPerDay,
            request.DaysPerWeek,
            request.AverageMonthlyHours,
            request.PreparationLeadDays,
            request.WorkScheduleDescription,
            request.SpecificInstructions,
            request.MonthlyPrice,
            request.CurrencyCode,
            request.IsTaxIncluded);

    private static ServiceConfigurationProfile Validate(UpdateServiceConfigurationRequest request) =>
        ValidateConfiguration(
            request.EffectiveFromDate,
            request.EffectiveToDate,
            request.RequiredWorkerCount,
            request.HoursPerDay,
            request.DaysPerWeek,
            request.AverageMonthlyHours,
            request.PreparationLeadDays,
            request.WorkScheduleDescription,
            request.SpecificInstructions,
            request.MonthlyPrice,
            request.CurrencyCode,
            request.IsTaxIncluded);

    private static ServiceConfigurationProfile ValidateConfiguration(
        DateOnly effectiveFromDate,
        DateOnly? effectiveToDate,
        short requiredWorkerCount,
        decimal hoursPerDay,
        byte daysPerWeek,
        decimal averageMonthlyHours,
        short preparationLeadDays,
        string workScheduleDescription,
        string? specificInstructions,
        decimal monthlyPrice,
        string? currencyCode,
        bool isTaxIncluded)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        if (effectiveToDate < effectiveFromDate)
        {
            errors[nameof(effectiveToDate)] = ["La fecha final no puede ser menor a la fecha inicial."];
        }

        if (requiredWorkerCount <= 0)
        {
            errors[nameof(requiredWorkerCount)] = ["El número de elementos debe ser mayor a cero."];
        }

        if (hoursPerDay <= 0 || hoursPerDay > 24)
        {
            errors[nameof(hoursPerDay)] = ["Las horas por día deben estar entre 1 y 24."];
        }

        if (daysPerWeek is < 1 or > 7)
        {
            errors[nameof(daysPerWeek)] = ["Los días por semana deben estar entre 1 y 7."];
        }

        if (averageMonthlyHours <= 0)
        {
            errors[nameof(averageMonthlyHours)] = ["Las horas mensuales deben ser mayores a cero."];
        }

        if (preparationLeadDays < 0)
        {
            errors[nameof(preparationLeadDays)] = ["Los días de anticipación no pueden ser negativos."];
        }

        if (monthlyPrice < 0)
        {
            errors[nameof(monthlyPrice)] = ["El precio mensual no puede ser negativo."];
        }

        var profile = new ServiceConfigurationProfile(
            effectiveFromDate,
            effectiveToDate,
            requiredWorkerCount,
            hoursPerDay,
            daysPerWeek,
            averageMonthlyHours,
            preparationLeadDays,
            InputValidation.Required(workScheduleDescription, nameof(workScheduleDescription), 500, errors),
            InputValidation.Optional(specificInstructions, nameof(specificInstructions), 2000, errors),
            monthlyPrice,
            (InputValidation.Optional(currencyCode, nameof(currencyCode), 3, errors) ?? "MXN").ToUpperInvariant(),
            isTaxIncluded);
        InputValidation.ThrowIfInvalid(errors);
        return profile;
    }

    private static ServiceContractResponse Map(ServiceContract contract) => new(
        contract.IdServiceContract,
        contract.IdClient,
        contract.CodeServiceContract,
        contract.Status,
        contract.SignedDate,
        contract.EffectiveFromDate,
        contract.EffectiveToDate,
        contract.PaymentTermDays,
        contract.TerminationNoticeDays,
        contract.CurrencyCode,
        contract.DocumentReference,
        contract.Notes,
        contract.Active);

    private static ServiceResponse Map(ServiceEntity service) => new(
        service.IdService,
        service.IdClient,
        service.IdClientSite,
        service.ClientSite?.Name,
        service.IdServiceContract,
        service.ServiceContract?.CodeServiceContract,
        service.CodeService,
        service.Name,
        service.Description,
        service.InvoiceDescription,
        service.StartDate,
        service.EndDate,
        service.Active);

    private static ServiceConfigurationResponse Map(ServiceConfigurationEntity configuration) => new(
        configuration.IdServiceConfiguration,
        configuration.IdService,
        configuration.EffectiveFromDate,
        configuration.EffectiveToDate,
        configuration.RequiredWorkerCount,
        configuration.HoursPerDay,
        configuration.DaysPerWeek,
        configuration.AverageWeeklyHours,
        configuration.AverageMonthlyHours,
        configuration.PreparationLeadDays,
        configuration.WorkScheduleDescription,
        configuration.SpecificInstructions,
        configuration.MonthlyPrice,
        configuration.CurrencyCode,
        configuration.IsTaxIncluded,
        configuration.Active);
}
