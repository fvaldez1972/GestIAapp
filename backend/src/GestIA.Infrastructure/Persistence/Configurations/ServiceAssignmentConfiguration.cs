using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ServiceAssignmentConfiguration : IEntityTypeConfiguration<ServiceAssignment>
{
    public void Configure(EntityTypeBuilder<ServiceAssignment> builder)
    {
        builder.ToTable("ServiceAssignments", "dbo", table =>
            table.HasCheckConstraint(
                "CK_ServiceAssignments_DateRange",
                "[EndDate] IS NULL OR [EndDate] >= [StartDate]"));
        builder.HasKey(entity => entity.IdServiceAssignment);
        builder.Property(entity => entity.AssignmentType).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.Employee)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdEmployee, entity.StartDate });
        builder.HasIndex(entity => new { entity.IdService, entity.StartDate });
    }
}
