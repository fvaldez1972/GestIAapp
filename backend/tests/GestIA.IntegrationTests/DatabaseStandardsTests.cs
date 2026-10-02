using GestIA.Domain.Common;
using GestIA.Infrastructure.Persistence.Conventions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace GestIA.IntegrationTests;

public sealed class DatabaseStandardsTests
{
    [Fact]
    public void ConventionsApplyStandardNamesAndLifecycleMappings()
    {
        using var context = new StandardsDbContext(CreateOptions<StandardsDbContext>());
        var user = context.Model.FindEntityType(typeof(User))
            ?? throw new InvalidOperationException("User mapping was not found.");
        var userTable = StoreObjectIdentifier.Table("Users", "dbo");

        Assert.Equal("PK_Users", user.FindPrimaryKey()?.GetName());
        Assert.Equal(
            "UX_Users_Email",
            user.GetIndexes().Single(index => index.Properties.Any(property => property.Name == nameof(User.Email)))
                .GetDatabaseName());
        Assert.Equal(true, user.FindProperty(nameof(User.Active))?.GetDefaultValue());
        Assert.NotEmpty(user.GetDeclaredQueryFilters());
        Assert.Equal("datetime2(0)", user.FindProperty(nameof(User.CreatedAt))?.GetColumnType());
        Assert.Equal("SYSUTCDATETIME()", user.FindProperty(nameof(User.CreatedAt))?.GetDefaultValueSql());
        Assert.Equal("IdUser", user.FindPrimaryKey()?.Properties.Single().GetColumnName(userTable));

        var userRole = context.Model.FindEntityType(typeof(UserRole))
            ?? throw new InvalidOperationException("UserRole mapping was not found.");

        Assert.Equal("PK_UserRoles", userRole.FindPrimaryKey()?.GetName());
        Assert.Contains(
            userRole.GetForeignKeys(),
            foreignKey => foreignKey.GetConstraintName() == "FK_UserRoles_Users_IdUser");
        Assert.Contains(
            userRole.GetForeignKeys(),
            foreignKey => foreignKey.GetConstraintName() == "FK_UserRoles_Roles_IdRole");
    }

    [Fact]
    public void ConventionsRejectNonStandardTableNames()
    {
        using var context = new InvalidStandardsDbContext(CreateOptions<InvalidStandardsDbContext>());

        var exception = Assert.Throws<InvalidOperationException>(() => _ = context.Model);

        Assert.Contains("PascalCase", exception.Message, StringComparison.Ordinal);
    }

    private static DbContextOptions<TContext> CreateOptions<TContext>()
        where TContext : DbContext =>
        new DbContextOptionsBuilder<TContext>()
            .UseSqlServer(
                "Server=localhost,1433;Database=db-gestia-test;User Id=sa;" +
                "Password=Only_for_model_tests_2026!;Encrypt=True;TrustServerCertificate=True")
            .Options;

    private sealed class StandardsDbContext(DbContextOptions<StandardsDbContext> options)
        : DbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users", "dbo");
                entity.HasKey(item => item.IdUser);
                entity.Property(item => item.Email).HasMaxLength(255).IsRequired();
                entity.HasIndex(item => item.Email).IsUnique();
            });

            modelBuilder.Entity<Role>(entity =>
            {
                entity.ToTable("Roles", "dbo");
                entity.HasKey(item => item.IdRole);
            });

            modelBuilder.Entity<UserRole>(entity =>
            {
                entity.ToTable("UserRoles", "dbo");
                entity.HasKey(item => new { item.IdUser, item.IdRole });
                entity.HasOne(item => item.User)
                    .WithMany()
                    .HasForeignKey(item => item.IdUser);
                entity.HasOne(item => item.Role)
                    .WithMany()
                    .HasForeignKey(item => item.IdRole);
            });

            modelBuilder.ApplyGestIaDatabaseStandards();
        }
    }

    private sealed class InvalidStandardsDbContext(DbContextOptions<InvalidStandardsDbContext> options)
        : DbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("invalid_users", "dbo");
                entity.HasKey(item => item.IdUser);
            });

            modelBuilder.ApplyGestIaDatabaseStandards();
        }
    }

    private sealed class User : IActivatableEntity, IAuditableEntity
    {
        public Guid IdUser { get; set; }
        public string Email { get; set; } = string.Empty;
        public bool Active { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid CreatedBy { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public Guid? UpdatedBy { get; set; }
        public string? UpdatedByName { get; set; }
    }

    private sealed class Role
    {
        public Guid IdRole { get; set; }
    }

    private sealed class UserRole
    {
        public Guid IdUser { get; set; }
        public User User { get; set; } = null!;
        public Guid IdRole { get; set; }
        public Role Role { get; set; } = null!;
    }
}
