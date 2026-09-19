using GestIA.Application.Catalogs;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.UnitTests;

public sealed class CatalogDefinitionsTests
{
    [Fact]
    public void EditableDirectoryContainsEverySupportedCatalogExactlyOnce()
    {
        var definitions = CatalogDefinitions.All.Where(item => item.Editable).ToArray();
        Assert.Equal(Enum.GetValues<BusinessCatalogItemType>().Order(), definitions.Select(item => item.Type!.Value).Order());
        Assert.All(definitions, item => Assert.Empty(item.Values));
        Assert.Equal(CatalogDefinitions.All.Count, CatalogDefinitions.All.Select(item => item.Key).Distinct().Count());
    }

    /// <summary>
    /// Los tres enums que el 19 de septiembre de 2026 dejaron de anunciarse como catálogos fijos,
    /// porque pasaron a ser filas editables de <c>BusinessCatalogItems</c>.
    ///
    /// <para>Siguen existiendo en el código como rastro de lo que había, pero anunciarlos habría
    /// enseñado dos listas para lo mismo, una editable y otra no. Van nombrados uno por uno y no por
    /// una regla general: así, si mañana alguien convierte un cuarto enum y se olvida de retirarlo
    /// del directorio, esta prueba lo dice.</para>
    /// </summary>
    private static readonly string[] EnumsConvertidosACatalogo =
    [
        nameof(GestIA.Domain.Workforce.EmployeeDocumentType),
        nameof(GestIA.Domain.Workforce.EmployeeEvaluationType),
        nameof(GestIA.Domain.Clients.ClientContactPurpose),
    ];

    [Fact]
    public void FixedDirectoryMatchesEveryDomainEnumAndCannotBeEdited()
    {
        var types = typeof(BusinessCatalogItemType).Assembly.GetTypes()
            .Where(type => type.IsEnum && type != typeof(BusinessCatalogItemType))
            .Where(type => !EnumsConvertidosACatalogo.Contains(type.Name))
            .ToArray();
        var definitions = CatalogDefinitions.All.Where(item => !item.Editable).ToArray();
        Assert.Equal(types.Length, definitions.Length);
        foreach (var type in types)
        {
            var definition = Assert.Single(definitions, item => item.Key == type.Name);
            Assert.Null(definition.Type);
            Assert.Equal(Enum.GetNames(type), definition.Values.Select(item => item.Code));
            Assert.All(definition.Values, item => Assert.False(string.IsNullOrWhiteSpace(item.Label)));
        }

        // Y lo contrario: los convertidos no pueden seguir anunciandose como listas fijas, o la
        // pantalla de Catalogos ensenaria la version vieja al lado de la editable.
        Assert.DoesNotContain(
            CatalogDefinitions.All,
            item => EnumsConvertidosACatalogo.Contains(item.Key));
    }
}
