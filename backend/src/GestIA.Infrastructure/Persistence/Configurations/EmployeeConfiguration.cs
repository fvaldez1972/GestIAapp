using GestIA.Domain.Catalogs;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("Employees", "dbo");
        builder.HasKey(entity => entity.IdEmployee);
        builder.Property(entity => entity.CodeEmployee).HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        // El nombre en sus tres partes, que es lo que se captura desde RQ-06. Tres partes de 80
        // mas dos espacios dan 242, que es lo que hace segura la longitud del derivado: un nombre
        // valido en cada parte siempre cabe en FullName.
        builder.Property(entity => entity.FirstName).HasMaxLength(EmployeeName.PartMaxLength).IsRequired();
        builder.Property(entity => entity.LastNamePaternal).HasMaxLength(EmployeeName.PartMaxLength).IsRequired();
        builder.Property(entity => entity.LastNameMaternal).HasMaxLength(EmployeeName.PartMaxLength);

        // FullName se conserva porque la busqueda, el orden alfabetico y las listas van contra
        // ella, pero ya no se captura: el dominio la compone de las tres partes.
        builder.Property(entity => entity.FullName).HasMaxLength(EmployeeName.FullMaxLength).IsRequired();
        builder.Property(entity => entity.JobTitle).HasMaxLength(120);
        builder.Property(entity => entity.BirthPlace).HasMaxLength(150);
        builder.Property(entity => entity.Sex).HasMaxLength(30);
        builder.Property(entity => entity.MaritalStatus).HasMaxLength(40);
        builder.Property(entity => entity.Rfc).HasMaxLength(13).IsUnicode(false);
        builder.Property(entity => entity.Curp).HasMaxLength(18).IsUnicode(false);
        builder.Property(entity => entity.SocialSecurityNumber).HasMaxLength(20).IsUnicode(false);
        builder.Property(entity => entity.VoterIdNumber).HasMaxLength(30).IsUnicode(false);
        builder.Property(entity => entity.DriverLicenseNumber).HasMaxLength(40).IsUnicode(false);
        builder.Property(entity => entity.MilitaryServiceCardNumber).HasMaxLength(40).IsUnicode(false);
        builder.Property(entity => entity.Email).HasMaxLength(254).IsUnicode(false);
        builder.Property(entity => entity.MobilePhone).HasMaxLength(30).IsUnicode(false);
        builder.Property(entity => entity.HomePhone).HasMaxLength(30).IsUnicode(false);
        builder.Property(entity => entity.EmergencyContactName).HasMaxLength(200);
        builder.Property(entity => entity.EmergencyContactPhone).HasMaxLength(30).IsUnicode(false);
        builder.Property(entity => entity.Address).HasMaxLength(500);
        builder.Property(entity => entity.Neighborhood).HasMaxLength(120);
        builder.Property(entity => entity.Street).HasMaxLength(200);
        // Texto y no numero: un domicilio real dice «45-A», «S/N» o «123 int. 4».
        builder.Property(entity => entity.StreetNumber).HasMaxLength(30);
        builder.Property(entity => entity.EmergencyContactRelationship).HasMaxLength(80);
        builder.Property(entity => entity.Municipality).HasMaxLength(120);
        builder.Property(entity => entity.State).HasMaxLength(120);
        builder.Property(entity => entity.CountryCode).HasMaxLength(2).IsUnicode(false);
        builder.Property(entity => entity.PostalCode).HasMaxLength(10).IsUnicode(false);
        builder.Property(entity => entity.HousingType).HasMaxLength(30);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        // El puesto por identificador. Es opcional: un nulo dice "no sabemos cuál es",
        // no "no cumple", y la elegibilidad no bloquea por eso.
        builder.HasOne<BusinessCatalogItem>()
            .WithMany()
            .HasForeignKey(entity => entity.IdJobPositionCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entity => new { entity.IdOrganization, entity.IdJobPositionCatalogItem });

        // La escolaridad, con el mismo trato: opcional, por identificador, y sin borrado en
        // cascada. Desactivar un nivel del catalogo no puede vaciar la escolaridad de nadie.
        builder.HasOne<BusinessCatalogItem>()
            .WithMany()
            .HasForeignKey(entity => entity.IdEducationLevelCatalogItem)
            .OnDelete(DeleteBehavior.Restrict);

        // La coleccion de periodos se lee del campo, no de la propiedad: la propiedad es de solo
        // lectura a proposito, para que nadie agregue un periodo saltandose las reglas del agregado.
        builder.Metadata
            .FindNavigation(nameof(Employee.EmploymentPeriods))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(entity => new { entity.IdOrganization, entity.CodeEmployee }).IsUnique();
        builder.HasIndex(entity => new { entity.IdOrganization, entity.Rfc })
            .IsUnique()
            .HasFilter("[Rfc] IS NOT NULL");
        builder.HasIndex(entity => new { entity.IdOrganization, entity.Curp })
            .IsUnique()
            .HasFilter("[Curp] IS NOT NULL");
        builder.HasIndex(entity => new { entity.IdOrganization, entity.SocialSecurityNumber })
            .IsUnique()
            .HasFilter("[SocialSecurityNumber] IS NOT NULL");
    }
}
