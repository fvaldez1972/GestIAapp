using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Security;

/// <summary>
/// Pertenencia de un usuario a una organización.
/// </summary>
/// <remarks>
/// <b>Esta entidad NO lleva el filtro global de organización, y no es un descuido.</b> Es la
/// tabla que <i>establece</i> la pertenencia: el inicio de sesión la consulta para averiguar a
/// qué organizaciones pertenece el usuario, antes de que exista ninguna organización autorizada.
/// Filtrarla sería circular —haría falta saber la organización para poder averiguarla— y dejaría
/// a todo el mundo sin poder iniciar sesión.
///
/// Por eso no implementa <c>IOrganizationScopedEntity</c> pese a tener <c>IdOrganization</c>, y
/// se queda del lado de las entidades de seguridad. Si alguien intenta "completar" el filtro
/// agregándosela, esto es lo que se rompe.
/// </remarks>
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
