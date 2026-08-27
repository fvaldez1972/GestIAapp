namespace GestIA.Application.Security;

public interface IUserAccessRepository
{
    Task<AuthenticatedUserAccess?> FindByEmailAsync(string email, CancellationToken cancellationToken);

    Task RegisterLoginAsync(Guid idUser, DateTime occurredAt, CancellationToken cancellationToken);
}
