using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EmployeeDocumentConfiguration : IEntityTypeConfiguration<EmployeeDocument>
{
    public void Configure(EntityTypeBuilder<EmployeeDocument> builder)
    {
        builder.ToTable("EmployeeDocuments", "dbo", table =>
            table.HasCheckConstraint(
                "CK_EmployeeDocuments_ExpiryDateRange",
                "[ExpiresDate] IS NULL OR [IssuedDate] IS NULL OR [ExpiresDate] >= [IssuedDate]"));
        builder.HasKey(entity => entity.IdEmployeeDocument);
        builder.Property(entity => entity.DocumentType).HasConversion<string>().HasMaxLength(50).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.DocumentNumber).HasMaxLength(80);
        builder.Property(entity => entity.StorageReference).HasMaxLength(500);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.Employee)
            .WithMany(employee => employee.Documents)
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdEmployee, entity.DocumentType });
        builder.HasIndex(entity => new { entity.Status, entity.ExpiresDate });
    }
}
