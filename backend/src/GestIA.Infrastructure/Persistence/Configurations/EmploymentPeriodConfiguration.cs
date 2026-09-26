using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

/// <summary>
/// El historial laboral, en la base.
///
/// <para><b>Las tres reglas que sostienen RQ-07 viven aquí y no sólo en el dominio.</b> Que el
/// reingreso exija estar dado de baja, que una baja no se guarde sin motivo y que las fechas no se
/// crucen son reglas de negocio protegibles, y el proyecto no las deja en la pantalla ni sólo en
/// memoria: un índice único filtrado y dos <c>CHECK</c> las hacen imposibles de violar aunque alguien
/// escriba por otro camino.</para>
/// </summary>
public sealed class EmploymentPeriodConfiguration : IEntityTypeConfiguration<EmploymentPeriod>
{
    public void Configure(EntityTypeBuilder<EmploymentPeriod> builder)
    {
        builder.ToTable("EmploymentPeriods", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_EmploymentPeriods_DateRange",
                "[EndDate] IS NULL OR [EndDate] >= [StartDate]");

            // O el periodo está abierto y no hay nada que explicar, o está cerrado y el motivo es
            // obligatorio. No hay tercera forma: una baja sin motivo no se puede reconstruir después.
            table.HasCheckConstraint(
                "CK_EmploymentPeriods_TerminationReason",
                "([EndDate] IS NULL AND [TerminationReason] IS NULL) OR " +
                "([EndDate] IS NOT NULL AND [TerminationReason] IS NOT NULL)");
        });

        builder.HasKey(entity => entity.IdEmploymentPeriod);

        builder.Property(entity => entity.TerminationReason).HasMaxLength(EmploymentPeriod.ReasonMaxLength);
        builder.Property(entity => entity.RowVersion).IsRowVersion();

        builder.HasOne(entity => entity.Employee)
            .WithMany(employee => employee.EmploymentPeriods)
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Domain.Organizations.Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => new { entity.IdEmployee, entity.StartDate });

        // Como máximo un periodo abierto por persona. Es lo que hace imposible un reingreso sobre
        // alguien que nunca causó baja, sin depender de que el botón esté escondido en la pantalla.
        builder.HasIndex(entity => entity.IdEmployee)
            .IsUnique()
            .HasFilter("[EndDate] IS NULL");
    }
}
