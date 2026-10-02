using GestIA.Domain.Catalogs;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class PositionConfiguration : IEntityTypeConfiguration<Position>
{
    public void Configure(EntityTypeBuilder<Position> builder)
    {
        builder.ToTable("Positions", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_Positions_RequiredWorkerCount",
                "[RequiredWorkerCount] > 0");
            table.HasCheckConstraint(
                "CK_Positions_Price",
                "[Price] >= 0");
            // La vigencia del puesto. Que quepa dentro de la del servicio lo comprueba el caso de
            // uso, que es quien puede leer el servicio; que no termine antes de empezar se cierra
            // aqui, porque ninguna ruta de escritura tiene derecho a dejar pasar eso.
            table.HasCheckConstraint(
                "CK_Positions_DateRange",
                "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
        });
        builder.HasKey(entity => entity.IdPosition);
        builder.Property(entity => entity.CodePosition).HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(150).IsRequired();
        // El precio del puesto. decimal(19,4) es el tipo de importe del estandar; los float estan
        // prohibidos para dinero.
        builder.Property(entity => entity.Price).HasColumnType("decimal(19,4)").IsRequired();
        builder.Property(entity => entity.CurrencyCode).HasColumnType("varchar(3)").IsRequired();
        // El periodo del precio, como texto: un importe sin su periodo no significa nada, y el
        // texto deja la base legible sin tener que saber el orden del enum.
        builder.Property(entity => entity.PriceFrequency)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsUnicode(false)
            .IsRequired();
        builder.Property(entity => entity.IsTaxIncluded).IsRequired();
        // Fechas de negocio: terminan en Date y son date, no datetime2. La de fin admite nulo, que
        // significa puesto permanente.
        builder.Property(entity => entity.StartDate).HasColumnType("date").IsRequired();
        builder.Property(entity => entity.EndDate).HasColumnType("date");
        builder.Property(entity => entity.RequiredSkillProfile).HasMaxLength(1000);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        // Nulables las tres, y sin navegacion: la posicion las guarda por identificador y quien
        // necesita el nombre lo resuelve con el catalogo que ya trae cargado. Una navegacion por
        // cada una habria metido tres joins en la consulta del listado de servicios.
        builder.HasIndex(entity => entity.IdSexCatalogItem)
            .HasFilter("[IdSexCatalogItem] IS NOT NULL");
        builder.HasIndex(entity => entity.IdAgeRangeCatalogItem)
            .HasFilter("[IdAgeRangeCatalogItem] IS NOT NULL");
        builder.HasIndex(entity => entity.IdEducationLevelCatalogItem)
            .HasFilter("[IdEducationLevelCatalogItem] IS NOT NULL");

        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        // El puesto por identificador. Es opcional: un nulo dice "no sabemos cuál es",
        // no "no cumple", y la elegibilidad no bloquea por eso.
        builder.HasOne<BusinessCatalogItem>()
            .WithMany()
            .HasForeignKey(entity => entity.IdJobPositionCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => new { entity.IdOrganization, entity.IdJobPositionCatalogItem });

        builder.HasIndex(entity => new { entity.IdService, entity.CodePosition }).IsUnique();
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.CodePosition });
    }
}
