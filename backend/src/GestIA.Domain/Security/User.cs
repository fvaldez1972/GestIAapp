using GestIA.Domain.Common;

namespace GestIA.Domain.Security;

public sealed class User : AuditableEntity
{
    private User()
    {
    }

    public Guid IdUser { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string NormalizedEmail { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string PasswordSalt { get; private set; } = string.Empty;
    public int PasswordIterations { get; private set; }
    public DateTime? LastLoginAt { get; private set; }

    public static User Create(
        string email,
        string displayName,
        string passwordHash,
        string passwordSalt,
        int passwordIterations,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(displayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordSalt);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(passwordIterations);

        var user = new User
        {
            IdUser = Guid.NewGuid(),
            Email = email.Trim(),
            NormalizedEmail = NormalizeEmail(email),
            DisplayName = displayName.Trim(),
            PasswordHash = passwordHash,
            PasswordSalt = passwordSalt,
            PasswordIterations = passwordIterations
        };
        user.RegisterCreation(actorId, actorName, occurredAt);
        return user;
    }

    public void RegisterLogin(DateTime occurredAt)
    {
        LastLoginAt = occurredAt.Kind == DateTimeKind.Utc
            ? occurredAt
            : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
    }

    public static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();
}
