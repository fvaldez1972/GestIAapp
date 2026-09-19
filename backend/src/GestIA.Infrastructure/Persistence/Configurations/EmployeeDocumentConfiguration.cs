using GestIA.Domain.Organizations;
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
        // El archivo que cubre el requisito. Va con indice para poder ir del requisito al archivo,
        // y **sin clave foranea**: un documento de negocio se archiva y esta fila es historia del
        // expediente, asi que una restriccion impediria archivar el archivo o arrastraria la fila.
        builder.Property(entity => entity.IdBusinessDocument);
        builder.HasIndex(entity => entity.IdBusinessDocument)
            .HasFilter("[IdBusinessDocument] IS NOT NULL");
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        // Restrict y no Cascade: desactivar una categoria del catalogo no puede llevarse por delante
        // los documentos que la usan. El catalogo se desactiva; el expediente se queda.
        builder.HasOne(entity => entity.DocumentCategoryCatalogItem)
            .WithMany()
            .HasForeignKey(entity => entity.IdDocumentCategoryCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => entity.IdDocumentCategoryCatalogItem)
            .HasFilter("[IdDocumentCategoryCatalogItem] IS NOT NULL");

        builder.HasOne(entity => entity.Employee)
            .WithMany(employee => employee.Documents)
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        // La organizacion vive en la propia fila desde la tanda E. El indice la lleva
        // primero porque el filtro global la aplica a TODA consulta de esta tabla.
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => new { entity.IdOrganization, entity.DocumentType });

        builder.HasIndex(entity => new { entity.IdEmployee, entity.DocumentType });
        builder.HasIndex(entity => new { entity.Status, entity.ExpiresDate });
    }
}
