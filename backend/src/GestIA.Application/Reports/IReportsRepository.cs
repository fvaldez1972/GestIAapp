namespace GestIA.Application.Reports;

public interface IReportsRepository
{
    Task<OperationsSummaryResponse> GetOperationsSummaryAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken);
}
