using GestIA.Domain.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class OrganizationMembershipConfiguration : IEntityTypeConfiguration<OrganizationMembership>
{
    public void Configure(EntityTypeBuilder<OrganizationMembership> builder)
    {
        builder.ToTable("OrganizationMemberships", "dbo");
        builder.HasKey(entity => entity.IdOrganizationMembership);
        builder.Property(entity => entity.Label).HasMaxLength(120).IsRequired();
        builder.HasOne(entity => entity.User)
            .WithMany()
            .HasForeignKey(entity => entity.IdUser)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdUser, entity.IdOrganization }).IsUnique();
    }
}
