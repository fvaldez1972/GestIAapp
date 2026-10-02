namespace GestIA.Application.Security;

public interface IAccessTokenService
{
    AuthSessionResponse CreateSession(AuthenticatedUserAccess user);
}
