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
        ClientProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClient = idClient;
        IdOrganization = idOrganization;
        CodeClient = Required(codeClient, nameof(codeClient)).ToUpperInvariant();
        ApplyProfile(profile);
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
        DateTime occurredAt) => Create(
            idOrganization,
            codeClient,
            new ClientProfile(legalName, null, rfc, null, null, null, null, null, null, null, null, null),
            actorId,
            actorName,
            occurredAt);

    public static Client Create(
        Guid idOrganization,
        string codeClient,
        ClientProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, codeClient, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        ClientProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ClientProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        LegalName = Required(profile.LegalName, nameof(profile.LegalName));
        TradeName = Optional(profile.TradeName);
        Rfc = Required(profile.Rfc, nameof(profile.Rfc)).ToUpperInvariant();
        Nationality = Optional(profile.Nationality);
        TaxActivity = Optional(profile.TaxActivity);
        TaxAddress = Optional(profile.TaxAddress);
        PublicRegistryDate = profile.PublicRegistryDate;
        CommercialRegistryFolio = Optional(profile.CommercialRegistryFolio);
        EmployerRegistrationNumber = Optional(profile.EmployerRegistrationNumber);
        IncorporationDate = profile.IncorporationDate;
        IncorporationDeedNumber = Optional(profile.IncorporationDeedNumber);
        LegalRepresentativeInstrumentNumber = Optional(profile.LegalRepresentativeInstrumentNumber);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record ClientProfile(
    string LegalName,
    string? TradeName,
    string Rfc,
    string? Nationality,
    string? TaxActivity,
    string? TaxAddress,
    DateOnly? PublicRegistryDate,
    string? CommercialRegistryFolio,
    string? EmployerRegistrationNumber,
    DateOnly? IncorporationDate,
    string? IncorporationDeedNumber,
    string? LegalRepresentativeInstrumentNumber);
