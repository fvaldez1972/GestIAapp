using GestIA.Application.Common;
using GestIA.Application.Organizations;
using GestIA.Domain.Requests;

namespace GestIA.Application.Requests;

public sealed class OperationalRequestService(
    IOperationalRequestRepository repository,
    IOrganizationRepository organizationRepository,
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
}
