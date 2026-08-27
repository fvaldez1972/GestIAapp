using GestIA.Domain.Clients;
using GestIA.Domain.Common;

namespace GestIA.Domain.Services;

public sealed class Service : AuditableEntity
{
    private readonly List<ServiceConfiguration> configurations = [];

    private Service()
    {
    }

    private Service(
        Guid idService,
        Guid idClient,
        Guid idClientSite,
        Guid? idServiceContract,
        string codeService,
        ServiceProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdService = idService;
        IdClient = idClient;
        IdClientSite = idClientSite;
        IdServiceContract = idServiceContract;
        CodeService = Required(codeService, nameof(codeService)).ToUpperInvariant();
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdService { get; private set; }
    public Guid IdClient { get; private set; }
    public Guid IdClientSite { get; private set; }
    public Guid? IdServiceContract { get; private set; }
    public string CodeService { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string? InvoiceDescription { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public Client Client { get; private set; } = null!;
    public ClientSite ClientSite { get; private set; } = null!;
    public ServiceContract? ServiceContract { get; private set; }
    public IReadOnlyCollection<ServiceConfiguration> Configurations => configurations;

    public static Service Create(
        Guid idClient,
        Guid idClientSite,
        Guid? idServiceContract,
        string codeService,
        string name,
        string description,
        DateOnly startDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        Create(
            idClient,
            idClientSite,
            idServiceContract,
            codeService,
            new ServiceProfile(name, description, null, startDate, null),
            actorId,
            actorName,
            occurredAt);

    public static Service Create(
        Guid idClient,
        Guid idClientSite,
        Guid? idServiceContract,
        string codeService,
        ServiceProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idClient, idClientSite, idServiceContract, codeService, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        Guid idClientSite,
        Guid? idServiceContract,
        ServiceProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClientSite = idClientSite;
        IdServiceContract = idServiceContract;
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ServiceProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);

        if (profile.EndDate < profile.StartDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        Name = Required(profile.Name, nameof(profile.Name));
        Description = Required(profile.Description, nameof(profile.Description));
        InvoiceDescription = Optional(profile.InvoiceDescription);
        StartDate = profile.StartDate;
        EndDate = profile.EndDate;
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record ServiceProfile(
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate);
