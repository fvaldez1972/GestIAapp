using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Clients;

public sealed class Client : AuditableEntity
{
    private readonly List<ClientContact> contacts = [];
    private readonly List<ClientSite> sites = [];

    private Client()
    {
    }

    private Client(
        Guid idClient,
        Guid idOrganization,
        string codeClient,
        string legalName,
        string rfc,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClient = idClient;
        IdOrganization = idOrganization;
        CodeClient = Required(codeClient, nameof(codeClient));
        LegalName = Required(legalName, nameof(legalName));
        Rfc = Required(rfc, nameof(rfc));
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdClient { get; private set; }
    public Guid IdOrganization { get; private set; }
    public string CodeClient { get; private set; } = string.Empty;
    public string LegalName { get; private set; } = string.Empty;
    public string? TradeName { get; private set; }
    public string Rfc { get; private set; } = string.Empty;
    public string? Nationality { get; private set; }
    public string? TaxActivity { get; private set; }
    public string? TaxAddress { get; private set; }
    public DateOnly? PublicRegistryDate { get; private set; }
    public string? CommercialRegistryFolio { get; private set; }
    public string? EmployerRegistrationNumber { get; private set; }
    public DateOnly? IncorporationDate { get; private set; }
    public string? IncorporationDeedNumber { get; private set; }
    public string? LegalRepresentativeInstrumentNumber { get; private set; }
    public Organization Organization { get; private set; } = null!;
    public IReadOnlyCollection<ClientContact> Contacts => contacts;
    public IReadOnlyCollection<ClientSite> Sites => sites;

    public static Client Create(
        Guid idOrganization,
        string codeClient,
        string legalName,
        string rfc,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, codeClient, legalName, rfc, actorId, actorName, occurredAt);

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }
}
