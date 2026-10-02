namespace GestIA.Domain.Security;

#pragma warning disable CA1711
public sealed class RolePermission
#pragma warning restore CA1711
{
    private RolePermission()
    {
    }

    public Guid IdRolePermission { get; private set; }
    public Guid IdRole { get; private set; }
    public Guid IdPermission { get; private set; }
    public Role Role { get; private set; } = null!;
    public Permission Permission { get; private set; } = null!;

    public static RolePermission Create(Guid idRole, Guid idPermission) => new()
    {
        IdRolePermission = Guid.NewGuid(),
        IdRole = idRole,
        IdPermission = idPermission
    };
}
