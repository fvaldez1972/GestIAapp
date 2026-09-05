using GestIA.Domain.Common;

namespace GestIA.Domain.Security;

public sealed class Role : AuditableEntity
{
    private Role()
    {
    }

    public Guid IdRole { get; private set; }

    /// <summary>
    /// Organización dueña del rol, o <c>null</c> si es un rol del sistema.
    /// </summary>
    /// <remarks>
    /// <b>Es nulable a propósito y debe seguir siéndolo.</b> Los roles del sistema
    /// —<c>ADMINISTRATOR</c>, <c>ORGANIZATION_ADMIN</c>, <c>ORG_SUPERVISOR</c>,
    /// <c>ORG_OPERATOR</c>, <c>ORG_VIEWER</c>— se comparten entre todas las organizaciones y lo
    /// llevan nulo.
    ///
    /// De ahí que <c>Role</c> no pueda implementar <c>IOrganizationScopedEntity</c>, que declara
    /// un <c>Guid</c> no nulable: el compilador impide el error. Si alguien lo volviera no
    /// nulable para "cerrar" el filtro global, el inicio de sesión dejaría de resolver permisos
    /// para todo el mundo, porque los roles del sistema quedarían fuera de toda organización.
    /// </remarks>
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

    public static Role CreateCustom(
        Guid? idOrganization,
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
            IdOrganization = idOrganization,
            CodeRole = codeRole.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            IsSystem = false
        };
        role.RegisterCreation(actorId, actorName, occurredAt);
        return role;
    }

    public void UpdateProfile(
        string name,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        Name = name.Trim();
        RegisterUpdate(actorId, actorName, occurredAt);
    }
}
