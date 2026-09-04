using GestIA.Domain.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class BusinessDocumentEventConfiguration : IEntityTypeConfiguration<BusinessDocumentEvent>
{
    public void Configure(EntityTypeBuilder<BusinessDocumentEvent> builder)
    {
        builder.ToTable("BusinessDocumentEvents", "dbo");
        builder.HasKey(item => item.IdBusinessDocumentEvent);
        builder.Property(item => item.Action).HasMaxLength(40).IsRequired();
        builder.Property(item => item.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(item => item.Notes).HasMaxLength(1000);
        builder.Property(item => item.BeforeSnapshot).HasColumnType("nvarchar(max)");
        builder.Property(item => item.AfterSnapshot).HasColumnType("nvarchar(max)");
        builder.Property(item => item.ActorName).HasMaxLength(200).IsRequired();
        builder.HasOne<BusinessDocument>().WithMany().HasForeignKey(item => item.IdBusinessDocument).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(item => new { item.IdOrganization, item.IdBusinessDocument, item.OccurredAt });
    }
}
