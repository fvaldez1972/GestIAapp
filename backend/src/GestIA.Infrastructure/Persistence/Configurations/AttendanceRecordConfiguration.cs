using GestIA.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class AttendanceRecordConfiguration : IEntityTypeConfiguration<AttendanceRecord>
{
    public void Configure(EntityTypeBuilder<AttendanceRecord> builder)
    {
        builder.ToTable("AttendanceRecords", "dbo", table =>
            table.HasCheckConstraint("CK_AttendanceRecords_MinutesLate", "[MinutesLate] >= 0"));
        builder.HasKey(entity => entity.IdAttendanceRecord);
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.ScheduledShift)
            .WithMany()
            .HasForeignKey(entity => entity.IdScheduledShift)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Employee)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => entity.IdScheduledShift).IsUnique();
        builder.HasIndex(entity => new { entity.IdEmployee, entity.AttendanceDate });
    }
}
