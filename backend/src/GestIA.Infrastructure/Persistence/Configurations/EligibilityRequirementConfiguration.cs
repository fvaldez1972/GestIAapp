using GestIA.Domain.Catalogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EligibilityRequirementConfiguration : IEntityTypeConfiguration<EligibilityRequirement>
{
    /// <summary>
    /// Cada tipo de regla exige lo suyo, y exactamente uno. Vive como constante para que la
    /// migracion y el modelo no puedan separarse.
    /// </summary>
    public const string RequirementByTypeSql =
        "(RequirementType = 'Skill' AND IdRequiredCatalogItem IS NOT NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NULL) " +
        "OR (RequirementType = 'Document' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NOT NULL AND RequiredEvaluationType IS NULL) " +
        "OR (RequirementType = 'Evaluation' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NOT NULL) " +
        "OR (RequirementType = 'Restriction' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NULL)";

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
        builder.Property(entity => entity.RequiredDocumentType)
            .HasConversion<string>()
            .HasMaxLength(60)
            .IsUnicode(false);
        builder.Property(entity => entity.RequiredEvaluationType)
            .HasConversion<string>()
            .HasMaxLength(60)
            .IsUnicode(false);
        builder.HasOne(entity => entity.RequiredCatalogItem)
            .WithMany()
            .HasForeignKey(entity => entity.IdRequiredCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);
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
            entity.RequirementType
        });

        // Cada tipo de regla exige lo suyo, y exactamente uno. La entidad lo comprueba para poder
        // decir cual falta; esto lo garantiza aunque una fila entre por otro camino.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_EligibilityRequirements_RequirementByType",
            RequirementByTypeSql));
    }
}
