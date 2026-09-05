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
            table.HasCheckConstraint(
                "CK_Positions_RequiredWorkerCount",
                "[RequiredWorkerCount] > 0"));
        builder.HasKey(entity => entity.IdPosition);
        builder.Property(entity => entity.CodePosition).HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(150).IsRequired();
        builder.Property(entity => entity.RequiredSkillProfile).HasMaxLength(1000);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
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
