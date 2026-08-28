using GestIA.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class IncidentConfiguration : IEntityTypeConfiguration<Incident>
{
    public void Configure(EntityTypeBuilder<Incident> builder)
    {
        builder.ToTable("Incidents", "dbo");
        builder.HasKey(entity => entity.IdIncident);
        builder.Property(entity => entity.IncidentType).HasMaxLength(80).IsRequired();
        builder.Property(entity => entity.Severity).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(2000).IsRequired();
        builder.Property(entity => entity.ResolutionNotes).HasMaxLength(2000);
        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.ScheduledShift)
            .WithMany()
            .HasForeignKey(entity => entity.IdScheduledShift)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Employee)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdService, entity.IncidentDate });
        builder.HasIndex(entity => new { entity.IdEmployee, entity.IncidentDate });
    }
}
