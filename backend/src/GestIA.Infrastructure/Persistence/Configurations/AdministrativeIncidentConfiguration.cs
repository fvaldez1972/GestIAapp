using GestIA.Domain.Catalogs;
using GestIA.Domain.Organizations;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class AdministrativeIncidentConfiguration : IEntityTypeConfiguration<AdministrativeIncident>
{
    public void Configure(EntityTypeBuilder<AdministrativeIncident> builder)
    {
        builder.ToTable("AdministrativeIncidents", "dbo");
        builder.HasKey(entity => entity.IdAdministrativeIncident);

        builder.Property(entity => entity.OccurredDate).HasColumnType("date");
        builder.Property(entity => entity.Details).HasMaxLength(2000).IsRequired();

        builder.HasOne(entity => entity.Employee)
            .WithMany()
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);

        // Restrict, no Cascade: desactivar un tipo del catalogo no puede borrar las incidencias que
        // lo usan. Aqui los registros no se borran.
        builder.HasOne(entity => entity.IncidentTypeCatalogItem)
            .WithMany()
            .HasForeignKey(entity => entity.IdIncidentTypeCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);

        // Por persona y por fecha, que es como se consulta: la pestaña del expediente pide las de
        // una persona, de la mas reciente a la mas vieja.
        builder.HasIndex(entity => new { entity.IdEmployee, entity.OccurredDate });
        builder.HasIndex(entity => entity.IdIncidentTypeCatalogItem);
        builder.HasIndex(entity => entity.IdOrganization);
    }
}
