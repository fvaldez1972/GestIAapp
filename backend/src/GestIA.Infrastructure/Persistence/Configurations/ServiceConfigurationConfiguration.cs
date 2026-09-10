using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;
using ServiceConfigurationEntity = GestIA.Domain.Services.ServiceConfiguration;

namespace GestIA.Infrastructure.Persistence.Configurations;

public sealed class ServiceConfigurationConfiguration : IEntityTypeConfiguration<ServiceConfigurationEntity>
{
    public void Configure(EntityTypeBuilder<ServiceConfigurationEntity> builder)
    {
        builder.ToTable("ServiceConfigurations", "dbo", table =>
        {
            table.HasCheckConstraint(
                "CK_ServiceConfigurations_EffectiveDateRange",
                "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
            table.HasCheckConstraint(
                "CK_ServiceConfigurations_RequiredWorkerCount",
                "[RequiredWorkerCount] > 0");
            table.HasCheckConstraint(
                "CK_ServiceConfigurations_HoursPerDay",
                "[HoursPerDay] > 0 AND [HoursPerDay] <= 24");
            table.HasCheckConstraint(
                "CK_ServiceConfigurations_DaysPerWeek",
                "[DaysPerWeek] BETWEEN 1 AND 7");
            table.HasCheckConstraint(
                "CK_ServiceConfigurations_MonthlyPrice",
                "[MonthlyPrice] >= 0");
        });
        builder.HasKey(entity => entity.IdServiceConfiguration);
        builder.Property(entity => entity.HoursPerDay).HasPrecision(5, 2);
        builder.Property(entity => entity.AverageWeeklyHours).HasPrecision(7, 2);
        builder.Property(entity => entity.AverageMonthlyHours).HasPrecision(8, 2);
        builder.Property(entity => entity.WorkScheduleDescription).HasMaxLength(500).IsRequired();
        builder.Property(entity => entity.SpecificInstructions).HasMaxLength(2000);
        builder.Property(entity => entity.MonthlyPrice).HasPrecision(19, 4);
        builder.Property(entity => entity.CurrencyCode).HasMaxLength(3).IsUnicode(false).HasDefaultValue("MXN").IsRequired();
        builder.HasOne(entity => entity.Service)
            .WithMany(service => service.Configurations)
            .HasForeignKey(entity => entity.IdService)
            .OnDelete(DeleteBehavior.Restrict);
        // Lo genera SQL Server en cada escritura; el modelo solo lo lee.
        builder.Property(entity => entity.RowVersion).IsRowVersion();

        // Ya no es único. Dos configuraciones del mismo servicio pueden empezar el mismo día, por
        // decisión del 10 de septiembre de 2026. El índice se queda porque el listado busca por
        // servicio y ordena por esta fecha; lo que se retira es la unicidad, no la búsqueda.
        builder.HasIndex(entity => new { entity.IdService, entity.EffectiveFromDate });
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(entity => entity.IdOrganization)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(entity => new { entity.IdOrganization, entity.EffectiveFromDate });
    }
}
