using GestIA.Domain.Common;

namespace GestIA.Domain.Clients;

public sealed class ClientSite : AuditableEntity
{
    private ClientSite()
    {
    }

    private ClientSite(
        Guid idClientSite,
        Guid idClient,
        string codeClientSite,
        ClientSiteAddress address,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClientSite = idClientSite;
        IdClient = idClient;
        CodeClientSite = Required(codeClientSite, nameof(codeClientSite)).ToUpperInvariant();
        ApplyAddress(address);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdClientSite { get; private set; }
    public Guid IdClient { get; private set; }
    public string CodeClientSite { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Street { get; private set; } = string.Empty;
    public string? ExteriorNumber { get; private set; }
    public string? InteriorNumber { get; private set; }
    public string? Neighborhood { get; private set; }
    public string Municipality { get; private set; } = string.Empty;
    public string State { get; private set; } = string.Empty;
    public string PostalCode { get; private set; } = string.Empty;
    public string CountryCode { get; private set; } = "MX";
    public string? AccessInstructions { get; private set; }
    public string? TimeZoneId { get; private set; }
    public Client Client { get; private set; } = null!;

    public static ClientSite Create(
        Guid idClient,
        string codeClientSite,
        string name,
        string street,
        string municipality,
        string state,
        string postalCode,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        Create(
            idClient,
            codeClientSite,
            new ClientSiteAddress(
                name,
                street,
                null,
                null,
                null,
                municipality,
                state,
                postalCode,
                "MX",
                null,
                null),
            actorId,
            actorName,
            occurredAt);

    public static ClientSite Create(
        Guid idClient,
        string codeClientSite,
        ClientSiteAddress address,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idClient, codeClientSite, address, actorId, actorName, occurredAt);

    public void UpdateAddress(
        ClientSiteAddress address,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyAddress(address);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyAddress(ClientSiteAddress address)
    {
        ArgumentNullException.ThrowIfNull(address);
        Name = Required(address.Name, nameof(address.Name));
        Street = Required(address.Street, nameof(address.Street));
        ExteriorNumber = Optional(address.ExteriorNumber);
        InteriorNumber = Optional(address.InteriorNumber);
        Neighborhood = Optional(address.Neighborhood);
        Municipality = Required(address.Municipality, nameof(address.Municipality));
        State = Required(address.State, nameof(address.State));
        PostalCode = Required(address.PostalCode, nameof(address.PostalCode));
        CountryCode = Required(address.CountryCode, nameof(address.CountryCode)).ToUpperInvariant();
        AccessInstructions = Optional(address.AccessInstructions);
        TimeZoneId = Optional(address.TimeZoneId);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record ClientSiteAddress(
    string Name,
    string Street,
    string? ExteriorNumber,
    string? InteriorNumber,
    string? Neighborhood,
    string Municipality,
    string State,
    string PostalCode,
    string CountryCode,
    string? AccessInstructions,
    string? TimeZoneId);
