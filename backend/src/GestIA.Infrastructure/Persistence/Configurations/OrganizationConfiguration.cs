using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("Organizations", "dbo");
        builder.HasKey(entity => entity.IdOrganization);
        builder.Property(entity => entity.CodeOrganization).HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.LegalName).HasMaxLength(200).IsRequired();
        builder.Property(entity => entity.Rfc).HasMaxLength(13).IsUnicode(false);
        builder.HasIndex(entity => entity.CodeOrganization).IsUnique();
        builder.HasIndex(entity => entity.Rfc).IsUnique().HasFilter("[Rfc] IS NOT NULL");
    }
}
