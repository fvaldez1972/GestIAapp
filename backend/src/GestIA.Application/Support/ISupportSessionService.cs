namespace GestIA.Application.Support;

public interface ISupportSessionService
{
    Task<SupportSessionResponse> StartAsync(StartSupportSessionRequest request, CancellationToken cancellationToken);
    Task<SupportSessionResponse?> GetCurrentAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<SupportSessionResponse>> ListRecentAsync(CancellationToken cancellationToken);
    Task<SupportSessionResponse?> ValidateAsync(Guid idSupportSession, CancellationToken cancellationToken);
    Task EndAsync(Guid idSupportSession, CancellationToken cancellationToken);
}
