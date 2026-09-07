using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

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
        // Lo genera SQL Server en cada escritura; el modelo solo lo lee.
        builder.Property(entity => entity.RowVersion).IsRowVersion();

        builder.HasIndex(entity => entity.IdScheduledShift).IsUnique();
        builder.HasIndex(entity => new { entity.IdEmployee, entity.AttendanceDate });
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.AttendanceDate });
    }
}
