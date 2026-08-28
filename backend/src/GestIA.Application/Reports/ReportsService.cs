namespace GestIA.Application.Reports;

public sealed class ReportsService(IReportsRepository repository) : IReportsService
{
    public Task<OperationsSummaryResponse> GetOperationsSummaryAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken)
    {
        Validate(query);
        return repository.GetOperationsSummaryAsync(query, cancellationToken);
    }

    public Task<IReadOnlyList<OperationsServiceSummaryResponse>> GetOperationsByServiceAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken)
    {
        Validate(query);
        return repository.GetOperationsByServiceAsync(query, cancellationToken);
    }

    public Task<IReadOnlyList<WorkforceEligibilityResponse>> GetWorkforceEligibilityAsync(
        WorkforceEligibilityQuery query,
        CancellationToken cancellationToken)
    {
        if (query.IdOrganization == Guid.Empty)
        {
            throw new ArgumentException("La organización es obligatoria.", nameof(query));
        }

        return repository.GetWorkforceEligibilityAsync(query, cancellationToken);
    }

    private static void Validate(OperationsSummaryQuery query)
    {
        if (query.IdOrganization == Guid.Empty)
        {
            throw new ArgumentException("La organización es obligatoria.", nameof(query));
        }

        if (query.FromDate is not null && query.ToDate is not null && query.FromDate > query.ToDate)
        {
            throw new ArgumentException("La fecha inicial no puede ser posterior a la fecha final.", nameof(query));
        }
    }
}
