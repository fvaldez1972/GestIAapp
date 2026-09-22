using GestIA.Domain.Catalogs;
using GestIA.Domain.Common;

namespace GestIA.Domain.Planning;

/// <summary>
/// Una pieza de equipo que el cliente pide para una posición.
///
/// <para><b>Es una tabla de detalle y no una columna, porque el equipo casi nunca es uno.</b> Una
/// caseta pide radio y lámpara; un rondín pide radio, lámpara y bicicleta. Guardarlo como una sola
/// clave foránea habría obligado a elegir uno y perder el resto, y guardarlo como texto libre
/// habría dejado «Radio», «radio portátil» y «RADIO PORTATIL» como tres equipos distintos.</para>
///
/// <para>Lleva su propia <c>IdOrganization</c> como el resto de las entidades de detalle: el filtro
/// global no puede depender del filtro del padre.</para>
/// </summary>
public sealed class PositionRequiredEquipment : AuditableEntity, IOrganizationScopedEntity
{
    private PositionRequiredEquipment()
    {
    }

    private PositionRequiredEquipment(
        Guid idPositionRequiredEquipment,
        Guid idOrganization,
        Guid idPosition,
        Guid idEquipmentCatalogItem,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (idEquipmentCatalogItem == Guid.Empty)
        {
            throw new DomainRuleException("El equipo requerido tiene que salir del catálogo.");
        }

        IdPositionRequiredEquipment = idPositionRequiredEquipment;
        IdOrganization = idOrganization;
        IdPosition = idPosition;
        IdEquipmentCatalogItem = idEquipmentCatalogItem;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdPositionRequiredEquipment { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdPosition { get; private set; }
    public Guid IdEquipmentCatalogItem { get; private set; }
    public Position Position { get; private set; } = null!;
    public BusinessCatalogItem EquipmentCatalogItem { get; private set; } = null!;

    public static PositionRequiredEquipment Create(
        Guid idOrganization,
        Guid idPosition,
        Guid idEquipmentCatalogItem,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idPosition, idEquipmentCatalogItem, actorId, actorName, occurredAt);
}
