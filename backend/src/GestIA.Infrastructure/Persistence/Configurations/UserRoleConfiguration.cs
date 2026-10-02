using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("UserRoles", "dbo");
        builder.HasKey(entity => entity.IdUserRole);
        builder.HasOne(entity => entity.User)
            .WithMany()
            .HasForeignKey(entity => entity.IdUser)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Role)
            .WithMany()
            .HasForeignKey(entity => entity.IdRole)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.OrganizationMembership)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganizationMembership)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdUser, entity.IdRole, entity.IdOrganizationMembership }).IsUnique();
    }
}
