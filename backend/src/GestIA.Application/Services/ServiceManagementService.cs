using GestIA.Application.Clients;
using GestIA.Application.Common;
using GestIA.Domain.Services;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Application.Services;

public sealed class ServiceManagementService(
    IClientRepository clientRepository,
    IClientSiteRepository siteRepository,
    IServiceManagementRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    // El guardia de concurrencia y el contexto de motivo eran de la configuracion: se fueron con
    // ella. Los contratos y los servicios no los usaban.
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
            request.IdOrganization,
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

    public async Task<PagedResult<ServiceListItemResponse>> SearchServicesAsync(
        ServiceListQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        InputValidation.Page(query.Page, query.PageSize, errors);
        var search = InputValidation.Optional(query.Search, nameof(query.Search), 200, errors);
        InputValidation.ThrowIfInvalid(errors);

        var (items, totalCount) = await repository.SearchServicesAsync(
            new ServiceSearchCriteria(
                query.IdOrganization,
                search,
                query.IdClient,
                query.IdClientSite,
                query.IdServiceContract,
                query.Status,
                query.CoverageDate,
                (query.Page - 1) * query.PageSize,
                query.PageSize),
            cancellationToken);

        return new PagedResult<ServiceListItemResponse>(items, totalCount, query.Page, query.PageSize);
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
        var (capturado, profile) = Validate(request);
        var code = capturado ?? await NextServiceCodeAsync(request.IdClient, cancellationToken);

        if (await repository.IsServiceCodeInUseAsync(request.IdClient, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un servicio con el código '{code}'.");
        }

        var service = ServiceEntity.Create(
            request.IdOrganization,
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

    /// <summary>
    /// El siguiente codigo libre con la forma <c>SRV-01</c>, por cliente.
    ///
    /// <para>Se cuenta desde el mas alto ya usado, incluidos los inactivos, porque el codigo sigue
    /// ocupado aunque el servicio este dado de baja. No es un consecutivo garantizado: si dos altas
    /// coinciden, la segunda choca con la unicidad y quien da de alta reintenta, que es preferible a
    /// tomar un candado sobre la tabla por un identificador de conveniencia.</para>
    /// </summary>
    private async Task<string> NextServiceCodeAsync(Guid idClient, CancellationToken cancellationToken)
    {
        var highest = await repository.HighestServiceCodeNumberAsync(idClient, cancellationToken);
        return $"SRV-{highest + 1:00}";
    }

    private static (string? Code, ServiceProfile Profile) Validate(CreateServiceRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        // Opcional a proposito: sin codigo lo pone el servidor. Cuando viene, se respeta y se valida
        // como siempre.
        var code = string.IsNullOrWhiteSpace(request.CodeService)
            ? null
            : InputValidation.Required(request.CodeService, nameof(request.CodeService), 40, errors).ToUpperInvariant();
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

}
