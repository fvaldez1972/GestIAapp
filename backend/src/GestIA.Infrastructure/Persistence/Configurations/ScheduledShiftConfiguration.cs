using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ScheduledShiftConfiguration : IEntityTypeConfiguration<ScheduledShift>
{
    public void Configure(EntityTypeBuilder<ScheduledShift> builder)
    {
        builder.ToTable("ScheduledShifts", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_ScheduledShifts_DurationMinutes",
                "[DurationMinutes] > 0 AND [DurationMinutes] <= 1440");
        });
        builder.HasKey(entity => entity.IdScheduledShift);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.ScheduleVersion)
            .WithMany(version => version.Shifts)
            .HasForeignKey(entity => entity.IdScheduleVersion)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Position)
            .WithMany()
            .HasForeignKey(entity => entity.IdPosition)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Employee)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdScheduleVersion, entity.ShiftDate });
        builder.HasIndex(entity => new { entity.IdEmployee, entity.ShiftDate, entity.StartTime });
        builder.HasIndex(entity => new { entity.IdPosition, entity.ShiftDate, entity.StartTime });
    }
}
