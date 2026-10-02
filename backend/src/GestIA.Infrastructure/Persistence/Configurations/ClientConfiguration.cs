using GestIA.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.ToTable("Clients", "dbo");
        builder.HasKey(entity => entity.IdClient);
        builder.Property(entity => entity.CodeClient).HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.LegalName).HasMaxLength(200).IsRequired();
        builder.Property(entity => entity.TradeName).HasMaxLength(200);
        builder.Property(entity => entity.Rfc).HasMaxLength(13).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Nationality).HasMaxLength(80);
        builder.Property(entity => entity.TaxActivity).HasMaxLength(300);
        builder.Property(entity => entity.TaxAddress).HasMaxLength(500);
        builder.Property(entity => entity.CommercialRegistryFolio).HasMaxLength(80).IsUnicode(false);
        builder.Property(entity => entity.EmployerRegistrationNumber).HasMaxLength(30).IsUnicode(false);
        builder.Property(entity => entity.IncorporationDeedNumber).HasMaxLength(50).IsUnicode(false);
        builder.Property(entity => entity.LegalRepresentativeInstrumentNumber).HasMaxLength(80).IsUnicode(false);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.CodeClient }).IsUnique();
        builder.HasIndex(entity => new { entity.IdOrganization, entity.Rfc }).IsUnique();
    }
}
