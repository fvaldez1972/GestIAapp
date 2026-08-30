using GestIA.Domain.Catalogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EmployeeSkillConfiguration : IEntityTypeConfiguration<EmployeeSkill>
{
    public void Configure(EntityTypeBuilder<EmployeeSkill> builder)
    {
        builder.ToTable("EmployeeSkills", "dbo", table =>
            table.HasCheckConstraint(
                "CK_EmployeeSkills_DateRange",
                "[ExpiresDate] IS NULL OR [AcquiredDate] IS NULL OR [ExpiresDate] >= [AcquiredDate]"));
        builder.HasKey(entity => entity.IdEmployeeSkill);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.Employee)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.SkillCatalogItem)
            .WithMany()
            .HasForeignKey(entity => entity.IdSkillCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdEmployee, entity.IdSkillCatalogItem }).IsUnique();
        builder.HasIndex(entity => entity.ExpiresDate);
    }
}
