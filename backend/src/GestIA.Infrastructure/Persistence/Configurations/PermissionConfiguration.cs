using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("Permissions", "dbo");
        builder.HasKey(entity => entity.IdPermission);
        builder.Property(entity => entity.CodePermission).HasMaxLength(120).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Module).HasMaxLength(80).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(300).IsRequired();
        builder.HasIndex(entity => entity.CodePermission).IsUnique();
    }
}
