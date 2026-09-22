using GestIA.Domain.Common;
using GestIA.Domain.Geography;
using GestIA.Domain.Organizations;
using GestIA.Domain.Security;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// Comprueba, sobre el modelo de EF, que el aislamiento entre organizaciones está completo:
/// que todas las entidades que deben llevarlo lo declaran, que ninguna se queda sin el filtro, y
/// que las dos exclusiones son las decididas y no un olvido.
///
/// Sólo lee el modelo, no abre conexión.
/// </summary>
public sealed class OrganizationFilterModelTests
{
    private const string OrganizationFilter = "Organization";
    private const string ActiveFilter = "Active";

    /// <summary>
    /// Las dos entidades que tienen <c>IdOrganization</c> y deliberadamente <b>no</b> se filtran.
    ///
    /// <list type="bullet">
    /// <item><see cref="Organization"/>: ahí <c>IdOrganization</c> es su clave primaria, no una
    /// referencia. Es la raíz; no pertenece a una organización, es una.</item>
    /// <item><see cref="OrganizationMembership"/>: es la tabla que establece la pertenencia. El
    /// inicio de sesión la consulta para averiguar a qué organizaciones pertenece el usuario,
    /// antes de que exista organización autorizada. Filtrarla sería circular.</item>
    /// </list>
    /// </summary>
    private static readonly Type[] DeliberatelyUnfiltered = [typeof(Organization), typeof(OrganizationMembership)];

    [Fact]
    public void EveryEntityWithAnOrganizationIsEitherScopedOrAKnownException()
    {
        using var context = CreateContext();

        var offenders = context.Model.GetEntityTypes()
            .Select(entityType => entityType.ClrType)
            .Distinct()
            .Where(HasOrganizationProperty)
            .Where(type => !typeof(IOrganizationScopedEntity).IsAssignableFrom(type))
            .Where(type => !DeliberatelyUnfiltered.Contains(type))
            .Select(type => type.Name)
            .Order()
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            "Estas entidades guardan una organización pero no declaran IOrganizationScopedEntity, " +
            "así que quedan fuera del filtro global y se pueden consultar desde cualquier " +
            "organización. O declaran la interfaz, o se agregan a la lista de exclusiones con su " +
            $"motivo: {string.Join(", ", offenders)}");
    }

    [Fact]
    public void EveryScopedEntityCarriesTheOrganizationFilter()
    {
        using var context = CreateContext();

        var offenders = ScopedEntityTypes(context)
            .Where(entityType => entityType.FindDeclaredQueryFilter(OrganizationFilter) is null)
            .Select(entityType => entityType.ClrType.Name)
            .Order()
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            "Estas entidades declaran IOrganizationScopedEntity pero no tienen el filtro de " +
            $"organización en el modelo: {string.Join(", ", offenders)}");
    }

    /// <summary>
    /// El borrado lógico y el aislamiento entre organizaciones son filtros distintos y con
    /// nombre. Si volvieran a fundirse en uno solo, apagar el primero apagaría el segundo, que
    /// es exactamente lo que esta tanda vino a impedir.
    /// </summary>
    [Fact]
    public void TheActiveFilterKeepsItsOwnName()
    {
        using var context = CreateContext();

        var activatable = context.Model.GetEntityTypes()
            .Where(entityType => entityType.BaseType is null)
            .Where(entityType => typeof(IActivatableEntity).IsAssignableFrom(entityType.ClrType))
            .ToArray();

        Assert.NotEmpty(activatable);

        foreach (var entityType in activatable)
        {
            Assert.NotNull(entityType.FindDeclaredQueryFilter(ActiveFilter));
        }
    }

    /// <summary>
    /// El conteo está escrito a mano a propósito: si alguien agrega una entidad con organización,
    /// esta prueba se lo dice en lugar de contarla sola y no enterarse.
    /// </summary>
    [Fact]
    public void ThirtyEntitiesAreScoped()
    {
        using var context = CreateContext();

        // 24 hasta la tanda C, más las cinco que la tanda E denormalizó —sedes y contactos de
        // cliente, y documentos, evaluaciones y habilidades de empleado—, más las dos del catálogo
        // de patrones de turno: la plantilla y sus días del ciclo.
        //
        // La plantilla es **de la organización**, no compartida: un 12x12 de una empresa tiene su
        // propio horario y su propia vigencia, y ver los patrones de otra organización sería
        // exactamente la fuga que el filtro existe para impedir.
        //
        // Y desde el 19 de septiembre de 2026, dos más: las incidencias administrativas del
        // expediente y el equipo que requiere una posición. Las dos llevan su organización
        // denormalizada como el resto de las entidades de detalle, porque el filtro de un hijo no
        // puede depender del filtro de su padre.
        Assert.Equal(32, ScopedEntityTypes(context).Count());
    }

    /// <summary>
    /// La geografía compartida <b>no lleva organización, y no debe llevarla</b>.
    ///
    /// <para>Es la decisión del 22 de septiembre de 2026: países, estados, municipios y códigos
    /// postales son los mismos para todas las organizaciones. Tenerlos por organización costaba
    /// ocho copias de 2 478 municipios, y con las colonias habría costado medio giga y un alta de
    /// organización que inserta 147 000 filas.</para>
    ///
    /// <para><b>Esta prueba existe porque el arreglo se ve como un descuido.</b> Cuatro tablas sin
    /// la columna que llevan las otras treinta y dos parecen un olvido, y agregársela «para que
    /// sean consistentes» devolvería el problema entero sin que nada más se queje.</para>
    /// </summary>
    [Theory]
    [InlineData(typeof(GeoCountry))]
    [InlineData(typeof(GeoState))]
    [InlineData(typeof(GeoMunicipality))]
    [InlineData(typeof(GeoPostalCode))]
    public void SharedGeographyCarriesNoOrganization(Type clrType)
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(clrType)!;

        Assert.Null(entityType.FindProperty("IdOrganization"));
        Assert.Null(entityType.FindDeclaredQueryFilter(OrganizationFilter));
        Assert.False(typeof(IOrganizationScopedEntity).IsAssignableFrom(clrType));
    }

    [Theory]
    [InlineData(typeof(Organization))]
    [InlineData(typeof(OrganizationMembership))]
    public void TheTwoExceptionsStayUnfiltered(Type clrType)
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(clrType)!;

        Assert.Null(entityType.FindDeclaredQueryFilter(OrganizationFilter));
    }

    private static IEnumerable<Microsoft.EntityFrameworkCore.Metadata.IEntityType> ScopedEntityTypes(
        GestIaDbContext context) =>
        context.Model.GetEntityTypes()
            .Where(entityType => entityType.BaseType is null)
            .Where(entityType => typeof(IOrganizationScopedEntity).IsAssignableFrom(entityType.ClrType));

    private static bool HasOrganizationProperty(Type type) =>
        type.GetProperty(nameof(IOrganizationScopedEntity.IdOrganization))?.PropertyType == typeof(Guid);

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
