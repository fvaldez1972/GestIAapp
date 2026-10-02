using GestIA.Domain.Organizations;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

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
        builder.HasOne(entity => entity.Position)
            .WithMany()
            .HasForeignKey(entity => entity.IdPosition)
            .OnDelete(DeleteBehavior.Restrict);
        // Lo genera SQL Server en cada escritura; el modelo solo lo lee.
        builder.Property(entity => entity.RowVersion).IsRowVersion();

        builder.HasIndex(entity => new { entity.IdEmployee, entity.StartDate });
        builder.HasIndex(entity => new { entity.IdService, entity.StartDate });
        builder.HasIndex(entity => new { entity.IdPosition, entity.StartDate });
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.StartDate });
    }
}
