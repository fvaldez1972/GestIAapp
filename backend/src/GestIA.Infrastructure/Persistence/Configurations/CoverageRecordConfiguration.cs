using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class CoverageRecordConfiguration : IEntityTypeConfiguration<CoverageRecord>
{
    public void Configure(EntityTypeBuilder<CoverageRecord> builder)
    {
        builder.ToTable("CoverageRecords", "dbo", table =>
            table.HasCheckConstraint("CK_CoverageRecords_DurationMinutes", "[DurationMinutes] > 0 AND [DurationMinutes] <= 1440"));
        builder.HasKey(entity => entity.IdCoverageRecord);
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne<GestIA.Domain.Catalogs.BusinessCatalogItem>()
            .WithMany().HasForeignKey(entity => entity.IdCoverageReason).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.ScheduledShift)
            .WithMany()
            .HasForeignKey(entity => entity.IdScheduledShift)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.OriginalEmployee)
            .WithMany()
            .HasForeignKey(entity => entity.IdOriginalEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.ReplacementEmployee)
            .WithMany()
            .HasForeignKey(entity => entity.IdReplacementEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => entity.IdScheduledShift);
        builder.HasIndex(entity => entity.IdReplacementEmployee);
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.Status });
    }
}
