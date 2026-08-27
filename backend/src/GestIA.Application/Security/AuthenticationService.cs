using GestIA.Application.Common;
using GestIA.Domain.Security;

namespace GestIA.Application.Security;

public sealed class AuthenticationService(
    IUserAccessRepository repository,
    IPasswordHashService passwordHashService,
    IAccessTokenService accessTokenService,
    IUnitOfWork unitOfWork,
    IClock clock) : IAuthenticationService
{
    public async Task<AuthSessionResponse> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var email = InputValidation.Required(request.Email, nameof(request.Email), 255, errors);
        var password = InputValidation.Required(request.Password, nameof(request.Password), 200, errors);
        InputValidation.ThrowIfInvalid(errors);

        var user = await repository.FindByEmailAsync(User.NormalizeEmail(email), cancellationToken);

        if (user is null ||
            !passwordHashService.Verify(
                password,
                user.PasswordHash,
                user.PasswordSalt,
                user.PasswordIterations))
        {
            throw new UnauthorizedAccessException("Correo o contraseña inválidos.");
        }

        await repository.RegisterLoginAsync(user.IdUser, clock.UtcNow, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return accessTokenService.CreateSession(user);
    }
}
