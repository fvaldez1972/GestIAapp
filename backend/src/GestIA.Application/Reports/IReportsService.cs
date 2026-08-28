namespace GestIA.Application.Reports;

public interface IReportsService
{
    Task<OperationsSummaryResponse> GetOperationsSummaryAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken);
}
