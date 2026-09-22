using GestIA.Domain.Catalogs;
using GestIA.Domain.Common;

namespace GestIA.Domain.Clients;

/// <summary>
/// Lleva su propia <c>IdOrganization</c> aunque la alcanzaría por su padre.
///
/// <para>Está denormalizada a propósito, y la decisión se tomó al revés de lo que dijo la tanda A.
/// Entonces la alternativa era "una columna redundante contra ningún costo". Con el filtro global
/// de la tanda B la alternativa pasó a ser un filtro por navegación, y eso hace que <b>el filtro
/// del hijo dependa del filtro del padre</b>: apagar uno sin el otro da resultados que hay que
/// razonar caso por caso, que es justo lo que el filtro global vino a evitar.</para>
///
/// <para>Es seguro porque la organización del padre es <b>inmutable</b>, y eso no es una
/// suposición: <c>OrganizationScopeTests</c> falla si alguien expone una vía de cambiarla.</para>
/// </summary>
public sealed class ClientContact : AuditableEntity, IOrganizationScopedEntity
{
    private ClientContact()
    {
    }

    private ClientContact(
        Guid idClientContact,
        Guid idOrganization,
        Guid idClient,
        Guid? idClientSite,
        ClientContactDetails details,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClientContact = idClientContact;
        IdOrganization = idOrganization;
        IdClient = idClient;
        ApplyDetails(idClientSite, details);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdClientContact { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdClient { get; private set; }
    public Guid? IdClientSite { get; private set; }

    /// <summary>
    /// Si el contacto vale para todo el cliente o sólo para una zona.
    ///
    /// <para>Guarda lo mismo que dice <see cref="IdClientSite"/>, y por eso la entidad no deja que
    /// se contradigan: con alcance de zona hay zona, y con alcance general no la hay. Se guarda
    /// además de deducirse porque D-02 cuenta contactos principales por alcance, y para contar
    /// hace falta que el alcance sea un dato y no una inferencia.</para>
    /// </summary>
    public ClientContactScope Scope { get; private set; }

    /// <summary>Para qué se le llama, como enum. <b>Rastro heredado</b> desde la conversión a catálogo.</summary>
    public ClientContactPurpose Purpose { get; private set; }

    /// <summary>
    /// El propósito, por identificador contra el catálogo <c>ContactPurpose</c>. Nulable mientras
    /// queden contactos anteriores a la conversión del 19 de septiembre de 2026.
    /// </summary>
    public Guid? IdPurposeCatalogItem { get; private set; }

    public string FullName { get; private set; } = string.Empty;

    /// <summary>El puesto, como texto. <b>Rastro heredado.</b></summary>
    public string? JobTitle { get; private set; }

    /// <summary>
    /// El puesto del contacto, contra el catálogo <c>ContactJobPosition</c>.
    ///
    /// <para>Hasta hoy el contacto elegía del catálogo de puestos del <b>personal</b>, que es el que
    /// sostiene la elegibilidad: dar de alta al vuelo un «Gerente de compras» desde la ficha de un
    /// cliente metía ese valor en la lista contra la que se comprueba si un guardia puede cubrir un
    /// turno.</para>
    /// </summary>
    public Guid? IdContactJobPositionCatalogItem { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? MobilePhone { get; private set; }
    public bool IsPrimary { get; private set; }
    public Client Client { get; private set; } = null!;
    public ClientSite? ClientSite { get; private set; }

    /// <summary>La entrada del catálogo, para poder nombrarla sin una consulta aparte.</summary>
    public BusinessCatalogItem? PurposeCatalogItem { get; private set; }
    public BusinessCatalogItem? ContactJobPositionCatalogItem { get; private set; }

    public static ClientContact Create(
        Guid idOrganization,
        Guid idClient,
        Guid? idClientSite,
        ClientContactPurpose purpose,
        string fullName,
        string? email,
        string? phone,
        string? mobilePhone,
        bool isPrimary,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        Create(
            idOrganization,
            idClient,
            idClientSite,
            new ClientContactDetails(
                purpose, fullName, null, email, phone, mobilePhone, isPrimary,
                idClientSite.HasValue ? ClientContactScope.Zone : ClientContactScope.General),
            actorId,
            actorName,
            occurredAt);

    public static ClientContact Create(
        Guid idOrganization,
        Guid idClient,
        Guid? idClientSite,
        ClientContactDetails details,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idClient, idClientSite, details, actorId, actorName, occurredAt);

    public void UpdateDetails(
        Guid? idClientSite,
        ClientContactDetails details,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyDetails(idClientSite, details);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyDetails(Guid? idClientSite, ClientContactDetails details)
    {
        ArgumentNullException.ThrowIfNull(details);
        ArgumentException.ThrowIfNullOrWhiteSpace(details.FullName);

        // Un contacto necesita al menos un modo de contactarlo. Se comprueba aquí y no sólo en la
        // pantalla porque un contacto sin telefono ni correo es un renglon que no sirve para nada:
        // se captura, ocupa sitio en la ficha, y el día que alguien lo busque no habrá a quién
        // llamar.
        if (string.IsNullOrWhiteSpace(details.Email) &&
            string.IsNullOrWhiteSpace(details.Phone) &&
            string.IsNullOrWhiteSpace(details.MobilePhone))
        {
            throw new DomainRuleException(
                "Un contacto necesita al menos un teléfono o un correo.");
        }

        // El alcance y la zona dicen lo mismo, y no se les permite contradecirse.
        if (details.Scope is ClientContactScope.Zone && idClientSite is null)
        {
            throw new DomainRuleException(
                "Un contacto de zona tiene que decir de qué zona es.");
        }

        IdClientSite = details.Scope is ClientContactScope.Zone ? idClientSite : null;
        Scope = details.Scope;
        Purpose = details.Purpose;
        IdPurposeCatalogItem = details.IdPurposeCatalogItem;
        IdContactJobPositionCatalogItem = details.IdContactJobPositionCatalogItem;
        FullName = details.FullName.Trim();
        JobTitle = Optional(details.JobTitle);
        Email = Optional(details.Email)?.ToLowerInvariant();
        Phone = Optional(details.Phone);
        MobilePhone = Optional(details.MobilePhone);
        IsPrimary = details.IsPrimary;
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record ClientContactDetails(
    ClientContactPurpose Purpose,
    string FullName,
    string? JobTitle,
    string? Email,
    string? Phone,
    string? MobilePhone,
    bool IsPrimary,
    ClientContactScope Scope = ClientContactScope.General,
    Guid? IdPurposeCatalogItem = null,
    Guid? IdContactJobPositionCatalogItem = null);
