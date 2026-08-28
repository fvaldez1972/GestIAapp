using GestIA.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class OperationEvidenceConfiguration : IEntityTypeConfiguration<OperationEvidence>
{
    public void Configure(EntityTypeBuilder<OperationEvidence> builder)
    {
        builder.ToTable("OperationEvidences", "dbo", table =>
            table.HasCheckConstraint(
                "CK_OperationEvidences_RelatedRecord_ExactlyOne",
                "(([IdAttendanceRecord] IS NOT NULL AND [IdIncident] IS NULL AND [IdCoverageRecord] IS NULL) OR " +
                "([IdAttendanceRecord] IS NULL AND [IdIncident] IS NOT NULL AND [IdCoverageRecord] IS NULL) OR " +
                "([IdAttendanceRecord] IS NULL AND [IdIncident] IS NULL AND [IdCoverageRecord] IS NOT NULL))"));

        builder.HasKey(entity => entity.IdOperationEvidence);
        builder.Property(entity => entity.EvidenceType).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Title).HasMaxLength(180).IsRequired();
        builder.Property(entity => entity.StorageReference).HasMaxLength(500).IsRequired();
        builder.Property(entity => entity.Notes).HasMaxLength(1000);

        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.AttendanceRecord)
            .WithMany()
            .HasForeignKey(entity => entity.IdAttendanceRecord)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.Incident)
            .WithMany()
            .HasForeignKey(entity => entity.IdIncident)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.CoverageRecord)
            .WithMany()
            .HasForeignKey(entity => entity.IdCoverageRecord)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => entity.IdService);
        builder.HasIndex(entity => entity.IdAttendanceRecord);
        builder.HasIndex(entity => entity.IdIncident);
        builder.HasIndex(entity => entity.IdCoverageRecord);
        builder.HasIndex(entity => entity.EvidenceType);
    }
}
