using GestIA.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ClientContactConfiguration : IEntityTypeConfiguration<ClientContact>
{
    public void Configure(EntityTypeBuilder<ClientContact> builder)
    {
        builder.ToTable("ClientContacts", "dbo");
        builder.HasKey(entity => entity.IdClientContact);
        builder.Property(entity => entity.Purpose).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.FullName).HasMaxLength(200).IsRequired();
        builder.Property(entity => entity.JobTitle).HasMaxLength(120);
        builder.Property(entity => entity.Email).HasMaxLength(254).IsUnicode(false);
        builder.Property(entity => entity.Phone).HasMaxLength(30).IsUnicode(false);
        builder.Property(entity => entity.MobilePhone).HasMaxLength(30).IsUnicode(false);
        builder.HasOne(entity => entity.Client)
            .WithMany(client => client.Contacts)
            .HasForeignKey(entity => entity.IdClient)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.ClientSite)
            .WithMany()
            .HasForeignKey(entity => entity.IdClientSite)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdClient, entity.Purpose });
        builder.HasIndex(entity => entity.IdClientSite);
    }
}
