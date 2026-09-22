using GestIA.Application.Catalogs;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.UnitTests;

/// <summary>
/// El sembrador de perfiles no puede dejar una entrada sin decidir.
///
/// <para>El servicio exige la marca al crear desde la pantalla, pero el sembrador no pasa por él:
/// construye las entradas directamente. Sin esta prueba, agregar mañana un tipo de incidencia
/// administrativa a la lista sin su marca lo dejaría naciendo «sin decidir», que es justo el estado
/// que se retiró el 21 de septiembre de 2026 —y no habría nada que lo dijera—.</para>
/// </summary>
public sealed class ProfileCatalogSeedTests
{
    [Fact]
    public void EverySeededValueInAMarkBearingCatalogDeclaresItsMark()
    {
        var conMarca = ProfileCatalogSeed.All
            .Where(valor => BusinessCatalogItem.SupportsBlockingMark(valor.Type))
            .ToArray();

        Assert.NotEmpty(conMarca);
        Assert.All(conMarca, valor => Assert.True(
            valor.IsBlocking.HasValue,
            $"«{valor.Name}» se siembra en {valor.Type} sin decir si bloquea."));
    }

    /// <summary>
    /// Y el control: los catálogos que no llevan marca se siembran sin ella.
    ///
    /// <para>Sin esta mitad, «todos declaran su marca» se cumpliría poniéndosela a todos, y el
    /// servidor rechaza una marca en un catálogo que no participa en la elegibilidad.</para>
    /// </summary>
    [Fact]
    public void AndValuesOutsideThoseCatalogsCarryNoMark()
    {
        var sinMarca = ProfileCatalogSeed.All
            .Where(valor => !BusinessCatalogItem.SupportsBlockingMark(valor.Type))
            .ToArray();

        Assert.NotEmpty(sinMarca);
        Assert.All(sinMarca, valor => Assert.False(
            valor.IsBlocking.HasValue,
            $"«{valor.Name}» lleva marca y {valor.Type} no la admite."));
    }
}
