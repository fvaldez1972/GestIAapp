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
        string name,
        string street,
        string municipality,
        string state,
        string postalCode,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClientSite = idClientSite;
        IdClient = idClient;
        CodeClientSite = Required(codeClientSite, nameof(codeClientSite));
        Name = Required(name, nameof(name));
        Street = Required(street, nameof(street));
        Municipality = Required(municipality, nameof(municipality));
        State = Required(state, nameof(state));
        PostalCode = Required(postalCode, nameof(postalCode));
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
        new(
            Guid.NewGuid(),
            idClient,
            codeClientSite,
            name,
            street,
            municipality,
            state,
            postalCode,
            actorId,
            actorName,
            occurredAt);

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }
}
