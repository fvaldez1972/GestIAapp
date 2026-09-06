using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Infrastructure.Persistence.DemoData;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace GestIA.IntegrationTests;

/// <summary>
/// El sembrador demo tiene que escribir el <b>identificador</b> del puesto, no sólo su nombre.
///
/// <para>Esta prueba nace de un defecto real, visto en la publicación del 6 de septiembre de 2026.
/// El sembrador escribía <c>JobTitle</c> con el nombre del puesto y dejaba
/// <c>IdJobPositionCatalogItem</c> en nulo. En <c>db-gestia-demo</c> nadie lo notó porque allí se
/// sembró <b>antes</b> de aplicar la migración que rellena esa columna, y fue el relleno de la
/// migración quien ató los expedientes. Al publicar en <c>db-gestia-dev</c> el orden fue el
/// contrario —migrar y luego sembrar— y las 126 personas nacieron sin puesto catalogado: elegibles
/// para cualquier posición, y con un expediente que nadie podía comprobar.</para>
///
/// <para><b>Funcionó por accidente de orden, no por diseño.</b> Esta prueba corre contra una base
/// creada desde el modelo, sin ninguna migración de relleno que pueda taparlo: si el sembrador
/// vuelve a escribir sólo el texto, falla aquí.</para>
/// </summary>
public sealed class DemoSeederJobPositionTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;

    [OperationalSqlFact]
    public async Task TheSeederWritesTheCatalogIdentifierAndNotOnlyTheJobTitle()
    {
        await SeedAsync();

        await using var context = database.Context();

        var puestos = await context.BusinessCatalogItems
            .IgnoreQueryFilters(["Active", "Organization"])
            .Where(item => item.Type == BusinessCatalogItemType.JobPosition && item.Active)
            .ToDictionaryAsync(item => item.Name, item => item.IdBusinessCatalogItem, Token);

        Assert.NotEmpty(puestos);

        // Toda persona cuyo puesto en texto corresponde a una entrada del catálogo tiene que llevar
        // el identificador de esa entrada. Es la única forma de que la elegibilidad se pueda
        // comprobar, porque se compara por identificador y no por el texto.
        var conNombreDeCatalogo = await context.Employees
            .IgnoreQueryFilters(["Active", "Organization"])
            .Where(employee => employee.JobTitle != null && puestos.Keys.Contains(employee.JobTitle))
            .Select(employee => new { employee.FullName, employee.JobTitle, employee.IdJobPositionCatalogItem })
            .ToListAsync(Token);

        Assert.NotEmpty(conNombreDeCatalogo);

        var sinIdentificador = conNombreDeCatalogo
            .Where(employee => employee.IdJobPositionCatalogItem is null)
            .Select(employee => $"{employee.FullName} ({employee.JobTitle})")
            .ToArray();

        Assert.True(
            sinIdentificador.Length == 0,
            "El sembrador escribió el puesto sólo como texto en " +
            $"{sinIdentificador.Length} de {conNombreDeCatalogo.Count} personas: " +
            $"{string.Join(", ", sinIdentificador.Take(5))}. La elegibilidad se compara por " +
            "identificador de catálogo, así que un puesto sin identificador es un expediente que " +
            "nadie puede comprobar.");

        // Y el identificador es el del puesto que su texto nombra, no cualquiera. Sólo se compara
        // donde el nombre coincide letra por letra: las variantes con acentos o mayúsculas
        // distintas —que SQL Server sí da por iguales al filtrar— tienen su propia prueba, la de
        // la tolerancia del buscador.
        Assert.All(
            conNombreDeCatalogo.Where(employee => puestos.ContainsKey(employee.JobTitle!)),
            employee => Assert.Equal(puestos[employee.JobTitle!], employee.IdJobPositionCatalogItem));
    }

    /// <summary>Lo mismo para el perfil que pide una posición: es el otro lado de la comparación.</summary>
    [OperationalSqlFact]
    public async Task TheSeederAlsoWritesTheIdentifierOnThePositionsItCreates()
    {
        await SeedAsync();

        await using var context = database.Context();

        var puestos = await context.BusinessCatalogItems
            .IgnoreQueryFilters(["Active", "Organization"])
            .Where(item => item.Type == BusinessCatalogItemType.JobPosition && item.Active)
            .ToDictionaryAsync(item => item.Name, item => item.IdBusinessCatalogItem, Token);

        var conPerfilDeCatalogo = await context.Positions
            .IgnoreQueryFilters(["Active", "Organization"])
            .Where(position => position.RequiredSkillProfile != null &&
                puestos.Keys.Contains(position.RequiredSkillProfile))
            .Select(position => new { position.Name, position.RequiredSkillProfile, position.IdJobPositionCatalogItem })
            .ToListAsync(Token);

        Assert.NotEmpty(conPerfilDeCatalogo);

        var sinIdentificador = conPerfilDeCatalogo
            .Where(position => position.IdJobPositionCatalogItem is null)
            .Select(position => $"{position.Name} ({position.RequiredSkillProfile})")
            .ToArray();

        Assert.True(
            sinIdentificador.Length == 0,
            $"El sembrador dejó {sinIdentificador.Length} posiciones con el perfil sólo como texto: " +
            $"{string.Join(", ", sinIdentificador.Take(5))}.");
    }

    /// <summary>
    /// El caso feo se conserva nulo <b>a propósito</b>.
    ///
    /// <para>El sembrador crea gente con un puesto que no está en el catálogo, y esa columna tiene
    /// que quedar en nulo: es la condición «elegible, con el expediente incompleto» que la pantalla
    /// de Personal existe para nombrar. Sin esta prueba, alguien podría cerrar el defecto de arriba
    /// forzando un identificador a todo el mundo y borrar el caso de la demo.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AJobTitleThatIsNotInTheCatalogStaysNull()
    {
        await SeedAsync();

        await using var context = database.Context();

        // «Vigilante nocturno» no está en el catálogo de puestos, y el sembrador lo crea a
        // propósito. Su columna tiene que quedar nula.
        var sinMapeo = await context.Employees
            .IgnoreQueryFilters(["Active", "Organization"])
            .Where(employee => employee.JobTitle == "Vigilante nocturno")
            .ToListAsync(Token);

        Assert.NotEmpty(sinMapeo);
        Assert.All(sinMapeo, employee => Assert.Null(employee.IdJobPositionCatalogItem));
    }

    /// <summary>
    /// El buscador del sembrador es tolerante, como el relleno de la migración que introdujo la
    /// columna: mayúsculas, acentos y espacios de sobra no impiden reconocer el puesto.
    ///
    /// <para>Los datos escritos a mano llegan así, y el sembrador crea esas variantes justamente
    /// para tener qué ejercitar. Si el buscador dejara de ser tolerante, estas personas nacerían
    /// sin puesto sin que nadie lo notara.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task TheLookupToleratesCaseAccentsAndSpacing()
    {
        await SeedAsync();

        await using var context = database.Context();

        var guardia = await context.BusinessCatalogItems
            .IgnoreQueryFilters(["Active", "Organization"])
            .Where(item => item.Type == BusinessCatalogItemType.JobPosition &&
                item.Name == "Guardia de seguridad")
            .Select(item => item.IdBusinessCatalogItem)
            .FirstAsync(Token);

        foreach (var variante in new[] { "MINUSCULA", "ESPACIOS", "ACENTO" })
        {
            var empleado = await context.Employees
                .IgnoreQueryFilters(["Active", "Organization"])
                .SingleAsync(item => item.FullName == $"Empleado con perfil {variante}", Token);

            Assert.Equal(guardia, empleado.IdJobPositionCatalogItem);
        }
    }

    /// <summary>
    /// Corre el sembrador una vez por base de prueba. Es idempotente, así que las tres pruebas de
    /// esta clase comparten el resultado sin volver a sembrarlo.
    /// </summary>
    private async Task SeedAsync()
    {
        await using var context = database.Context();

        var options = new DemoDataOptions
        {
            Enabled = true,
            ReferenceDate = new DateOnly(2026, 9, 4),
        };

        var actor = new SeedActor();
        var clock = new SeedClock();
        var defaults = new OrganizationCatalogDefaults(new CatalogRepository(context), actor, clock);

        var seeder = new DemoDataSeeder(
            context,
            defaults,
            new OptionsWrapper<DemoDataOptions>(options),
            NullLogger<DemoDataSeeder>.Instance);

        await seeder.SeedAsync(Token);
    }

    private sealed class SeedActor : IActorContext
    {
        public Guid ActorId { get; } = Guid.Parse("00000000-0000-0000-0000-0000000000de");

        public string ActorName => "Pruebas del sembrador";
    }

    private sealed class SeedClock : IClock
    {
        public DateTime UtcNow { get; } = new(2026, 9, 4, 12, 0, 0, DateTimeKind.Utc);

        public DateOnly Today => DateOnly.FromDateTime(UtcNow);

        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
