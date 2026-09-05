using GestIA.Domain.Support;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

public sealed class SupportTimestampTests
{
    [Theory]
    [InlineData(nameof(SupportSession.StartsAt))]
    [InlineData(nameof(SupportSession.ExpiresAt))]
    [InlineData(nameof(SupportSession.EndedAt))]
    public void SupportValidityTimestampsPreserveSubsecondPrecision(string propertyName)
    {
        var options = new DbContextOptionsBuilder<GestIaDbContext>()
            .UseSqlServer("Server=localhost;Database=Unused;Integrated Security=true;TrustServerCertificate=true").Options;
        using var context = new GestIaDbContext(options, FixedOrganizationContext.None());
        var property = context.Model.FindEntityType(typeof(SupportSession))!.FindProperty(propertyName)!;
        Assert.Equal("datetime2(7)", property.GetColumnType());
    }
}
