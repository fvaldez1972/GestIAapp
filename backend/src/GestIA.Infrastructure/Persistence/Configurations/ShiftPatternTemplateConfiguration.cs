using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ShiftPatternTemplateConfiguration : IEntityTypeConfiguration<ShiftPatternTemplate>
{
    public void Configure(EntityTypeBuilder<ShiftPatternTemplate> builder)
    {
        builder.ToTable("ShiftPatternTemplates", "dbo", table =>
        {
            table.HasCheckConstraint("CK_ShiftPatternTemplates_CycleDays", "[CycleDays] BETWEEN 1 AND 366");
            table.HasCheckConstraint(
                "CK_ShiftPatternTemplates_DateRange",
                "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
        });
        builder.HasKey(entity => entity.IdShiftPatternTemplate);
        builder.Property(entity => entity.Name).HasMaxLength(150).IsRequired();
        // El nombre normalizado sostiene la unicidad, igual que en los valores de catalogo: sin el,
        // «12x12 diurno» y «12X12 Diurno» serian dos patrones y nadie sabria cual eligio.
        builder.Property(entity => entity.NormalizedName).HasMaxLength(150).IsRequired();
        builder.Property(entity => entity.Description).HasMaxLength(1000);
        builder.Property(entity => entity.Daypart)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsUnicode(false)
            .IsRequired();
        builder.Property(entity => entity.CycleDays).IsRequired();
        builder.Property(entity => entity.EffectiveFromDate).IsRequired();
        builder.HasIndex(entity => new { entity.IdOrganization, entity.NormalizedName }).IsUnique();
        builder.HasOne(entity => entity.Organization)
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(entity => entity.Days)
            .WithOne(entity => entity.ShiftPatternTemplate)
            .HasForeignKey(entity => entity.IdShiftPatternTemplate)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShiftPatternTemplateDayConfiguration : IEntityTypeConfiguration<ShiftPatternTemplateDay>
{
    public void Configure(EntityTypeBuilder<ShiftPatternTemplateDay> builder)
    {
        builder.ToTable("ShiftPatternTemplateDays", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_ShiftPatternTemplateDays_CycleDayNumber",
                "[CycleDayNumber] >= 1");
            // Un descanso no lleva horario y un turno si. La base lo exige para que no entre por
            // otra via una fila que diga las dos cosas a la vez.
            table.HasCheckConstraint(
                "CK_ShiftPatternTemplateDays_RestHasNoSchedule",
                "([IsRest] = CAST(1 AS bit) AND [StartTime] IS NULL AND [EndTime] IS NULL AND [DurationMinutes] = 0)"
                + " OR ([IsRest] = CAST(0 AS bit) AND [StartTime] IS NOT NULL AND [EndTime] IS NOT NULL AND [DurationMinutes] > 0)");
        });
        builder.HasKey(entity => entity.IdShiftPatternTemplateDay);
        builder.Property(entity => entity.CycleDayNumber).IsRequired();
        builder.Property(entity => entity.StartTime).HasColumnType("time(0)");
        builder.Property(entity => entity.EndTime).HasColumnType("time(0)");
        builder.Property(entity => entity.IsRest).IsRequired();
        builder.Property(entity => entity.DurationMinutes).IsRequired();
        builder.Property(entity => entity.IsOvernight).IsRequired();
        // Un dia del ciclo se declara una sola vez.
        builder.HasIndex(entity => new { entity.IdShiftPatternTemplate, entity.CycleDayNumber }).IsUnique();
    }
}
