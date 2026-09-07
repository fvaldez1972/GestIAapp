using GestIA.Domain.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class SupportSessionConfiguration : IEntityTypeConfiguration<SupportSession>
{
    public void Configure(EntityTypeBuilder<SupportSession> builder)
    {
        builder.ToTable("SupportSessions", "dbo", table =>
            table.HasCheckConstraint("CK_SupportSessions_Expiration", "[ExpiresAt] > [StartsAt]"));
        builder.HasKey(entity => entity.IdSupportSession);
        builder.Property(entity => entity.Reason).HasMaxLength(500).IsRequired();
        builder.Property(entity => entity.StartsAt).HasColumnType("datetime2(7)");
        builder.Property(entity => entity.ExpiresAt).HasColumnType("datetime2(7)");
        builder.Property(entity => entity.EndedAt).HasColumnType("datetime2(7)");
        builder.Property(entity => entity.EndedByName).HasMaxLength(100);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.CreatedBy, entity.Active, entity.ExpiresAt });
        builder.HasIndex(entity => new { entity.IdOrganization, entity.StartsAt });
    }
}
