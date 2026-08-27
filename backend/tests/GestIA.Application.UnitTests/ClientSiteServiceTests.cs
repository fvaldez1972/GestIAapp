using GestIA.Application.Clients;
using GestIA.Application.Common;
using GestIA.Domain.Clients;

namespace GestIA.Application.UnitTests;

public sealed class ClientSiteServiceTests
{
    private static readonly Guid ActorId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OrganizationId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public async Task CreateSiteRejectsDuplicateCode()
    {
        var client = Client.Create(
            OrganizationId,
            "CLI001",
            "Cliente Demo",
            "XAXX010101000",
            ActorId,
            "Tester",
            DateTime.UtcNow);
        var clientRepository = new StubClientRepository(client);
        var siteRepository = new StubClientSiteRepository { CodeInUse = true };
        var service = CreateService(clientRepository, siteRepository);

        var request = new CreateClientSiteRequest(
            OrganizationId,
            client.IdClient,
            "MTY",
            "Monterrey",
            "Av. Principal",
            null,
            null,
            null,
            "Monterrey",
            "Nuevo León",
            "64000",
            "MX",
            null,
            "America/Mexico_City");

        await Assert.ThrowsAsync<ResourceConflictException>(() =>
            service.CreateAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task CreateContactRejectsSiteFromAnotherClient()
    {
        var client = Client.Create(
            OrganizationId,
            "CLI001",
            "Cliente Demo",
            "XAXX010101000",
            ActorId,
            "Tester",
            DateTime.UtcNow);
        var clientRepository = new StubClientRepository(client);
        var siteRepository = new StubClientSiteRepository { SiteExists = false };
        var service = new ClientContactService(
            clientRepository,
            siteRepository,
            new StubClientContactRepository(),
            new StubUnitOfWork(),
            new StubActorContext(),
            new StubClock());

        var request = new CreateClientContactRequest(
            OrganizationId,
            client.IdClient,
            Guid.NewGuid(),
            ClientContactPurpose.Operational,
            "Contacto Operativo",
            null,
            "contacto@demo.local",
            null,
            null,
            true);

        await Assert.ThrowsAsync<ResourceNotFoundException>(() =>
            service.CreateAsync(request, CancellationToken.None));
    }

    private static ClientSiteService CreateService(
        IClientRepository clientRepository,
        IClientSiteRepository siteRepository) =>
        new(
            clientRepository,
            siteRepository,
            new StubUnitOfWork(),
            new StubActorContext(),
            new StubClock());

    private sealed class StubClientRepository(Client? client) : IClientRepository
    {
        public Task<(IReadOnlyList<Client> Items, int TotalCount)> SearchAsync(ClientSearchCriteria criteria, CancellationToken cancellationToken) =>
            Task.FromResult(((IReadOnlyList<Client>)[], 0));

        public Task<Client?> GetAsync(Guid idOrganization, Guid idClient, CancellationToken cancellationToken) =>
            Task.FromResult(client?.IdOrganization == idOrganization && client.IdClient == idClient ? client : null);

        public Task<bool> IsCodeInUseAsync(Guid idOrganization, string codeClient, Guid? excludedClientId, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task<bool> IsRfcInUseAsync(Guid idOrganization, string rfc, Guid? excludedClientId, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task AddAsync(Client client, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class StubClientSiteRepository : IClientSiteRepository
    {
        public bool CodeInUse { get; init; }
        public bool SiteExists { get; init; } = true;

        public Task<IReadOnlyList<ClientSite>> ListAsync(Guid idClient, CancellationToken cancellationToken) =>
            Task.FromResult((IReadOnlyList<ClientSite>)[]);

        public Task<ClientSite?> GetAsync(Guid idClient, Guid idClientSite, CancellationToken cancellationToken) =>
            Task.FromResult<ClientSite?>(null);

        public Task<bool> ExistsAsync(Guid idClient, Guid idClientSite, CancellationToken cancellationToken) =>
            Task.FromResult(SiteExists);

        public Task<bool> IsCodeInUseAsync(Guid idClient, string codeClientSite, Guid? excludedClientSiteId, CancellationToken cancellationToken) =>
            Task.FromResult(CodeInUse);

        public Task AddAsync(ClientSite site, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class StubClientContactRepository : IClientContactRepository
    {
        public Task<IReadOnlyList<ClientContact>> ListAsync(Guid idClient, CancellationToken cancellationToken) =>
            Task.FromResult((IReadOnlyList<ClientContact>)[]);

        public Task<ClientContact?> GetAsync(Guid idClient, Guid idClientContact, CancellationToken cancellationToken) =>
            Task.FromResult<ClientContact?>(null);

        public Task AddAsync(ClientContact contact, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class StubUnitOfWork : IUnitOfWork
    {
        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class StubActorContext : IActorContext
    {
        public Guid ActorId => ActorId;
        public string ActorName => "Tester";
    }

    private sealed class StubClock : IClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }
}
