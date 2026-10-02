using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class PositionRequiredEquipmentConfiguration : IEntityTypeConfiguration<PositionRequiredEquipment>
{
    public void Configure(EntityTypeBuilder<PositionRequiredEquipment> builder)
    {
        builder.ToTable("PositionRequiredEquipments", "dbo");
        builder.HasKey(entity => entity.IdPositionRequiredEquipment);

        builder.HasOne(entity => entity.Position)
            .WithMany(position => position.RequiredEquipment)
            .HasForeignKey(entity => entity.IdPosition)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(entity => entity.EquipmentCatalogItem)
            .WithMany()
            .HasForeignKey(entity => entity.IdEquipmentCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);

        // La misma pieza de equipo no se pide dos veces para la misma posicion.
        //
        // Sin filtro por Active, y es deliberado: aqui los registros no se borran, asi que una
        // pieza retirada sigue ocupando su sitio. Volver a pedirla es reactivar la fila que ya
        // esta, no crear otra; si el indice ignorara las inactivas quedarian dos renglones para el
        // mismo hecho y la ficha ensenaria el equipo repetido.
        builder.HasIndex(entity => new { entity.IdPosition, entity.IdEquipmentCatalogItem })
            .IsUnique()
            .HasDatabaseName("UX_PositionRequiredEquipments_Position_Equipment");

        builder.HasIndex(entity => entity.IdOrganization);
    }
}
