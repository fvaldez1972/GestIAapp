using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ScheduleVersionConfiguration : IEntityTypeConfiguration<ScheduleVersion>
{
    public void Configure(EntityTypeBuilder<ScheduleVersion> builder)
    {
        builder.ToTable("ScheduleVersions", "dbo", table =>
            table.HasCheckConstraint(
                "CK_ScheduleVersions_DateRange",
                "[PeriodEndDate] >= [PeriodStartDate]"));
        builder.HasKey(entity => entity.IdScheduleVersion);
        builder.Property(entity => entity.Name).HasMaxLength(150).IsRequired();
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.PublishedByName).HasMaxLength(200);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdService, entity.PeriodStartDate, entity.PeriodEndDate });
        builder.HasIndex(entity => new { entity.IdService, entity.Status });
    }
}
