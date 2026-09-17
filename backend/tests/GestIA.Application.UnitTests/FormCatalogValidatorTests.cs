using System.Reflection;
using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.UnitTests;

public sealed class FormCatalogValidatorTests
{
    private static readonly Guid Org = Guid.NewGuid();
    private static readonly CancellationToken Token = CancellationToken.None;

    [Fact]
    public async Task AddressRejectsWrongParentAndInactiveAncestorsButPreservesHistoricalData()
    {
        var country = Value(BusinessCatalogItemType.Country, "Mexico");
        var state = Value(BusinessCatalogItemType.State, "Nuevo Leon", country.IdBusinessCatalogItem);
        var city = Value(BusinessCatalogItemType.City, "Monterrey", state.IdBusinessCatalogItem);
        var repo = DispatchProxy.Create<ICatalogRepository, Repository>();
        ((Repository)(object)repo).Items = [country, state, city];
        var validator = new FormCatalogValidator(repo);
        await validator.AddressAsync(Org, "MX", "Nuevo Leon", "Monterrey", null, null, null, Token);
        await Assert.ThrowsAsync<ResourceConflictException>(() => validator.AddressAsync(Org, "US", "Nuevo Leon", "Monterrey", null, null, null, Token));
        country.Deactivate(Org, "Test", DateTime.UtcNow);
        await Assert.ThrowsAsync<ResourceConflictException>(() => validator.AddressAsync(Org, "MX", "Nuevo Leon", "Monterrey", null, null, null, Token));
        await validator.AddressAsync(Org, "MX", "Nuevo Leon", "Monterrey", "MX", "Nuevo Leon", "Monterrey", Token);
    }

    [Fact]
    public void ActiveOptionsExcludeChildrenOfInactiveParents()
    {
        var parent = Guid.NewGuid();
        var child = Guid.NewGuid();
        CatalogItemResponse[] values = [new(parent, Org, BusinessCatalogItemType.Country, "Mexico", null, false),
            new(child, Org, BusinessCatalogItemType.State, "Nuevo Leon", null, true, IdParentCatalogItem: parent),
            new(Guid.NewGuid(), Org, BusinessCatalogItemType.City, "Monterrey", null, true, IdParentCatalogItem: child)];
        Assert.Empty(CatalogOptions.Active(values));
    }

    private static BusinessCatalogItem Value(BusinessCatalogItemType type, string name, Guid? parent = null) =>
        BusinessCatalogItem.Create(Org, new(type, name, null, IdParentCatalogItem: parent), Org, "Test", DateTime.UtcNow);

    public class Repository : DispatchProxy
    {
        public IReadOnlyList<BusinessCatalogItem> Items { get; set; } = [];
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) =>
            targetMethod?.Name == nameof(ICatalogRepository.ListCatalogItemsAsync) ? Task.FromResult(Items) : throw new NotSupportedException();
    }
}
