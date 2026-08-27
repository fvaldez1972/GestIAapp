using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Security;

public sealed class OrganizationMembership : AuditableEntity
{
    private OrganizationMembership()
    {
    }

    public Guid IdOrganizationMembership { get; private set; }
    public Guid IdUser { get; private set; }
    public Guid IdOrganization { get; private set; }
    public string Label { get; private set; } = string.Empty;
    public User User { get; private set; } = null!;
    public Organization Organization { get; private set; } = null!;

    public static OrganizationMembership Create(
        Guid idUser,
        Guid idOrganization,
        string label,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(label);

        var membership = new OrganizationMembership
        {
            IdOrganizationMembership = Guid.NewGuid(),
            IdUser = idUser,
            IdOrganization = idOrganization,
            Label = label.Trim()
        };
        membership.RegisterCreation(actorId, actorName, occurredAt);
        return membership;
    }
}
