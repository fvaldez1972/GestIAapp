using GestIA.Domain.Catalogs;
using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

public sealed record AdministrativeIncidentProfile(
    Guid IdIncidentTypeCatalogItem,
    DateOnly OccurredDate,
    string Details);

/// <summary>
/// Un hecho administrativo del expediente de una persona: un acta, una llamada de atención, una
/// suspensión.
///
/// <para><b>No es una incidencia de la operación diaria, y la confusión es fácil.</b>
/// <c>Incident</c> registra lo que pasó en un turno —una falta, un retardo, un incidente de
/// seguridad— y vive atado a un servicio y a una fecha operativa. Esto vive atado a la <b>persona</b>
/// y no a un turno: sigue ahí aunque la persona cambie de servicio, y participa en la elegibilidad.
/// Reutilizar la tabla de incidencias operativas para guardarlo habría mezclado dos cosas que se
/// consultan, se filtran y se autorizan distinto.</para>
///
/// <para>Participa en la elegibilidad como los documentos y las evaluaciones: el tipo sale de un
/// catálogo que la organización edita, y la marca de bloqueo de ese catálogo decide si tener una
/// incidencia de ese tipo impide asignar o sólo deja constancia.</para>
///
/// <para>Lleva su propia <c>IdOrganization</c> aunque la alcanzaría por su padre, por la misma
/// razón que el resto de las entidades de detalle: el filtro global por organización no puede
/// depender del filtro de la entidad padre.</para>
/// </summary>
public sealed class AdministrativeIncident : AuditableEntity, IOrganizationScopedEntity
{
    private AdministrativeIncident()
    {
    }

    private AdministrativeIncident(
        Guid idAdministrativeIncident,
        Guid idOrganization,
        Guid idEmployee,
        AdministrativeIncidentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdAdministrativeIncident = idAdministrativeIncident;
        IdOrganization = idOrganization;
        IdEmployee = idEmployee;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdAdministrativeIncident { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdEmployee { get; private set; }

    /// <summary>De qué es, contra el catálogo <c>AdministrativeIncidentType</c>.</summary>
    public Guid IdIncidentTypeCatalogItem { get; private set; }

    /// <summary>
    /// Cuándo ocurrió el hecho. <b>Es fecha de negocio, no instante</b>: lo que importa es el día en
    /// que pasó, no la hora a la que alguien lo capturó, que ya la guarda <c>CreatedAt</c>.
    /// </summary>
    public DateOnly OccurredDate { get; private set; }

    /// <summary>
    /// Qué ocurrió, obligatorio.
    ///
    /// <para>Es obligatorio porque una incidencia sin relato no se puede revisar: el tipo dice de
    /// qué clase es, y esto dice qué pasó. Sin lo segundo, quien la lea dentro de un año no podrá
    /// juzgar si sigue siendo pertinente.</para>
    /// </summary>
    public string Details { get; private set; } = string.Empty;

    public Employee Employee { get; private set; } = null!;
    public BusinessCatalogItem IncidentTypeCatalogItem { get; private set; } = null!;

    public static AdministrativeIncident Create(
        Guid idOrganization,
        Guid idEmployee,
        AdministrativeIncidentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idEmployee, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        AdministrativeIncidentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(AdministrativeIncidentProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);

        if (profile.IdIncidentTypeCatalogItem == Guid.Empty)
        {
            throw new DomainRuleException("La incidencia administrativa necesita su tipo del catálogo.");
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Details);

        IdIncidentTypeCatalogItem = profile.IdIncidentTypeCatalogItem;
        OccurredDate = profile.OccurredDate;
        Details = profile.Details.Trim();
    }
}
