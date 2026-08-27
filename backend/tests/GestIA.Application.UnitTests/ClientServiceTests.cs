using GestIA.Application.Clients;
using GestIA.Application.Common;
using GestIA.Application.Organizations;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;

namespace GestIA.Application.UnitTests;

public sealed class ClientServiceTests
{
    private static readonly Guid OrganizationId =
        Guid.Parse("65f1126a-ac8d-4f65-a80b-70161bdc835d");
    private static readonly DateTime Now =
        new(2026, 8, 27, 2, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task CreateNormalizesInputAndPersistsClient()
    {
        var clients = new FakeClientRepository();
        var unitOfWork = new FakeUnitOfWork();
        var service = CreateService(clients, unitOfWork);

        var result = await service.CreateAsync(
            Request(" cli-001 ", " Cliente demostración ", "exa010101aa1"),
            CancellationToken.None);

        Assert.Equal("CLI-001", result.CodeClient);
        Assert.Equal("Cliente demostración", result.LegalName);
        Assert.Equal("EXA010101AA1", result.Rfc);
        Assert.Single(clients.Items);
        Assert.Equal(1, unitOfWork.SaveCount);
    }

    [Fact]
    public async Task CreateRejectsDuplicateCode()
    {
        var clients = new FakeClientRepository { CodeInUse = true };
        var service = CreateService(clients, new FakeUnitOfWork());

        var exception = await Assert.ThrowsAsync<ResourceConflictException>(() =>
            service.CreateAsync(
                Request("CLI-001", "Cliente", "EXA010101AA1"),
                CancellationToken.None));

        Assert.Contains("código", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateRejectsInvalidRfcBeforePersistence()
    {
        var clients = new FakeClientRepository();
        var service = CreateService(clients, new FakeUnitOfWork());

        await Assert.ThrowsAsync<RequestValidationException>(() =>
            service.CreateAsync(
                Request("CLI-001", "Cliente", "RFC-INVALIDO"),
                CancellationToken.None));

        Assert.Empty(clients.Items);
    }

    private static ClientService CreateService(
        FakeClientRepository clients,
        FakeUnitOfWork unitOfWork) => new(
            clients,
            new FakeOrganizationRepository(),
            unitOfWork,
            new FakeActorContext(),
            new FakeClock());

    private static CreateClientRequest Request(string code, string legalName, string rfc) => new(
        OrganizationId,
        code,
        legalName,
        null,
        rfc,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);

    private sealed class FakeActorContext : IActorContext
    {
        public Guid ActorId => Guid.Parse("93b9d6c4-8f34-4c0a-8dc7-44328993b6df");
        public string ActorName => "Pruebas GestIA";
    }

    private sealed class FakeClock : IClock
    {
        public DateTime UtcNow => Now;
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int SaveCount { get; private set; }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCount++;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeOrganizationRepository : IOrganizationRepository
    {
        public Task<IReadOnlyList<Organization>> ListAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Organization>>([]);

        public Task<Organization?> GetAsync(
            Guid idOrganization,
            CancellationToken cancellationToken) => Task.FromResult<Organization?>(null);

        public Task<bool> ExistsAsync(Guid idOrganization, CancellationToken cancellationToken) =>
            Task.FromResult(idOrganization == OrganizationId);

        public Task<bool> IsCodeInUseAsync(string codeOrganization, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task<bool> IsRfcInUseAsync(string rfc, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task AddAsync(Organization organization, CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class FakeClientRepository : IClientRepository
    {
        public List<Client> Items { get; } = [];
        public bool CodeInUse { get; init; }

        public Task<(IReadOnlyList<Client> Items, int TotalCount)> SearchAsync(
            ClientSearchCriteria criteria,
            CancellationToken cancellationToken) =>
            Task.FromResult(((IReadOnlyList<Client>)Items, Items.Count));

        public Task<Client?> GetAsync(
            Guid idOrganization,
            Guid idClient,
            CancellationToken cancellationToken) =>
            Task.FromResult(Items.SingleOrDefault(client => client.IdClient == idClient));

        public Task<bool> IsCodeInUseAsync(
            Guid idOrganization,
            string codeClient,
            Guid? excludedClientId,
            CancellationToken cancellationToken) => Task.FromResult(CodeInUse);

        public Task<bool> IsRfcInUseAsync(
            Guid idOrganization,
            string rfc,
            Guid? excludedClientId,
            CancellationToken cancellationToken) => Task.FromResult(false);

        public Task AddAsync(Client client, CancellationToken cancellationToken)
        {
            Items.Add(client);
            return Task.CompletedTask;
        }
    }
}
