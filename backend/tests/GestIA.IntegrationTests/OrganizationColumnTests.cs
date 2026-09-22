using GestIA.Domain.Catalogs;
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
        { typeof(Position), "Positions" },
        { typeof(ShiftPattern), "ShiftPatterns" },
        { typeof(ShiftSegment), "ShiftSegments" },
        { typeof(ScheduleVersion), "ScheduleVersions" },
        { typeof(ScheduledShift), "ScheduledShifts" },
        { typeof(ServiceAssignment), "ServiceAssignments" },
        { typeof(AttendanceRecord), "AttendanceRecords" },
        { typeof(CoverageRecord), "CoverageRecords" },
        { typeof(Incident), "Incidents" },
        { typeof(OperationEvidence), "OperationEvidences" },

        // La tanda E: las cinco que llegaban a su organización por el padre.
        { typeof(ClientSite), "ClientSites" },
        { typeof(ClientContact), "ClientContacts" },
        { typeof(EmployeeDocument), "EmployeeDocuments" },
        { typeof(EmployeeEvaluation), "EmployeeEvaluations" },
        { typeof(EmployeeSkill), "EmployeeSkills" }
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
    /// <b>Esta prueba está invertida a propósito, y la versión anterior cumplió su función.</b>
    ///
    /// <para>En la tanda A afirmaba lo contrario: que sede y contacto <i>no</i> debían tener la
    /// columna, porque llegaban a su organización a un solo salto. Se escribió justamente para que
    /// agregarla no se pudiera hacer por descuido, y cuando la tanda E la agregó, falló. Eso era lo
    /// que se buscaba: obligó a decidirlo en vez de dejarlo pasar.</para>
    ///
    /// <para><b>Por qué se decidió al revés.</b> La regla "un salto no justifica denormalizar" se
    /// escribió cuando la alternativa era una columna redundante contra ningún costo. Con el filtro
    /// global de la tanda B la alternativa pasó a ser un filtro por navegación, que hace que <b>el
    /// filtro del hijo dependa del filtro del padre</b>: apagar uno sin el otro da resultados que
    /// hay que razonar caso por caso, que es exactamente lo que la tanda B vino a eliminar. Y la
    /// precondición que hacía peligrosa la denormalización —que el dueño pudiera cambiar de
    /// organización— ya está cerrada por <c>OrganizationScopeTests</c>.</para>
    ///
    /// <para>Ahora comprueba lo contrario: que las cinco la llevan. Si alguien intenta quitarla,
    /// esta prueba se lo dirá, igual que la anterior avisó cuando se agregó.</para>
    /// </summary>
    [Theory]
    [InlineData(typeof(ClientSite))]
    [InlineData(typeof(ClientContact))]
    [InlineData(typeof(EmployeeDocument))]
    [InlineData(typeof(EmployeeEvaluation))]
    [InlineData(typeof(EmployeeSkill))]
    public void SingleHopEntitiesAlsoCarryTheOrganization(Type clrType)
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(clrType)
            ?? throw new InvalidOperationException($"{clrType.Name} mapping was not found.");

        var property = entityType.FindProperty(nameof(IOrganizationScopedEntity.IdOrganization))
            ?? throw new InvalidOperationException($"{clrType.Name} must map IdOrganization.");

        Assert.False(property.IsNullable);
        Assert.True(typeof(IOrganizationScopedEntity).IsAssignableFrom(clrType));
    }

    private static GestIaDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<GestIaDbContext>()
            .UseSqlServer(
                "Server=localhost,1433;Database=db-gestia-test;User Id=sa;" +
                "Password=Only_for_model_tests_2026!;Encrypt=True;TrustServerCertificate=True")
            .Options;

        // Sólo lee el modelo: no consulta, así que no necesita organización.
        return new GestIaDbContext(options, FixedOrganizationContext.None(), new NoHistoryRecorder());
    }
}
