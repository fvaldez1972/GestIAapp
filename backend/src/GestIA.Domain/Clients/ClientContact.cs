using GestIA.Domain.Common;

namespace GestIA.Domain.Clients;

public sealed class ClientContact : AuditableEntity
{
    private ClientContact()
    {
    }

    private ClientContact(
        Guid idClientContact,
        Guid idClient,
        Guid? idClientSite,
        ClientContactDetails details,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClientContact = idClientContact;
        IdClient = idClient;
        ApplyDetails(idClientSite, details);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdClientContact { get; private set; }
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
            idClient,
            idClientSite,
            new ClientContactDetails(purpose, fullName, null, email, phone, mobilePhone, isPrimary),
            actorId,
            actorName,
            occurredAt);

    public static ClientContact Create(
        Guid idClient,
        Guid? idClientSite,
        ClientContactDetails details,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idClient, idClientSite, details, actorId, actorName, occurredAt);

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
