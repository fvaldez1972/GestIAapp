using GestIA.Application.Common;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.Catalogs;

public sealed class FormCatalogValidator(ICatalogRepository repository)
{
    public async Task ValueAsync(Guid organization, BusinessCatalogItemType type, string? value, string? previous, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(value) || Same(value, previous)) return;
        var values = await repository.ListCatalogItemsAsync(organization, type, token);
        if (!values.Any(item => item.Active && Same(item.Name, value)))
            throw new ResourceConflictException("Selecciona un valor activo del catalogo correspondiente.");
    }

    public async Task AddressAsync(Guid organization, string? country, string? state, string? city,
        string? oldCountry, string? oldState, string? oldCity, CancellationToken token)
    {
        if (Same(country, oldCountry) && Same(state, oldState) && Same(city, oldCity)) return;
        if (string.IsNullOrWhiteSpace(country) && string.IsNullOrWhiteSpace(state) && string.IsNullOrWhiteSpace(city)) return;
        var values = await repository.ListCatalogItemsAsync(organization, null, token);
        // El pais se resuelve por nombre plegado, como el estado y el municipio, ahora que el
        // catalogo no lleva codigo. Lo que ClientSite y Employee guardan en CountryCode es un codigo
        // ISO de dos letras, que es un estandar externo y no una clave de este catalogo; por eso
        // aqui se acepta tanto el codigo como el nombre mientras la geografia siga en esta tabla.
        // En la tanda de geografia las tres columnas pasan a ser claves foraneas y esto desaparece.
        var selectedCountry = values.FirstOrDefault(item => item.Active && item.Type == BusinessCatalogItemType.Country &&
            (Same(item.Name, country) || EsMexico(country) && Same(item.Name, "Mexico")));
        if (selectedCountry is null) throw new ResourceConflictException("Selecciona un pais activo.");
        if (string.IsNullOrWhiteSpace(state) && string.IsNullOrWhiteSpace(city)) return;
        var selectedState = values.FirstOrDefault(item => item.Active && item.Type == BusinessCatalogItemType.State &&
            item.IdParentCatalogItem == selectedCountry.IdBusinessCatalogItem && Same(item.Name, state));
        if (selectedState is null) throw new ResourceConflictException("Selecciona un estado activo del pais.");
        if (string.IsNullOrWhiteSpace(city)) return;
        if (!values.Any(item => item.Active && item.Type == BusinessCatalogItemType.City &&
            item.IdParentCatalogItem == selectedState.IdBusinessCatalogItem && Same(item.Name, city)))
            throw new ResourceConflictException("Selecciona una ciudad o municipio activo del estado.");
    }

    private static bool Same(string? left, string? right) =>
        CatalogName.Normalize(left) == CatalogName.Normalize(right);

    /// <summary>El unico pais que el sistema siembra hoy, por su codigo ISO.</summary>
    private static bool EsMexico(string? value) => string.Equals(value?.Trim(), "MX", StringComparison.OrdinalIgnoreCase);
}
