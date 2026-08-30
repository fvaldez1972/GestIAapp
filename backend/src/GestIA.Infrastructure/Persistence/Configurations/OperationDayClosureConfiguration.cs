using GestIA.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class OperationDayClosureConfiguration : IEntityTypeConfiguration<OperationDayClosure>
{
    public void Configure(EntityTypeBuilder<OperationDayClosure> builder)
    {
        builder.ToTable("OperationDayClosures", "dbo", table =>
        {
            table.HasCheckConstraint("CK_OperationDayClosures_ExpectedShifts", "[ExpectedShifts] >= 0");
            table.HasCheckConstraint("CK_OperationDayClosures_AttendanceRecords", "[AttendanceRecords] >= 0");
            table.HasCheckConstraint("CK_OperationDayClosures_PendingAttendance", "[PendingAttendance] >= 0");
            table.HasCheckConstraint("CK_OperationDayClosures_OpenIncidents", "[OpenIncidents] >= 0");
            table.HasCheckConstraint("CK_OperationDayClosures_CoverageRecords", "[CoverageRecords] >= 0");
        });
        builder.HasKey(entity => entity.IdOperationDayClosure);
        builder.Property(entity => entity.Notes).HasMaxLength(1200);
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.ClosedByName).HasMaxLength(100).IsRequired();
        builder.Property(entity => entity.ReopenedByName).HasMaxLength(100);
        builder.Property(entity => entity.ReopenReason).HasMaxLength(1200);
        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.OperationDate });
        builder.HasIndex(entity => new { entity.IdService, entity.OperationDate }).IsUnique();
    }
}
