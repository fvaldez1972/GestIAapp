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
        builder.Property(entity => entity.FullName).HasMaxLength(200).IsRequired();
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
        builder.Property(entity => entity.Municipality).HasMaxLength(120);
        builder.Property(entity => entity.State).HasMaxLength(120);
        builder.Property(entity => entity.PostalCode).HasMaxLength(10).IsUnicode(false);
        builder.Property(entity => entity.HousingType).HasMaxLength(30);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
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
