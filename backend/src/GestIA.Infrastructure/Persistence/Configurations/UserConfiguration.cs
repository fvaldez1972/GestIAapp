using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users", "dbo");
        builder.HasKey(entity => entity.IdUser);
        builder.Property(entity => entity.Email).HasMaxLength(255).IsRequired();
        builder.Property(entity => entity.NormalizedEmail).HasMaxLength(255).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.DisplayName).HasMaxLength(120).IsRequired();
        builder.Property(entity => entity.PasswordHash).HasMaxLength(256).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.PasswordSalt).HasMaxLength(128).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.LastLoginAt).HasColumnType("datetime2(0)");
        builder.HasIndex(entity => entity.NormalizedEmail).IsUnique();
    }
}
