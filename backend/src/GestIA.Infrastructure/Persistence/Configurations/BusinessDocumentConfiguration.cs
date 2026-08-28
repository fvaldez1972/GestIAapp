using GestIA.Domain.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class BusinessDocumentConfiguration : IEntityTypeConfiguration<BusinessDocument>
{
    public void Configure(EntityTypeBuilder<BusinessDocument> builder)
    {
        builder.ToTable("BusinessDocuments", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_BusinessDocuments_RelatedRecord_ExactlyOne",
                "(([IdClient] IS NOT NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR " +
                "([IdClient] IS NULL AND [IdServiceContract] IS NOT NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR " +
                "([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NOT NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR " +
                "([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NOT NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR " +
                "([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NOT NULL AND [IdOperationalRequest] IS NULL) OR " +
                "([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NOT NULL))");
            table.HasCheckConstraint(
                "CK_BusinessDocuments_ExpiryDateRange",
                "[ExpiresDate] IS NULL OR [IssuedDate] IS NULL OR [ExpiresDate] >= [IssuedDate]");
        });

        builder.HasKey(entity => entity.IdBusinessDocument);
        builder.Property(entity => entity.OwnerType).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Category).HasMaxLength(80).IsRequired();
        builder.Property(entity => entity.Title).HasMaxLength(180).IsRequired();
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.StorageReference).HasMaxLength(500).IsRequired();
        builder.Property(entity => entity.Notes).HasMaxLength(1000);

        builder.HasOne(entity => entity.Client)
            .WithMany()
            .HasForeignKey(entity => entity.IdClient)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.ServiceContract)
            .WithMany()
            .HasForeignKey(entity => entity.IdServiceContract)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.Employee)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.EmployeeEvaluation)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployeeEvaluation)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.OperationalRequest)
            .WithMany()
            .HasForeignKey(entity => entity.IdOperationalRequest)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => entity.IdOrganization);
        builder.HasIndex(entity => new { entity.OwnerType, entity.OwnerId });
        builder.HasIndex(entity => new { entity.Status, entity.ExpiresDate });
        builder.HasIndex(entity => entity.IdClient);
        builder.HasIndex(entity => entity.IdServiceContract);
        builder.HasIndex(entity => entity.IdService);
        builder.HasIndex(entity => entity.IdEmployee);
        builder.HasIndex(entity => entity.IdEmployeeEvaluation);
        builder.HasIndex(entity => entity.IdOperationalRequest);
    }
}
