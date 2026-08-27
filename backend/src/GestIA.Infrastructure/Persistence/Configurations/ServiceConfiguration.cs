using GestIA.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ServiceConfiguration : IEntityTypeConfiguration<Service>
{
    public void Configure(EntityTypeBuilder<Service> builder)
    {
        builder.ToTable("Services", "dbo", table =>
            table.HasCheckConstraint(
                "CK_Services_DateRange",
                "[EndDate] IS NULL OR [EndDate] >= [StartDate]"));
        builder.HasKey(entity => entity.IdService);
        builder.Property(entity => entity.CodeService).HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(150).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(1000).IsRequired();
        builder.Property(entity => entity.InvoiceDescription).HasMaxLength(500);
        builder.HasOne(entity => entity.Client)
            .WithMany()
            .HasForeignKey(entity => entity.IdClient)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.ClientSite)
            .WithMany()
            .HasForeignKey(entity => entity.IdClientSite)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.ServiceContract)
            .WithMany()
            .HasForeignKey(entity => entity.IdServiceContract)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdClient, entity.CodeService }).IsUnique();
        builder.HasIndex(entity => entity.IdClientSite);
        builder.HasIndex(entity => entity.IdServiceContract);
    }
}
