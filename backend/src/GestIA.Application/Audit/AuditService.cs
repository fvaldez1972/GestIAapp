using GestIA.Application.Common;

namespace GestIA.Application.Audit;

public sealed class AuditService(IAuditRepository repository) : IAuditService
{
    public Task<AuditResult> SearchAsync(AuditQuery query, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        if (query.IdOrganization == Guid.Empty)
        {
            errors[nameof(query.IdOrganization)] = ["La organización es obligatoria."];
        }

        InputValidation.Page(query.Page, query.PageSize, errors);
        _ = InputValidation.Optional(query.Entity, nameof(query.Entity), 80, errors);
        _ = InputValidation.Optional(query.Search, nameof(query.Search), 200, errors);

        if (query.FromDate is not null && query.ToDate is not null && query.FromDate > query.ToDate)
        {
            errors[nameof(query.ToDate)] = ["La fecha final no puede ser menor que la inicial."];
        }

        InputValidation.ThrowIfInvalid(errors);
        return repository.SearchAsync(query, cancellationToken);
    }
}
