using GestIA.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ApprovalRequestConfiguration : IEntityTypeConfiguration<ApprovalRequest>
{
    public void Configure(EntityTypeBuilder<ApprovalRequest> builder)
    {
        builder.ToTable("ApprovalRequests", "dbo");
        builder.HasKey(entity => entity.IdApprovalRequest);
        builder.Property(entity => entity.ApprovalType).HasConversion<string>().HasMaxLength(50).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.EntityType).HasMaxLength(80).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Reason).HasMaxLength(1200).IsRequired();
        builder.Property(entity => entity.RequestedChangeSummary).HasMaxLength(2000);
        builder.Property(entity => entity.AssignedApproverName).HasMaxLength(100);
        builder.Property(entity => entity.Status).HasConversion<string>().HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.DecidedByName).HasMaxLength(100);
        builder.Property(entity => entity.DecisionNotes).HasMaxLength(1200);
        builder.HasOne(entity => entity.Service)
            .WithMany()
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.Status });
        builder.HasIndex(entity => new { entity.IdService, entity.EntityType, entity.EntityId });
    }
}
