namespace GestIA.Application.Overview;

public interface IOverviewService
{
    Task<OverviewResponse> GetOverviewAsync(OverviewQuery query, CancellationToken cancellationToken);
}
