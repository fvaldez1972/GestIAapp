using System.Text.Json;
using GestIA.Application.Common;
using GestIA.Application.Documents;
using GestIA.Domain.Documents;

namespace GestIA.Application.UnitTests;

public sealed class BusinessDocumentServiceTests
{
    private static readonly Guid OrganizationId = Guid.Parse("65f1126a-ac8d-4f65-a80b-70161bdc835d");
    private static readonly Guid OwnerId = Guid.Parse("93b9d6c4-8f34-4c0a-8dc7-44328993b6df");
    private static readonly DateTime Now = new(2026, 9, 3, 12, 0, 0, DateTimeKind.Utc);
    private static readonly string[] ExpectedActions = ["Created", "Reviewed", "Updated", "Archived"];

    [Theory]
    [InlineData("detail")]
    [InlineData("history")]
    [InlineData("edit")]
    [InlineData("review")]
    [InlineData("archive")]
    public async Task SensitiveDocumentRequiresPermissionBeforeReadOrMutation(string operation)
    {
        var repository = new Repository(Document(true));
        var unit = new UnitOfWork();
        var service = Service(repository, unit, false);
        var before = BusinessDocumentSnapshot.Capture(repository.Document!);

        await Assert.ThrowsAsync<ResourceForbiddenException>(() => Execute(service, repository.Document!, operation));
        Assert.Equal(before, BusinessDocumentSnapshot.Capture(repository.Document!));
        Assert.Empty(repository.Events);
        Assert.Equal(0, repository.HistoryReads);
        Assert.Equal(0, unit.Saves);
    }

    [Theory]
    [InlineData("detail")]
    [InlineData("history")]
    [InlineData("edit")]
    [InlineData("review")]
    [InlineData("archive")]
    public async Task PermissionDoesNotBypassOrganizationScope(string operation)
    {
        var document = Document(true, Guid.NewGuid());
        var repository = new Repository(document);
        var unit = new UnitOfWork();
        await Assert.ThrowsAsync<ResourceNotFoundException>(() => Execute(Service(repository, unit, true), document, operation));
        Assert.Empty(repository.Events);
        Assert.Equal(0, unit.Saves);
    }

