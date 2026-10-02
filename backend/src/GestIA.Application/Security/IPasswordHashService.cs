namespace GestIA.Application.Security;

public sealed record PasswordHashResult(string Hash, string Salt, int Iterations);

public interface IPasswordHashService
{
    PasswordHashResult Hash(string password);

    bool Verify(string password, string hash, string salt, int iterations);
}
