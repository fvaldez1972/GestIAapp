using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class EmployeeEvaluationConfiguration : IEntityTypeConfiguration<EmployeeEvaluation>
{
    public void Configure(EntityTypeBuilder<EmployeeEvaluation> builder)
    {
        builder.ToTable("EmployeeEvaluations", "dbo", table =>
            table.HasCheckConstraint(
                "CK_EmployeeEvaluations_ExpiryDateRange",
                "[ExpiresDate] IS NULL OR [ExpiresDate] >= [EvaluatedDate]"));
        builder.HasKey(entity => entity.IdEmployeeEvaluation);
        builder.Property(entity => entity.EvaluationType).HasConversion<string>().HasMaxLength(50).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.Result).HasConversion<string>().HasMaxLength(40).IsUnicode(false).IsRequired();
        builder.Property(entity => entity.CertificateNumber).HasMaxLength(80);
        builder.Property(entity => entity.StorageReference).HasMaxLength(500);
        builder.Property(entity => entity.Notes).HasMaxLength(1000);
        builder.HasOne(entity => entity.Employee)
            .WithMany(employee => employee.Evaluations)
            .HasForeignKey(entity => entity.IdEmployee)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdEmployee, entity.EvaluationType, entity.EvaluatedDate }).IsUnique();
        builder.HasIndex(entity => new { entity.EvaluationType, entity.Result, entity.ExpiresDate });
    }
}
