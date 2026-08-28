using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

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
        builder.HasIndex(entity => new { entity.IdService, entity.CodePosition }).IsUnique();
    }
}
