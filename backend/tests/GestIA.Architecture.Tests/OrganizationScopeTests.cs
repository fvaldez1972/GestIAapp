using GestIA.Domain.Catalogs;
using System.Reflection;
using GestIA.Domain.Clients;
using GestIA.Domain.Common;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Architecture.Tests;

/// <summary>
/// La organización está denormalizada en las entidades operativas: cada una la guarda en su
/// propia columna en lugar de alcanzarla por una cadena de relaciones.
///
/// Eso sólo es seguro mientras la organización sea <b>inmutable</b>. Si alguien agregara un
/// "mover cliente a otra organización" o un "mover servicio a otro cliente", la copia
/// denormalizada de todo lo que cuelga se desincronizaría en silencio: las consultas seguirían
/// funcionando y devolverían el dueño equivocado.
///
/// Estas pruebas existen para que ese cambio no se pueda hacer sin darse cuenta.
/// </summary>
public sealed class OrganizationScopeTests
{
    /// <summary>Las raíces de las que cuelga todo lo demás.</summary>
    private static readonly Type[] OrganizationRoots = [typeof(Client), typeof(Employee)];

    /// <summary>Las entidades que llevan la organización denormalizada.</summary>
    private static readonly Type[] ScopedEntities =
    [
        typeof(Service),
        typeof(ServiceContract),
        typeof(ServiceConfiguration),
        typeof(Position),
        typeof(ShiftPattern),
        typeof(ShiftSegment),
        typeof(ScheduleVersion),
        typeof(ScheduledShift),
        typeof(ServiceAssignment),
        typeof(AttendanceRecord),
        typeof(CoverageRecord),
        typeof(Incident),
        typeof(OperationEvidence),

        // Tanda E: cuelgan de Client o de Employee, que son raíces inmutables. Esa inmutabilidad
        // es la precondición de que denormalizar sea seguro, y la comprueba esta misma clase.
        typeof(ClientSite),
        typeof(ClientContact),
        typeof(EmployeeDocument),
        typeof(EmployeeEvaluation),
        typeof(EmployeeSkill)
    ];

    public static TheoryData<Type> Roots() => [.. OrganizationRoots];

    public static TheoryData<Type> Scoped() => [.. ScopedEntities];

    public static TheoryData<Type> RootsAndScoped() => [.. OrganizationRoots, .. ScopedEntities];

    [Theory]
    [MemberData(nameof(RootsAndScoped))]
    public void OrganizationCannotBeChangedAfterCreation(Type entityType)
    {
        var property = entityType.GetProperty(nameof(IOrganizationScopedEntity.IdOrganization))
            ?? throw new InvalidOperationException($"{entityType.Name} must expose IdOrganization.");

        Assert.True(
            property.SetMethod is null || !property.SetMethod.IsPublic,
            $"{entityType.Name}.IdOrganization must not expose a public setter: the denormalized " +
            "copies that hang from it would silently point at the wrong organization.");

        var offenders = entityType
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(method => method.GetParameters().Any(IsOrganizationParameter))
            .Select(method => method.Name)
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            $"{entityType.Name} exposes instance methods that take an organization and could " +
            $"reassign it: {string.Join(", ", offenders)}. Creating the record is the only moment " +
            "its organization may be set.");
    }

    [Theory]
    [MemberData(nameof(Scoped))]
    public void ScopedEntitiesDeclareTheMarkerInterface(Type entityType) =>
        Assert.True(
            typeof(IOrganizationScopedEntity).IsAssignableFrom(entityType),
            $"{entityType.Name} carries IdOrganization and must declare IOrganizationScopedEntity, " +
            "which is what the organization query filter will hang from.");

    /// <summary>
    /// La raíz no se marca: <see cref="Organization"/> no pertenece a una organización, es una.
    /// </summary>
    [Fact]
    public void OrganizationItselfIsNotScoped() =>
        Assert.False(typeof(IOrganizationScopedEntity).IsAssignableFrom(typeof(Organization)));

    private static bool IsOrganizationParameter(ParameterInfo parameter) =>
        parameter.ParameterType == typeof(Guid) &&
        parameter.Name is not null &&
        parameter.Name.Contains("organization", StringComparison.OrdinalIgnoreCase);
}
