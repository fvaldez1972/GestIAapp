using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ShiftPatternConfiguration : IEntityTypeConfiguration<ShiftPattern>
{
    public void Configure(EntityTypeBuilder<ShiftPattern> builder)
    {
        builder.ToTable("ShiftPatterns", "dbo", table =>
            table.HasCheckConstraint(
                "CK_ShiftPatterns_EffectiveDateRange",
                "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]"));
        builder.HasKey(entity => entity.IdShiftPattern);
        builder.Property(entity => entity.CodeShiftPattern).HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(150).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(1000);
        builder.HasOne(entity => entity.Position)
            .WithMany(position => position.ShiftPatterns)
            .HasForeignKey(entity => entity.IdPosition)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdPosition, entity.CodeShiftPattern }).IsUnique();
    }
}
