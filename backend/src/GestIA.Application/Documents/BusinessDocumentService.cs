using GestIA.Application.Common;
using GestIA.Domain.Documents;

namespace GestIA.Application.Documents;

public sealed class BusinessDocumentService(
    IBusinessDocumentRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IBusinessDocumentService
{
    public async Task<PagedResult<BusinessDocumentResponse>> ListAsync(
        BusinessDocumentQuery query,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(query.IdOrganization, errors);
        InputValidation.Page(query.Page, query.PageSize, errors);
        var search = InputValidation.Optional(query.Search, nameof(query.Search), 200, errors);
        InputValidation.ThrowIfInvalid(errors);

        var result = await repository.SearchAsync(
            new BusinessDocumentSearchCriteria(
                query.IdOrganization,
                query.OwnerType,
                query.OwnerId,
                query.Status,
                search,
                (query.Page - 1) * query.PageSize,
                query.PageSize),
            cancellationToken);

        return result.ToPagedResult();
    }

    public async Task<BusinessDocumentResponse> GetAsync(
        Guid idOrganization,
        Guid idBusinessDocument,
        CancellationToken cancellationToken)
    {
        var document = await repository.GetAsync(idOrganization, idBusinessDocument, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el documento solicitado.");

        return Map(document);
    }

    public async Task<BusinessDocumentResponse> CreateAsync(
        CreateBusinessDocumentRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await ValidateAsync(request, cancellationToken);
        var document = BusinessDocument.Create(
            request.IdOrganization,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddAsync(document, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        var saved = await repository.GetAsync(request.IdOrganization, document.IdBusinessDocument, cancellationToken)
            ?? document;
        return Map(saved);
    }

    public async Task<BusinessDocumentResponse> UpdateAsync(
        Guid idBusinessDocument,
        UpdateBusinessDocumentRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await ValidateAsync(request, cancellationToken);
        var document = await repository.GetAsync(request.IdOrganization, idBusinessDocument, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el documento solicitado.");

        document.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        var saved = await repository.GetAsync(request.IdOrganization, idBusinessDocument, cancellationToken)
            ?? document;
        return Map(saved);
    }

    public async Task DeactivateAsync(
        Guid idOrganization,
        Guid idBusinessDocument,
        CancellationToken cancellationToken)
    {
        var document = await repository.GetAsync(idOrganization, idBusinessDocument, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el documento solicitado.");

        document.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<BusinessDocumentProfile> ValidateAsync(
        CreateBusinessDocumentRequest request,
        CancellationToken cancellationToken) =>
        await ValidateAsync(
            request.IdOrganization,
            request.OwnerType,
            request.OwnerId,
            request.Category,
            request.Title,
            request.Status,
            request.IssuedDate,
            request.ExpiresDate,
            request.StorageReference,
            request.IsSensitive,
            request.Notes,
            cancellationToken);

    private async Task<BusinessDocumentProfile> ValidateAsync(
        UpdateBusinessDocumentRequest request,
        CancellationToken cancellationToken) =>
        await ValidateAsync(
            request.IdOrganization,
            request.OwnerType,
            request.OwnerId,
            request.Category,
            request.Title,
            request.Status,
            request.IssuedDate,
            request.ExpiresDate,
            request.StorageReference,
            request.IsSensitive,
            request.Notes,
            cancellationToken);

    private async Task<BusinessDocumentProfile> ValidateAsync(
        Guid idOrganization,
        BusinessDocumentOwnerType ownerType,
        Guid ownerId,
        string category,
        string title,
        BusinessDocumentStatus status,
        DateOnly? issuedDate,
        DateOnly? expiresDate,
        string storageReference,
        bool isSensitive,
        string? notes,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(idOrganization, errors);
        if (ownerId == Guid.Empty)
        {
            errors[nameof(ownerId)] = ["El registro relacionado es obligatorio."];
        }

        var normalizedCategory = InputValidation.Required(category, nameof(category), 80, errors);
        var normalizedTitle = InputValidation.Required(title, nameof(title), 180, errors);
        var normalizedStorageReference = InputValidation.Required(storageReference, nameof(storageReference), 500, errors);
        var normalizedNotes = InputValidation.Optional(notes, nameof(notes), 1000, errors);

        if (expiresDate < issuedDate)
        {
            errors[nameof(expiresDate)] = ["La fecha de vencimiento no puede ser menor que la fecha de emisión."];
        }

        InputValidation.ThrowIfInvalid(errors);

        if (!await repository.OwnerExistsAsync(idOrganization, ownerType, ownerId, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró el registro relacionado al documento.");
        }

        return new BusinessDocumentProfile(
            ownerType,
            ownerId,
            normalizedCategory,
            normalizedTitle,
            status,
            issuedDate,
            expiresDate,
            normalizedStorageReference,
            isSensitive,
            normalizedNotes);
    }

    private static void ValidateOrganization(Guid idOrganization, Dictionary<string, string[]> errors)
    {
        if (idOrganization == Guid.Empty)
        {
            errors[nameof(idOrganization)] = ["La organización es obligatoria."];
        }
    }

    private static BusinessDocumentResponse Map(BusinessDocument document) =>
        new(
            document.IdBusinessDocument,
            document.IdOrganization,
            document.OwnerType,
            document.OwnerId,
            ResolveOwnerLabel(document),
            document.Category,
            document.Title,
            document.Status,
            document.IssuedDate,
            document.ExpiresDate,
            document.ExpiresDate.HasValue && document.ExpiresDate.Value < DateOnly.FromDateTime(DateTime.UtcNow),
            document.StorageReference,
            document.IsSensitive,
            document.Notes,
            document.Active,
            document.CreatedAt,
            document.UpdatedAt);

    private static string ResolveOwnerLabel(BusinessDocument document) =>
        document.OwnerType switch
        {
            BusinessDocumentOwnerType.Client => document.Client?.TradeName ?? document.Client?.LegalName ?? "Cliente",
            BusinessDocumentOwnerType.ServiceContract => document.ServiceContract?.CodeServiceContract ?? "Contrato",
            BusinessDocumentOwnerType.Service => document.Service?.Name ?? "Servicio",
            BusinessDocumentOwnerType.Employee => document.Employee?.FullName ?? "Empleado",
            BusinessDocumentOwnerType.EmployeeEvaluation => document.EmployeeEvaluation?.EvaluationType.ToString() ?? "Evaluación",
            BusinessDocumentOwnerType.OperationalRequest => document.OperationalRequest?.CodeOperationalRequest ?? "Solicitud",
            _ => "Registro"
        };
}
