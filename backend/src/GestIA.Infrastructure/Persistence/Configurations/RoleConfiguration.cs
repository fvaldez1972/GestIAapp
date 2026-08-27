using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles", "dbo");
        builder.HasKey(entity => entity.IdRole);
        builder.Property(entity => entity.CodeRole).HasMaxLength(60).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Name).HasMaxLength(120).IsRequired();
        builder.HasIndex(entity => entity.CodeRole).IsUnique();
    }
}
