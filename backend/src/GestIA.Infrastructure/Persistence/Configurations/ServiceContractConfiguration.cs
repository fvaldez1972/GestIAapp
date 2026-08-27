using GestIA.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ServiceContractConfiguration : IEntityTypeConfiguration<ServiceContract>
{
    public void Configure(EntityTypeBuilder<ServiceContract> builder)
    {
        builder.ToTable("ServiceContracts", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_ServiceContracts_EffectiveDateRange",
                "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
            table.HasCheckConstraint(
                "CK_ServiceContracts_PaymentTermDays",
                "[PaymentTermDays] >= 0");
            table.HasCheckConstraint(
                "CK_ServiceContracts_TerminationNoticeDays",
                "[TerminationNoticeDays] >= 0");
        });
        builder.HasKey(entity => entity.IdServiceContract);
        builder.Property(entity => entity.CodeServiceContract).HasMaxLength(50).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.CurrencyCode).HasMaxLength(3).IsUnicode(false).HasDefaultValue("MXN").IsRequired();
        builder.Property(entity => entity.DocumentReference).HasMaxLength(500);
        builder.Property(entity => entity.Notes).HasMaxLength(2000);
        builder.HasOne(entity => entity.Client)
            .WithMany()
            .HasForeignKey(entity => entity.IdClient)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdClient, entity.CodeServiceContract }).IsUnique();
        builder.HasIndex(entity => new { entity.IdClient, entity.Status });
    }
}
