using GestIA.Domain.Geography;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

/// <summary>
/// La geografía compartida.
///
/// <para><b>Ninguna de estas cuatro tablas lleva <c>IdOrganization</c>, y por eso ninguna entra al
/// filtro global.</b> No es un descuido: son los mismos países, estados y municipios para todas las
/// organizaciones, y tenerlos por organización costaba ocho copias de 2 478 municipios. Si alguien
/// les agrega la columna «para que sean consistentes con las demás», vuelve el problema que esto
/// vino a resolver.</para>
///
/// <para><b>Los códigos son de una fuente externa y se guardan como texto.</b> «01» no es el número
/// uno, y «06700» no es 6700: perder el cero delante rompe el cruce con el catálogo de origen.</para>
/// </summary>
public sealed class GeoCountryConfiguration : IEntityTypeConfiguration<GeoCountry>
{
    public void Configure(EntityTypeBuilder<GeoCountry> builder)
    {
        builder.ToTable("GeoCountries");
        builder.HasKey(entity => entity.IdGeoCountry);
        builder.Property(entity => entity.IdGeoCountry).ValueGeneratedNever();
        builder.Property(entity => entity.Code).HasMaxLength(2).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(80).IsRequired();
        builder.Property(entity => entity.Active).IsRequired();

        builder.HasIndex(entity => entity.Code).IsUnique().HasDatabaseName("UX_GeoCountries_Code");
    }
}

public sealed class GeoStateConfiguration : IEntityTypeConfiguration<GeoState>
{
    public void Configure(EntityTypeBuilder<GeoState> builder)
    {
        builder.ToTable("GeoStates");
        builder.HasKey(entity => entity.IdGeoState);
        builder.Property(entity => entity.IdGeoState).ValueGeneratedNever();
        builder.Property(entity => entity.Code).HasMaxLength(3).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(120).IsRequired();
        builder.Property(entity => entity.Active).IsRequired();

        builder.HasOne<GeoCountry>()
            .WithMany()
            .HasForeignKey(entity => entity.IdGeoCountry)
            .OnDelete(DeleteBehavior.Restrict);

        // Único dentro de su país: dos países pueden tener un estado «01».
        builder.HasIndex(entity => new { entity.IdGeoCountry, entity.Code })
            .IsUnique()
            .HasDatabaseName("UX_GeoStates_IdGeoCountry_Code");
    }
}

public sealed class GeoMunicipalityConfiguration : IEntityTypeConfiguration<GeoMunicipality>
{
    public void Configure(EntityTypeBuilder<GeoMunicipality> builder)
    {
        builder.ToTable("GeoMunicipalities");
        builder.HasKey(entity => entity.IdGeoMunicipality);
        builder.Property(entity => entity.IdGeoMunicipality).ValueGeneratedNever();
        builder.Property(entity => entity.Code).HasMaxLength(5).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(160).IsRequired();
        builder.Property(entity => entity.Active).IsRequired();

        builder.HasOne<GeoState>()
            .WithMany()
            .HasForeignKey(entity => entity.IdGeoState)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => new { entity.IdGeoState, entity.Code })
            .IsUnique()
            .HasDatabaseName("UX_GeoMunicipalities_IdGeoState_Code");

        // Se busca por nombre dentro de un estado al resolver una dirección escrita.
        builder.HasIndex(entity => new { entity.IdGeoState, entity.Name })
            .HasDatabaseName("IX_GeoMunicipalities_IdGeoState_Name");
    }
}

public sealed class GeoPostalCodeConfiguration : IEntityTypeConfiguration<GeoPostalCode>
{
    public void Configure(EntityTypeBuilder<GeoPostalCode> builder)
    {
        builder.ToTable("GeoPostalCodes");
        builder.HasKey(entity => entity.IdGeoPostalCode);
        builder.Property(entity => entity.IdGeoPostalCode).ValueGeneratedNever();
        builder.Property(entity => entity.PostalCode).HasMaxLength(5).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Neighborhood).HasMaxLength(180).IsRequired();
        builder.Property(entity => entity.SettlementType).HasMaxLength(60);
        builder.Property(entity => entity.Active).IsRequired();

        builder.HasOne<GeoMunicipality>()
            .WithMany()
            .HasForeignKey(entity => entity.IdGeoMunicipality)
            .OnDelete(DeleteBehavior.Restrict);

        // El índice que de verdad se usa: escribir el código postal y obtener sus colonias. Va
        // primero el código porque es por lo único que se busca; el municipio viaja de vuelta.
        builder.HasIndex(entity => entity.PostalCode).HasDatabaseName("IX_GeoPostalCodes_PostalCode");

        // Y la unicidad de la fila: un código postal tiene varias colonias, y una colonia puede
        // repetirse en municipios distintos. Lo único que no puede repetirse son los tres juntos.
        builder.HasIndex(entity => new { entity.IdGeoMunicipality, entity.PostalCode, entity.Neighborhood })
            .IsUnique()
            .HasDatabaseName("UX_GeoPostalCodes_Municipality_Code_Neighborhood");
    }
}
