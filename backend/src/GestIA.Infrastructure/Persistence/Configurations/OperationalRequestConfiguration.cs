using GestIA.Domain.Requests;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class OperationalRequestConfiguration : IEntityTypeConfiguration<OperationalRequest>
{
    public void Configure(EntityTypeBuilder<OperationalRequest> builder)
    {
        builder.ToTable("OperationalRequests", "dbo");
        builder.HasKey(entity => entity.IdOperationalRequest);
        builder.Property(entity => entity.CodeOperationalRequest).HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.RequestType).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Priority).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Title).HasMaxLength(180).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(2000).IsRequired();
        builder.Property(entity => entity.RequestedByName).HasMaxLength(160).IsRequired();
        builder.Property(entity => entity.ResolutionNotes).HasMaxLength(1000);
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
        builder.HasIndex(entity => new { entity.IdOrganization, entity.CodeOperationalRequest }).IsUnique();
        builder.HasIndex(entity => new { entity.IdOrganization, entity.Status, entity.Priority });
        builder.HasIndex(entity => new { entity.IdOrganization, entity.RequestType });
    }
}
