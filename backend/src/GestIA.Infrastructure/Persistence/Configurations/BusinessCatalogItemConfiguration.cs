using GestIA.Domain.Catalogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class BusinessCatalogItemConfiguration : IEntityTypeConfiguration<BusinessCatalogItem>
{
    public void Configure(EntityTypeBuilder<BusinessCatalogItem> builder)
    {
        builder.ToTable("BusinessCatalogItems", "dbo");
        builder.HasKey(entity => entity.IdBusinessCatalogItem);
        builder.Property(entity => entity.Type)
            .HasConversion<string>()
            .HasMaxLength(40)
            .IsUnicode(false)
            .IsRequired();
        builder.Property(entity => entity.Code).HasMaxLength(80).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(160).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(1000);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.Type, entity.Code }).IsUnique();
    }
}
