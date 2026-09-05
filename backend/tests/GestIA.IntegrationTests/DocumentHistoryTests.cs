using GestIA.Domain.Documents;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

public sealed class DocumentHistoryTests
{
    [Fact]
    public void SnapshotColumnsArePersistentNullableTextForLegacyEvents()
    {
        var options = new DbContextOptionsBuilder<GestIaDbContext>()
            .UseSqlServer("Server=localhost;Database=Unused;Integrated Security=true;TrustServerCertificate=true").Options;
        using var context = new GestIaDbContext(options, FixedOrganizationContext.None());
        var entity = context.Model.FindEntityType(typeof(BusinessDocumentEvent))!;
        foreach (var name in new[] { nameof(BusinessDocumentEvent.BeforeSnapshot), nameof(BusinessDocumentEvent.AfterSnapshot) })
        {
            var property = entity.FindProperty(name)!;
            Assert.Equal("nvarchar(max)", property.GetColumnType());
            Assert.True(property.IsNullable);
        }
    }

    [Theory]
    [InlineData(EntityState.Modified)]
    [InlineData(EntityState.Deleted)]
    public async Task HistoryCannotBeUpdatedOrDeleted(EntityState state)
    {
        var options = new DbContextOptionsBuilder<GestIaDbContext>()
            .UseSqlServer("Server=localhost;Database=Unused;Integrated Security=true;TrustServerCertificate=true").Options;
        // Adjunta y guarda; no consulta, así que el filtro de organización no interviene.
        await using var context = new GestIaDbContext(options, FixedOrganizationContext.None());
        var actorId = Guid.NewGuid();
        var document = BusinessDocument.Create(Guid.NewGuid(), new BusinessDocumentProfile(
            BusinessDocumentOwnerType.Client, Guid.NewGuid(), "Contract", "Test", BusinessDocumentStatus.PendingReview,
            null, null, "test.pdf", false, null), actorId, "Admin", DateTime.UtcNow);
        var item = BusinessDocumentEvent.Record(document, "Created", null, actorId, "Admin", DateTime.UtcNow);
        context.Attach(item);
        context.Entry(item).State = state;
        await Assert.ThrowsAsync<InvalidOperationException>(() => context.SaveChangesAsync());
        Assert.Throws<InvalidOperationException>(() => context.SaveChanges());
    }
}
