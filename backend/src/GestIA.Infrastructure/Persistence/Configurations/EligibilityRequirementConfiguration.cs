using GestIA.Domain.Catalogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EligibilityRequirementConfiguration : IEntityTypeConfiguration<EligibilityRequirement>
{
    public void Configure(EntityTypeBuilder<EligibilityRequirement> builder)
    {
        builder.ToTable("EligibilityRequirements", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_EligibilityRequirements_Target_ExactlyOne",
                "([TargetType] = 'Organization' AND [IdClient] IS NULL AND [IdService] IS NULL AND [IdPosition] IS NULL) OR " +
                "([TargetType] = 'Client' AND [IdClient] IS NOT NULL AND [IdService] IS NULL AND [IdPosition] IS NULL) OR " +
                "([TargetType] = 'Service' AND [IdClient] IS NULL AND [IdService] IS NOT NULL AND [IdPosition] IS NULL) OR " +
                "([TargetType] = 'Position' AND [IdClient] IS NULL AND [IdService] IS NULL AND [IdPosition] IS NOT NULL)");
        });
        builder.HasKey(entity => entity.IdEligibilityRequirement);
        builder.Property(entity => entity.TargetType)
            .HasConversion<string>()
            .HasMaxLength(40)
            .IsUnicode(false)
            .IsRequired();
        builder.Property(entity => entity.RequirementType)
            .HasConversion<string>()
            .HasMaxLength(40)
            .IsUnicode(false)
            .IsRequired();
        builder.Property(entity => entity.RequiredCode).HasMaxLength(80).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(160).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(1000);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Client)
            .WithMany()
            .HasForeignKey(entity => entity.IdClient)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Position)
            .WithMany()
            .HasForeignKey(entity => entity.IdPosition)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new
        {
            entity.IdOrganization,
            entity.TargetType,
            entity.RequirementType,
            entity.RequiredCode
        });
    }
}
