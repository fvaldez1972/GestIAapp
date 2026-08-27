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
        string name,
        string description,
        DateOnly startDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdService = idService;
        IdClient = idClient;
        IdClientSite = idClientSite;
        IdServiceContract = idServiceContract;
        CodeService = Required(codeService, nameof(codeService));
        Name = Required(name, nameof(name));
        Description = Required(description, nameof(description));
        StartDate = startDate;
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
        new(
            Guid.NewGuid(),
            idClient,
            idClientSite,
            idServiceContract,
            codeService,
            name,
            description,
            startDate,
            actorId,
            actorName,
            occurredAt);

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }
}
