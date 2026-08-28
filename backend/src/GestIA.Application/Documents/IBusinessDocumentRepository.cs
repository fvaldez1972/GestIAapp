using GestIA.Domain.Documents;

namespace GestIA.Application.Documents;

public interface IBusinessDocumentRepository
{
    Task<BusinessDocumentSearchResult> SearchAsync(
        BusinessDocumentSearchCriteria criteria,
        CancellationToken cancellationToken);

    Task<BusinessDocument?> GetAsync(
        Guid idOrganization,
        Guid idBusinessDocument,
        CancellationToken cancellationToken);

    Task<bool> OwnerExistsAsync(
        Guid idOrganization,
        BusinessDocumentOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);

    Task AddAsync(BusinessDocument document, CancellationToken cancellationToken);
}
