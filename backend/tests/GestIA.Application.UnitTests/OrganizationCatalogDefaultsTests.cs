using System.Reflection;
using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.UnitTests;

/// <summary>
/// Lo que recibe una organización recién creada.
///
/// <para><b>Ya no recibe la geografía.</b> Hasta el 22 de septiembre de 2026 el alta escribía
/// 2 511 filas —un país, 32 estados y 2 478 municipios— antes de que nadie capturara nada, de unos
/// datos que son los mismos para todas las empresas. Ahora viven en las tablas compartidas.</para>
///
/// <para>Esta prueba existe porque el camino de vuelta es fácil: bastaría con reponer el bucle
/// «para que una organización nueva tenga su geografía como las de antes» para volver a duplicar
/// veinte mil filas y, peor, para que esas filas no coincidieran con las que los domicilios leen
/// de verdad.</para>
/// </summary>
public sealed class OrganizationCatalogDefaultsTests
{
    private static readonly Guid Org = Guid.NewGuid();
    private static readonly CancellationToken Token = CancellationToken.None;

    [Fact]
    public async Task ANewOrganizationGetsNoGeographyOfItsOwn()
    {
        var sembrado = await SembrarAsync();

        Assert.DoesNotContain(sembrado, item => item.Type == BusinessCatalogItemType.Country);
        Assert.DoesNotContain(sembrado, item => item.Type == BusinessCatalogItemType.State);
        Assert.DoesNotContain(sembrado, item => item.Type == BusinessCatalogItemType.City);
    }

    /// <summary>
    /// El control: se sigue sembrando lo que sí es de cada empresa.
    ///
    /// <para>Sin esto, «no siembra geografía» pasaría igual si el alta hubiera dejado de sembrar
    /// nada, que sería un defecto bastante peor: una organización nueva sin catálogos de perfil no
    /// puede capturar a nadie.</para>
    /// </summary>
    [Fact]
    public async Task AndStillGetsWhatIsActuallyItsOwn()
    {
        var sembrado = await SembrarAsync();

        Assert.Contains(sembrado, item => item.Type == BusinessCatalogItemType.Nationality);
        Assert.Contains(sembrado, item => item.Type == BusinessCatalogItemType.EmployeeDocumentGroup);
        Assert.Contains(sembrado, item => item.Type == BusinessCatalogItemType.EmployeeDocumentCategory);
        Assert.Contains(sembrado, item => item.Type == BusinessCatalogItemType.Sex);
    }

    private static async Task<IReadOnlyList<BusinessCatalogItem>> SembrarAsync()
    {
        var repositorio = DispatchProxy.Create<ICatalogRepository, Repositorio>();
        var defaults = new OrganizationCatalogDefaults((ICatalogRepository)repositorio, new Actor(), new Reloj());
        await defaults.StageAsync(Org, Token);
        return ((Repositorio)(object)repositorio).Agregados;
    }

    public class Repositorio : DispatchProxy
    {
        public List<BusinessCatalogItem> Agregados { get; } = [];

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name != nameof(ICatalogRepository.AddCatalogItemAsync))
            {
                throw new NotSupportedException($"El alta no debería llamar a {targetMethod?.Name}.");
            }

            Agregados.Add((BusinessCatalogItem)args![0]!);
            return Task.CompletedTask;
        }
    }

    private sealed class Actor : IActorContext
    {
        public Guid ActorId { get; } = Guid.NewGuid();
        public string ActorName => "Pruebas del alta de organización";
    }

    private sealed class Reloj : IClock
    {
        public DateTime UtcNow { get; } = new(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc);
        public DateOnly Today => DateOnly.FromDateTime(UtcNow);
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
