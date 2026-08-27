using GestIA.Domain.Common;

namespace GestIA.Domain.Security;

public sealed class Role : AuditableEntity
{
    private Role()
    {
    }

    public Guid IdRole { get; private set; }
    public Guid? IdOrganization { get; private set; }
    public string CodeRole { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public bool IsSystem { get; private set; }

    public static Role CreateSystem(
        string codeRole,
        string name,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeRole);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        var role = new Role
        {
            IdRole = Guid.NewGuid(),
            CodeRole = codeRole.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            IsSystem = true
        };
        role.RegisterCreation(actorId, actorName, occurredAt);
        return role;
    }
}
