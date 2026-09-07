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
    public ClientContactPurpose Purpose { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? JobTitle { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? MobilePhone { get; private set; }
    public bool IsPrimary { get; private set; }
    public Client Client { get; private set; } = null!;
    public ClientSite? ClientSite { get; private set; }

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
            new ClientContactDetails(purpose, fullName, null, email, phone, mobilePhone, isPrimary),
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
        IdClientSite = idClientSite;
        Purpose = details.Purpose;
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
    bool IsPrimary);
