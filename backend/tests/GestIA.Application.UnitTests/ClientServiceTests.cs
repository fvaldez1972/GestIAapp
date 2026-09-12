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

    /// <summary>
    /// Reactivar encuentra al cliente desactivado.
    ///
    /// <para>El diálogo de desactivar promete que «se puede reactivar», y durante un tiempo esa
    /// promesa no tenía nada detrás. Al construirla, la trampa está en el buscador: <c>GetAsync</c>
    /// respeta el filtro global de actividad, así que para él un cliente desactivado no existe.
    /// Escrito con él, reactivar respondería siempre «no se encontró el cliente» —el mismo error
    /// que se está intentando reparar, con otra cara.</para>
    /// </summary>
    [Fact]
    public async Task ActivateBringsBackADeactivatedClient()
    {
        var clients = new FakeClientRepository();
        var unitOfWork = new FakeUnitOfWork();
        var service = CreateService(clients, unitOfWork);

        var creado = await service.CreateAsync(
            Request("CLI-001", "Cliente que vuelve", "EXA010101AA1"),
            CancellationToken.None);
        await service.DeactivateAsync(OrganizationId, creado.IdClient, CancellationToken.None);
        Assert.False(clients.Items.Single().Active);

        var resultado = await service.ActivateAsync(OrganizationId, creado.IdClient, CancellationToken.None);

        Assert.True(clients.Items.Single().Active);
        Assert.Equal(creado.IdClient, resultado.IdClient);
    }

    /// <summary>
    /// Reactivar lo que ya está activo no escribe nada.
    ///
    /// <para>Dos personas pulsando el mismo botón no deben ver una la mitad de un fallo, y una
    /// reactivación repetida no tiene por qué dejar en la auditoría un cambio que no cambió nada.
    /// </para>
    /// </summary>
    [Fact]
    public async Task ActivateAnAlreadyActiveClientWritesNothing()
    {
        var clients = new FakeClientRepository();
        var unitOfWork = new FakeUnitOfWork();
        var service = CreateService(clients, unitOfWork);

        var creado = await service.CreateAsync(
            Request("CLI-001", "Cliente activo", "EXA010101AA1"),
            CancellationToken.None);
        var guardadosAntes = unitOfWork.SaveCount;

        await service.ActivateAsync(OrganizationId, creado.IdClient, CancellationToken.None);

        Assert.Equal(guardadosAntes, unitOfWork.SaveCount);
    }

    /// <summary>Un identificador que no es de ningún cliente sigue siendo un 404, no un silencio.</summary>
    [Fact]
    public async Task ActivateAnUnknownClientFails()
    {
        var service = CreateService(new FakeClientRepository(), new FakeUnitOfWork());

        await Assert.ThrowsAsync<ResourceNotFoundException>(() =>
            service.ActivateAsync(OrganizationId, Guid.NewGuid(), CancellationToken.None));
    }

    private static ClientService CreateService(
        FakeClientRepository clients,
        FakeUnitOfWork unitOfWork) => new(
            clients,
            new FakeOrganizationRepository(),
            unitOfWork,
            new FakeActorContext(),
            new FakeClock(), new GestIA.Application.Catalogs.FormCatalogValidator(null!));

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

        // Doble de prueba: la fecha sale del instante simulado, sin huso.
        public DateOnly Today => DateOnly.FromDateTime(UtcNow);

        // Doble de prueba: sin huso, la hora local es la UTC.
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
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

        public Task<int> HighestOrganizationCodeNumberAsync(CancellationToken cancellationToken) =>
            Task.FromResult(0);

        public Task<Organization?> GetAsync(
            Guid idOrganization,
            CancellationToken cancellationToken) => Task.FromResult<Organization?>(null);

        public Task<Organization?> GetTrackedAsync(
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

        /// <summary>
        /// El listado ya viaja proyectado desde el repositorio, así que el doble sólo devuelve lo
        /// que la tabla mostraría. Los conteos van en cero: quien los prueba de verdad es la
        /// prueba de integración, contra SQL.
        /// </summary>
        public Task<(IReadOnlyList<ClientListItemResponse> Items, int TotalCount)> SearchAsync(
            ClientSearchCriteria criteria,
            CancellationToken cancellationToken) =>
            Task.FromResult(((IReadOnlyList<ClientListItemResponse>)Items
                .Select(client => new ClientListItemResponse(
                    client.IdClient, client.IdOrganization, client.CodeClient, client.LegalName,
                    client.TradeName, client.Rfc, client.Active, client.CreatedAt,
                    0, 0, 0, 0, null, null, null))
                .ToArray(), Items.Count));

        public Task<IReadOnlyList<string>> ListMunicipalitiesAsync(
            Guid idOrganization,
            CancellationToken cancellationToken) =>
            Task.FromResult((IReadOnlyList<string>)[]);

        /// <summary>El código más alto ya usado. Cero deja que la generación empiece en CLI-01.</summary>
        public int HighestCodeNumber { get; set; }

        public Task<int> HighestClientCodeNumberAsync(
            Guid idOrganization,
            CancellationToken cancellationToken) =>
            Task.FromResult(HighestCodeNumber);

        public Task<Client?> GetAsync(
            Guid idOrganization,
            Guid idClient,
            CancellationToken cancellationToken) =>
            Task.FromResult(Items.SingleOrDefault(client => client.IdClient == idClient && client.Active));

        // El doble tiene que distinguir los dos: si ambos devuelven lo mismo, una prueba de
        // reactivación pasaría aunque el servicio usara el buscador que no ve a los desactivados,
        // que es justo el error que hay que impedir.
        public Task<Client?> GetIncludingInactiveAsync(
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
