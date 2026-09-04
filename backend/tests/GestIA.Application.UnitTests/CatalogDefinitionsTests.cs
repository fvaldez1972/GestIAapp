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

    [Fact]
    public void FixedDirectoryMatchesEveryDomainEnumAndCannotBeEdited()
    {
        var types = typeof(BusinessCatalogItemType).Assembly.GetTypes()
            .Where(type => type.IsEnum && type != typeof(BusinessCatalogItemType)).ToArray();
        var definitions = CatalogDefinitions.All.Where(item => !item.Editable).ToArray();
        Assert.Equal(types.Length, definitions.Length);
        foreach (var type in types)
        {
            var definition = Assert.Single(definitions, item => item.Key == type.Name);
            Assert.Null(definition.Type);
            Assert.Equal(Enum.GetNames(type), definition.Values.Select(item => item.Code));
            Assert.All(definition.Values, item => Assert.False(string.IsNullOrWhiteSpace(item.Label)));
        }
    }
}
