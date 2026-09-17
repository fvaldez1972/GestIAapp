using GestIA.Domain.Catalogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class BusinessCatalogItemConfiguration : IEntityTypeConfiguration<BusinessCatalogItem>
{
    /// <summary>
    /// La regla de unicidad del catalogo, en T-SQL. Recorta, convierte tabuladores y saltos de
    /// linea en espacios, colapsa los espacios repetidos con el truco de los dos centinelas y sube
    /// a mayusculas. <c>CatalogName.Normalize</c> hace lo mismo en memoria.
    /// </summary>
    public const string NormalizedNameSql =
        """
        CAST(UPPER(LTRIM(RTRIM(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(REPLACE(REPLACE([Name], CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '),
                        ' ', CHAR(1) + CHAR(2)),
                    CHAR(2) + CHAR(1), ''),
                CHAR(1) + CHAR(2), ' ')
        ))) AS varchar(200))
        """;

    public void Configure(EntityTypeBuilder<BusinessCatalogItem> builder)
    {
        builder.ToTable("BusinessCatalogItems", "dbo");
        builder.HasKey(entity => entity.IdBusinessCatalogItem);
        builder.Property(entity => entity.Type)
            .HasConversion<string>()
            .HasMaxLength(40)
            .IsUnicode(false)
            .IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(160).IsRequired();
        // El nombre plegado, calculado por la base y persistido.
        //
        // Calculado y no escrito por la aplicacion por dos razones. Una: la migracion desplegada
        // 20260903211914_GeographicCatalogRelations inserta valores de catalogo con SQL crudo
        // listando columnas, y una columna obligatoria que hubiera que rellenar la habria roto al
        // reproducirla; una migracion desplegada no se reescribe. Dos: asi ninguna fila puede
        // entrar por un camino que se olvido de calcularla.
        //
        // La expresion colapsa espacios y sube a mayusculas; de los acentos se encarga la colacion
        // acento-insensible, que ademas hace que «Recepcion» y «Recepción» choquen aunque una fila
        // vieja se hubiera guardado de otra forma.
        builder.Property(entity => entity.NormalizedName)
            .HasComputedColumnSql(NormalizedNameSql, stored: true)
            .HasColumnType("varchar(200)")
            .UseCollation("Latin1_General_CI_AI")
            .ValueGeneratedOnAddOrUpdate();
        builder.Property(entity => entity.Description).HasMaxLength(1000);
        builder.Property(entity => entity.Order).HasColumnName("DisplayOrder").HasDefaultValue(1);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<BusinessCatalogItem>().WithMany()
            .HasForeignKey(entity => entity.IdParentCatalogItem).OnDelete(DeleteBehavior.Restrict);
        // La unicidad por nombre plegado, que es la que se queda cuando el codigo se retire.
        //
        // Lleva el padre porque sin el no aguanta: un municipio no es unico en el pais, es unico en
        // su estado. Sin esa columna la comprobacion encuentra 452 colisiones en datos reales, y
        // todas son nombres de municipio que se repiten entre estados.
        //
        // Y deja fuera a la geografia porque el nombre de un municipio TAMPOCO es unico dentro de
        // su estado: Oaxaca tiene dos municipios llamados San Juan Mixtepec y dos llamados San
        // Pedro Mixtepec, distinguidos por distrito y no por nombre. Es dato correcto del INEGI, no
        // un defecto de captura, asi que ningun indice por nombre puede cubrirlo. La geografia sale
        // de esta tabla en su propia tanda y se apoyara en la clave del INEGI, que si es unica;
        // hasta entonces conserva la unicidad que ya tiene por codigo.
        builder.HasIndex(entity => new
        {
            entity.IdOrganization,
            entity.Type,
            entity.IdParentCatalogItem,
            entity.NormalizedName
        })
            .IsUnique()
            .HasFilter("[Type] <> 'Country' AND [Type] <> 'State' AND [Type] <> 'City'");
    }
}
