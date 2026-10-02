using GestIA.Domain.Organizations;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EmployeeEvaluationConfiguration : IEntityTypeConfiguration<EmployeeEvaluation>
{
    public void Configure(EntityTypeBuilder<EmployeeEvaluation> builder)
    {
        builder.ToTable("EmployeeEvaluations", "dbo", table =>
            table.HasCheckConstraint(
                "CK_EmployeeEvaluations_ExpiryDateRange",
                "[ExpiresDate] IS NULL OR [ExpiresDate] >= [EvaluatedDate]"));
        builder.HasKey(entity => entity.IdEmployeeEvaluation);
        builder.Property(entity => entity.EvaluationType).HasConversion<string>().HasMaxLength(50).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Result).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.CertificateNumber).HasMaxLength(80);
        builder.Property(entity => entity.StorageReference).HasMaxLength(500);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.EvaluationCategoryCatalogItem)
            .WithMany()
            .HasForeignKey(entity => entity.IdEvaluationCategoryCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => entity.IdEvaluationCategoryCatalogItem)
            .HasFilter("[IdEvaluationCategoryCatalogItem] IS NOT NULL");

        builder.HasOne(entity => entity.Employee)
            .WithMany(employee => employee.Evaluations)
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        // La organizacion vive en la propia fila desde la tanda E. El indice la lleva
        // primero porque el filtro global la aplica a TODA consulta de esta tabla.
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => new { entity.IdOrganization, entity.EvaluationType });

        // Una evaluacion de cada tipo por persona y fecha, y el TIPO es la categoria del catalogo.
        //
        // El indice iba sobre el enum heredado, y la pantalla manda `Other` en el enum desde que el
        // tipo se elige del catalogo: registrada una evaluacion, cualquier otra de ese mismo dia
        // --de otro tipo-- chocaba con la clave unica. La regla tenia sentido y estaba midiendo la
        // cosa equivocada.
        //
        // Van dos indices porque hay dos mundos: los registros con categoria se comparan por ella,
        // y los anteriores a la conversion del catalogo --que no la tienen-- siguen comparandose por
        // el enum, que es lo unico que traen.
        builder.HasIndex(entity => new
            {
                entity.IdEmployee,
                entity.IdEvaluationCategoryCatalogItem,
                entity.EvaluatedDate,
            })
            .IsUnique()
            .HasFilter("[IdEvaluationCategoryCatalogItem] IS NOT NULL");

        builder.HasIndex(entity => new { entity.IdEmployee, entity.EvaluationType, entity.EvaluatedDate })
            .IsUnique()
            .HasFilter("[IdEvaluationCategoryCatalogItem] IS NULL");
        builder.HasIndex(entity => new { entity.EvaluationType, entity.Result, entity.ExpiresDate });
    }
}
