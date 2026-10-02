using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("RolePermissions", "dbo");
        builder.HasKey(entity => entity.IdRolePermission);
        builder.HasOne(entity => entity.Role)
            .WithMany()
            .HasForeignKey(entity => entity.IdRole)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Permission)
            .WithMany()
            .HasForeignKey(entity => entity.IdPermission)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdRole, entity.IdPermission }).IsUnique();
    }
}
