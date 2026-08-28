namespace GestIA.Application.Audit;

public interface IAuditRepository
{
    Task<AuditResult> SearchAsync(AuditQuery query, CancellationToken cancellationToken);
}
