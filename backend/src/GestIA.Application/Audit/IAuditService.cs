namespace GestIA.Application.Audit;

public interface IAuditService
{
    Task<AuditResult> SearchAsync(AuditQuery query, CancellationToken cancellationToken);
}
