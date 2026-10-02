namespace GestIA.Application.Security;

public interface IAuthenticationService
{
    Task<AuthSessionResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
}
