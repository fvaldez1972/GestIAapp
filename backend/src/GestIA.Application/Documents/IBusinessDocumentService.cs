using GestIA.Application.Common;

namespace GestIA.Application.Documents;

public interface IBusinessDocumentService
{
    Task<PagedResult<BusinessDocumentResponse>> ListAsync(
        BusinessDocumentQuery query,
        CancellationToken cancellationToken);

    Task<BusinessDocumentResponse> GetAsync(
        Guid idOrganization,
        Guid idBusinessDocument,
        CancellationToken cancellationToken);

    Task<BusinessDocumentResponse> CreateAsync(
        CreateBusinessDocumentRequest request,
        CancellationToken cancellationToken);

    Task<BusinessDocumentResponse> UpdateAsync(
        Guid idBusinessDocument,
        UpdateBusinessDocumentRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAsync(
        Guid idOrganization,
        Guid idBusinessDocument,
        CancellationToken cancellationToken);
}
