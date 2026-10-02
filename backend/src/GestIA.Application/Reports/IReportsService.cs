namespace GestIA.Application.Reports;

public interface IReportsService
{
    Task<OperationsSummaryResponse> GetOperationsSummaryAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<OperationsServiceSummaryResponse>> GetOperationsByServiceAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<WorkforceEligibilityResponse>> GetWorkforceEligibilityAsync(
        WorkforceEligibilityQuery query,
        CancellationToken cancellationToken);
}
