using GestIA.Domain.History;
using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class OperationalEventConfiguration : IEntityTypeConfiguration<OperationalEvent>
{
    public void Configure(EntityTypeBuilder<OperationalEvent> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("OperationalEvents", "dbo");
        builder.HasKey(item => item.IdOperationalEvent);

        // Texto y no número: un valor agregado en medio del enum no debe cambiar el significado
        // de las filas ya escritas.
        builder.Property(item => item.EntityType)
            .HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();

        builder.Property(item => item.Action).HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(item => item.BeforeSnapshot).HasColumnType("nvarchar(max)");
        builder.Property(item => item.AfterSnapshot).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(item => item.Reason).HasMaxLength(1200);
        builder.Property(item => item.ActorName).HasMaxLength(200).IsRequired();
        builder.Property(item => item.OccurredAt).HasColumnType("datetime2(0)").IsRequired();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(item => item.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);

        // No hay llave foránea hacia el registro afectado: la tabla es general y sirve a cinco
        // entidades. La integridad la sostienen EntityType y RecordId juntos, que es el precio
        // deliberado de no tener una tabla por entidad.
        builder.HasIndex(item => new { item.IdOrganization, item.EntityType, item.RecordId, item.OccurredAt });
        builder.HasIndex(item => new { item.IdOrganization, item.OccurredAt });
    }
}
