namespace GestIA.Application.Catalogs;

public static class CatalogOptions
{
    public static IReadOnlyList<CatalogItemResponse> Active(IReadOnlyList<CatalogItemResponse> values)
    {
        var byId = values.ToDictionary(item => item.IdCatalogItem);
        return values.Where(item => IsAvailable(item, byId, [])).ToArray();
    }

    private static bool IsAvailable(CatalogItemResponse item, IReadOnlyDictionary<Guid, CatalogItemResponse> values, HashSet<Guid> visited) =>
        item.Active && visited.Add(item.IdCatalogItem) && (item.IdParentCatalogItem is not { } id ||
            values.TryGetValue(id, out var parent) && IsAvailable(parent, values, visited));
}
