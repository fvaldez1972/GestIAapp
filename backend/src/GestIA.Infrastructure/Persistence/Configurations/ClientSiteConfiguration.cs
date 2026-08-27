using GestIA.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ClientSiteConfiguration : IEntityTypeConfiguration<ClientSite>
{
    public void Configure(EntityTypeBuilder<ClientSite> builder)
    {
        builder.ToTable("ClientSites", "dbo");
        builder.HasKey(entity => entity.IdClientSite);
        builder.Property(entity => entity.CodeClientSite).HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(150).IsRequired();
        builder.Property(entity => entity.Street).HasMaxLength(200).IsRequired();
        builder.Property(entity => entity.ExteriorNumber).HasMaxLength(30);
        builder.Property(entity => entity.InteriorNumber).HasMaxLength(30);
        builder.Property(entity => entity.Neighborhood).HasMaxLength(120);
        builder.Property(entity => entity.Municipality).HasMaxLength(120).IsRequired();
        builder.Property(entity => entity.State).HasMaxLength(120).IsRequired();
        builder.Property(entity => entity.PostalCode).HasMaxLength(10).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.CountryCode).HasMaxLength(2).IsUnicode(false).HasDefaultValue("MX").IsRequired();
        builder.Property(entity => entity.AccessInstructions).HasMaxLength(1000);
        builder.Property(entity => entity.TimeZoneId).HasMaxLength(100).IsUnicode(false);
        builder.HasOne(entity => entity.Client)
            .WithMany(client => client.Sites)
            .HasForeignKey(entity => entity.IdClient)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdClient, entity.CodeClientSite }).IsUnique();
    }
}
