using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EmployeePsychometricTestConfiguration : IEntityTypeConfiguration<EmployeePsychometricTest>
{
    public void Configure(EntityTypeBuilder<EmployeePsychometricTest> builder)
    {
        builder.ToTable("EmployeePsychometricTests", "dbo", table =>
            table.HasCheckConstraint(
                "CK_EmployeePsychometricTests_ExpiredOnDate",
                "[ExpiredOnDate] IS NULL OR [ExpiredOnDate] >= [ApprovedDate]"));

        builder.HasKey(entity => entity.IdEmployeePsychometricTest);

        // El identificador lo pone el dominio. Sin esto EF lo trata como generado por la base y,
        // al llegar la prueba por la coleccion del empleado con su clave ya puesta, da por hecho
        // que la fila existe y emite un UPDATE en vez de un INSERT. Es el mismo defecto que
        // rompia el reingreso.
        builder.Property(entity => entity.IdEmployeePsychometricTest).ValueGeneratedNever();
        builder.Property(entity => entity.RowVersion).IsRowVersion();

        builder.HasOne(entity => entity.Employee)
            .WithMany(employee => employee.PsychometricTests)
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Domain.Organizations.Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => new { entity.IdEmployee, entity.ApprovedDate });

        // Como maximo una vigente por persona. La anterior solo se vence al causar baja.
        builder.HasIndex(entity => entity.IdEmployee)
            .IsUnique()
            .HasFilter("[ExpiredOnDate] IS NULL");
    }
}
