using GestIA.Application.Common;

namespace GestIA.Application.Requests;

public interface IOperationalRequestService
{
    Task<PagedResult<OperationalRequestResponse>> ListAsync(
        OperationalRequestQuery query,
        CancellationToken cancellationToken);

    Task<OperationalRequestResponse> CreateAsync(
        CreateOperationalRequestRequest request,
        CancellationToken cancellationToken);

    Task<OperationalRequestResponse> UpdateAsync(
        Guid idOperationalRequest,
        UpdateOperationalRequestRequest request,
        CancellationToken cancellationToken);

    Task<OperationalRequestResponse> ChangeStatusAsync(
        Guid idOperationalRequest,
        ChangeOperationalRequestStatusRequest request,
        CancellationToken cancellationToken);
}
