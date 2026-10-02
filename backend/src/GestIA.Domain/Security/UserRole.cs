using GestIA.Domain.Common;

namespace GestIA.Domain.Security;

public sealed class UserRole : AuditableEntity
{
    private UserRole()
    {
    }

    public Guid IdUserRole { get; private set; }
    public Guid IdUser { get; private set; }
    public Guid IdRole { get; private set; }
    public Guid? IdOrganizationMembership { get; private set; }
    public User User { get; private set; } = null!;
    public Role Role { get; private set; } = null!;
    public OrganizationMembership? OrganizationMembership { get; private set; }

    public static UserRole Create(
        Guid idUser,
        Guid idRole,
        Guid? idOrganizationMembership,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var userRole = new UserRole
        {
            IdUserRole = Guid.NewGuid(),
            IdUser = idUser,
            IdRole = idRole,
            IdOrganizationMembership = idOrganizationMembership
        };
        userRole.RegisterCreation(actorId, actorName, occurredAt);
        return userRole;
    }
}