    [Fact]
    public async Task NonSensitiveAliasOfSensitiveFileAlsoRequiresPermission()
    {
        var repository = new Repository(Document(false)) { SensitiveReference = true };
        await Assert.ThrowsAsync<ResourceForbiddenException>(() =>
            Service(repository, new UnitOfWork(), false).GetAsync(OrganizationId, repository.Document!.IdBusinessDocument, default));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ListPassesSensitivityFilterAndTenantToRepository(bool permitted)
    {
        var repository = new Repository(null);
        await Service(repository, new UnitOfWork(), permitted).ListAsync(
            new BusinessDocumentQuery(OrganizationId, null, null, null, null, 2, 10), default);
        Assert.NotNull(repository.Criteria);
        Assert.Equal(permitted, repository.Criteria.IncludeSensitive);
        Assert.Equal(OrganizationId, repository.Criteria.IdOrganization);
        Assert.Equal(10, repository.Criteria.Skip);
    }

    [Fact]
    public async Task SensitiveCreationAndPromotionRequirePermission()
    {
        var repository = new Repository(Document(false));
        var unit = new UnitOfWork();
        var service = Service(repository, unit, false);
        await Assert.ThrowsAsync<ResourceForbiddenException>(() => service.CreateAsync(CreateRequest(true), default));
        await Assert.ThrowsAsync<ResourceForbiddenException>(() =>
            service.UpdateAsync(repository.Document!.IdBusinessDocument, UpdateRequest(true), default));
        Assert.Empty(repository.Events);
        Assert.Equal(0, unit.Saves);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task OwnerCannotChangeEvenWithSensitivePermission(bool changeType)
    {
        var repository = new Repository(Document(true));
        var request = UpdateRequest(true);
        request = changeType ? request with { OwnerType = BusinessDocumentOwnerType.Employee } : request with { OwnerId = Guid.NewGuid() };
        await Assert.ThrowsAsync<ResourceConflictException>(() =>
            Service(repository, new UnitOfWork(), true).UpdateAsync(repository.Document!.IdBusinessDocument, request, default));
        Assert.Empty(repository.Events);
        Assert.Equal(OwnerId, repository.Document!.OwnerId);
    }

    [Fact]
    public async Task SensitiveHistoryCannotBeDeclassifiedByEditing()
    {
        var repository = new Repository(Document(true));
        await Assert.ThrowsAsync<ResourceConflictException>(() =>
            Service(repository, new UnitOfWork(), true).UpdateAsync(repository.Document!.IdBusinessDocument, UpdateRequest(false), default));
        Assert.True(repository.Document!.IsSensitive);
    }

    [Fact]
    public async Task CreationRejectsAnotherTenantsStorageReference()
    {
        var repository = new Repository(null);
        var request = CreateRequest(false) with { StorageReference = $"business-documents/{Guid.NewGuid():N}/file.pdf" };
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            Service(repository, new UnitOfWork(), true).CreateAsync(request, default));
        Assert.Null(repository.Document);
        Assert.Empty(repository.Events);
    }

    [Fact]
    public async Task EveryMutationCapturesImmutableBeforeAndAfterMetadata()
    {
        var repository = new Repository(null);
        var unit = new UnitOfWork();
        var service = Service(repository, unit, true);
        var created = await service.CreateAsync(CreateRequest(true) with { Notes = "password=do-not-audit" }, default);
        var createdEvent = Assert.Single(repository.Events);
        Assert.Null(createdEvent.BeforeSnapshot);
        var originalAfter = createdEvent.AfterSnapshot;
        await service.ReviewAsync(created.IdBusinessDocument,
            new ReviewBusinessDocumentRequest(OrganizationId, BusinessDocumentStatus.Validated, "password=review-secret"), default);
        await service.UpdateAsync(created.IdBusinessDocument, UpdateRequest(true) with { Title = "Revised" }, default);
        await service.DeactivateAsync(OrganizationId, created.IdBusinessDocument, default);

        Assert.Equal(4, unit.Saves);
        Assert.Equal(ExpectedActions, repository.Events.Select(item => item.Action));
        for (var index = 1; index < repository.Events.Count; index++)
        {
            Assert.Equal(repository.Events[index - 1].AfterSnapshot, repository.Events[index].BeforeSnapshot);
        }
        Assert.Equal(originalAfter, createdEvent.AfterSnapshot);
        Assert.All(repository.Events, item =>
        {
            Assert.Null(item.Notes);
            Assert.DoesNotContain("password", item.AfterSnapshot!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("StorageReference", item.AfterSnapshot!, StringComparison.Ordinal);
        });
        using var last = JsonDocument.Parse(repository.Events[^1].AfterSnapshot!);
        Assert.False(last.RootElement.GetProperty("Active").GetBoolean());
        var history = await service.ListEventsAsync(OrganizationId, created.IdBusinessDocument, default);
        Assert.Equal(repository.Events[^1].BeforeSnapshot, history[^1].BeforeSnapshot);
        Assert.Equal(repository.Events[^1].AfterSnapshot, history[^1].AfterSnapshot);
    }

    [Fact]
    public async Task ExistingLegacyReferenceCanBeKeptButCannotBeAttachedToNewDocument()
    {
        var document = Document(false, storageReference: "business-documents/2026/09/legacy.pdf");
        var repository = new Repository(document);
        var service = Service(repository, new UnitOfWork(), false);
        await service.UpdateAsync(document.IdBusinessDocument, UpdateRequest(false) with { StorageReference = document.StorageReference }, default);
        await Assert.ThrowsAsync<RequestValidationException>(() =>
            service.CreateAsync(CreateRequest(false) with { StorageReference = document.StorageReference }, default));
    }

    private static Task Execute(BusinessDocumentService service, BusinessDocument document, string operation) => operation switch
    {
        "detail" => service.GetAsync(OrganizationId, document.IdBusinessDocument, default),
        "history" => service.ListEventsAsync(OrganizationId, document.IdBusinessDocument, default),
        "edit" => service.UpdateAsync(document.IdBusinessDocument, UpdateRequest(true), default),
        "review" => service.ReviewAsync(document.IdBusinessDocument,
            new ReviewBusinessDocumentRequest(OrganizationId, BusinessDocumentStatus.Validated, null), default),
        "archive" => service.DeactivateAsync(OrganizationId, document.IdBusinessDocument, default),
        _ => throw new ArgumentOutOfRangeException(nameof(operation))
    };

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task SensitiveMutationsRequireBothReadAndWrite(bool read, bool write)
    {
        var repository = new Repository(Document(true));
        var unit = new UnitOfWork();
        var service = new BusinessDocumentService(repository, unit, new Actor(read, write), new Clock());
        await Assert.ThrowsAsync<ResourceForbiddenException>(() => service.CreateAsync(CreateRequest(true), default));
        await Assert.ThrowsAsync<ResourceForbiddenException>(() => Execute(service, repository.Document!, "edit"));
        await Assert.ThrowsAsync<ResourceForbiddenException>(() => Execute(service, repository.Document!, "review"));
        await Assert.ThrowsAsync<ResourceForbiddenException>(() => Execute(service, repository.Document!, "archive"));
        Assert.Empty(repository.Events);
        Assert.Equal(0, unit.Saves);
        if (read)
        {
            await service.GetAsync(OrganizationId, repository.Document!.IdBusinessDocument, default);
            await service.ListEventsAsync(OrganizationId, repository.Document.IdBusinessDocument, default);
        }
    }

    private static BusinessDocumentService Service(Repository repository, UnitOfWork unit, bool permitted) =>
        new(repository, unit, new Actor(permitted, permitted), new Clock());

    private static CreateBusinessDocumentRequest CreateRequest(bool sensitive) => new(
        OrganizationId, BusinessDocumentOwnerType.Client, OwnerId, "Contract", "Original", BusinessDocumentStatus.PendingReview,
        null, null, $"business-documents/{OrganizationId:N}/2026/09/file.pdf", sensitive, null);

    private static UpdateBusinessDocumentRequest UpdateRequest(bool sensitive)
    {
        var request = CreateRequest(sensitive);
        return new(request.IdOrganization, request.OwnerType, request.OwnerId, request.Category, request.Title, request.Status,
            request.IssuedDate, request.ExpiresDate, request.StorageReference, request.IsSensitive, request.Notes);
    }

    private static BusinessDocument Document(bool sensitive, Guid? organizationId = null, string? storageReference = null)
    {
        var request = CreateRequest(sensitive);
        return BusinessDocument.Create(organizationId ?? OrganizationId, new BusinessDocumentProfile(
            request.OwnerType, request.OwnerId, request.Category, request.Title, request.Status,
            request.IssuedDate, request.ExpiresDate, storageReference ?? request.StorageReference, request.IsSensitive, request.Notes),
            OwnerId, "Tester", Now);
    }

    private sealed class Actor(bool read, bool write) : IActorContext
    {
        public Guid ActorId => OwnerId;
        public string ActorName => "Tester";
        public bool HasPermission(string permission) => permission switch
        {
            BusinessDocumentPermissions.SensitiveRead => read,
            BusinessDocumentPermissions.SensitiveWrite => write,
            _ => false
        };
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => Now;

        // Doble de prueba: la fecha sale del instante simulado, sin huso.
        public DateOnly Today => DateOnly.FromDateTime(UtcNow);

        // Doble de prueba: sin huso, la hora local es la UTC.
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public int Saves { get; private set; }
        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            Saves++;
            return Task.CompletedTask;
        }
    }

    private sealed class Repository(BusinessDocument? document) : IBusinessDocumentRepository
    {
        public BusinessDocument? Document { get; private set; } = document;
        public List<BusinessDocumentEvent> Events { get; } = [];
        public BusinessDocumentSearchCriteria? Criteria { get; private set; }
        public bool SensitiveReference { get; init; }
        public int HistoryReads { get; private set; }

        public Task<BusinessDocumentSearchResult> SearchAsync(BusinessDocumentSearchCriteria criteria, CancellationToken cancellationToken)
        {
            Criteria = criteria;
            return Task.FromResult(new BusinessDocumentSearchResult([], 0, criteria.Skip / criteria.Take + 1, criteria.Take));
        }

        public Task<BusinessDocument?> GetAsync(Guid organizationId, Guid documentId, CancellationToken cancellationToken) =>
            Task.FromResult(Document?.IdOrganization == organizationId && Document.IdBusinessDocument == documentId ? Document : null);
        public Task<bool> OwnerExistsAsync(Guid organizationId, BusinessDocumentOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) =>
            Task.FromResult(organizationId == OrganizationId && ownerId == OwnerId);
        public Task<bool> IsSensitiveStorageReferenceAsync(string storageReference, CancellationToken cancellationToken) =>
            Task.FromResult(SensitiveReference || (Document?.IsSensitive == true && Document.StorageReference == storageReference));
        public Task<bool> IsDocumentStorageReferenceAsync(string storageReference, CancellationToken cancellationToken) =>
            Task.FromResult(Document?.StorageReference == storageReference);
        public Task AddAsync(BusinessDocument value, CancellationToken cancellationToken)
        {
            Document = value;
            return Task.CompletedTask;
        }
        public Task AddEventAsync(BusinessDocumentEvent documentEvent, CancellationToken cancellationToken)
        {
            Events.Add(documentEvent);
            return Task.CompletedTask;
        }
        public Task<IReadOnlyList<BusinessDocumentEvent>> ListEventsAsync(Guid organizationId, Guid documentId, CancellationToken cancellationToken)
        {
            HistoryReads++;
            return Task.FromResult<IReadOnlyList<BusinessDocumentEvent>>(Events
                .Where(item => item.IdOrganization == organizationId && item.IdBusinessDocument == documentId).ToArray());
        }
    }
}
