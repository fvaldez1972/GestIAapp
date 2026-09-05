using GestIA.Domain.Clients;
using GestIA.Domain.Common;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// Comprueba la forma física de la organización denormalizada: que cada entidad operativa la
/// tenga como columna obligatoria, con su clave foránea determinista y su índice.
///
/// Sólo lee el modelo de EF, no abre conexión.
/// </summary>
public sealed class OrganizationColumnTests
{
    public static TheoryData<Type, string> ScopedEntities() => new()
    {
        { typeof(Service), "Services" },
        { typeof(ServiceContract), "ServiceContracts" },
        { typeof(ServiceConfiguration), "ServiceConfigurations" },
        { typeof(Position), "Positions" },
        { typeof(ShiftPattern), "ShiftPatterns" },
        { typeof(ShiftSegment), "ShiftSegments" },
        { typeof(ScheduleVersion), "ScheduleVersions" },
        { typeof(ScheduledShift), "ScheduledShifts" },
        { typeof(ServiceAssignment), "ServiceAssignments" },
        { typeof(AttendanceRecord), "AttendanceRecords" },
        { typeof(CoverageRecord), "CoverageRecords" },
        { typeof(Incident), "Incidents" },
        { typeof(OperationEvidence), "OperationEvidences" }
    };

    [Theory]
    [MemberData(nameof(ScopedEntities))]
    public void OperationalEntitiesCarryTheirOrganizationAsARequiredColumn(Type clrType, string tableName)
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(clrType)
            ?? throw new InvalidOperationException($"{clrType.Name} mapping was not found.");

        var property = entityType.FindProperty(nameof(IOrganizationScopedEntity.IdOrganization))
            ?? throw new InvalidOperationException($"{clrType.Name} must map IdOrganization.");
        Assert.False(property.IsNullable, $"{tableName}.IdOrganization must be NOT NULL.");

        Assert.Contains(entityType.GetForeignKeys(), key =>
            key.GetConstraintName() == $"FK_{tableName}_Organizations_IdOrganization");

        Assert.Contains(entityType.GetIndexes(), index =>
            index.Properties[0].Name == nameof(IOrganizationScopedEntity.IdOrganization));
    }

    /// <summary>
    /// Un salto no justifica denormalizar. Sede y contacto llegan a la organización por el
    /// cliente, y quedan deliberadamente fuera: si alguien les agrega la columna, que sea una
    /// decisión y no un descuido.
    /// </summary>
    [Theory]
    [InlineData(typeof(ClientSite))]
    [InlineData(typeof(ClientContact))]
    public void SingleHopEntitiesDoNotDuplicateTheOrganization(Type clrType)
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(clrType)
            ?? throw new InvalidOperationException($"{clrType.Name} mapping was not found.");

        Assert.Null(entityType.FindProperty(nameof(IOrganizationScopedEntity.IdOrganization)));
    }

    private static GestIaDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<GestIaDbContext>()
            .UseSqlServer(
                "Server=localhost,1433;Database=db-gestia-test;User Id=sa;" +
                "Password=Only_for_model_tests_2026!;Encrypt=True;TrustServerCertificate=True")
            .Options;

        // Sólo lee el modelo: no consulta, así que no necesita organización.
        return new GestIaDbContext(options, FixedOrganizationContext.None());
    }
}
