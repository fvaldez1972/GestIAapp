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
        ClientContactPurpose purpose,
        string fullName,
        string? email,
        string? phone,
        string? mobilePhone,
        bool isPrimary,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        IdClientContact = idClientContact;
        IdClient = idClient;
        IdClientSite = idClientSite;
        Purpose = purpose;
        FullName = fullName.Trim();
        Email = Optional(email);
        Phone = Optional(phone);
        MobilePhone = Optional(mobilePhone);
        IsPrimary = isPrimary;
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
        new(
            Guid.NewGuid(),
            idClient,
            idClientSite,
            purpose,
            fullName,
            email,
            phone,
            mobilePhone,
            isPrimary,
            actorId,
            actorName,
            occurredAt);

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
