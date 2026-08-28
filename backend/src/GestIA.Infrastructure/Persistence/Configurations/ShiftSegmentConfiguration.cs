using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ShiftSegmentConfiguration : IEntityTypeConfiguration<ShiftSegment>
{
    public void Configure(EntityTypeBuilder<ShiftSegment> builder)
    {
        builder.ToTable("ShiftSegments", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_ShiftSegments_RequiredWorkerCount",
                "[RequiredWorkerCount] > 0");
            table.HasCheckConstraint(
                "CK_ShiftSegments_DurationMinutes",
                "[DurationMinutes] > 0 AND [DurationMinutes] <= 1440");
        });
        builder.HasKey(entity => entity.IdShiftSegment);
        builder.Property(entity => entity.DayOfWeek).HasConversion<string>().HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.ShiftPattern)
            .WithMany(pattern => pattern.Segments)
            .HasForeignKey(entity => entity.IdShiftPattern)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdShiftPattern, entity.DayOfWeek, entity.StartTime });
    }
}
