using GestIA.Application.Common;
using GestIA.Application.Geography;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.Catalogs;

public sealed class FormCatalogValidator(ICatalogRepository repository, IGeographyService geography)
{
    public async Task ValueAsync(Guid organization, BusinessCatalogItemType type, string? value, string? previous, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(value) || Same(value, previous)) return;
        var values = await repository.ListCatalogItemsAsync(organization, type, token);
        if (!values.Any(item => item.Active && Same(item.Name, value)))
            throw new ResourceConflictException("Selecciona un valor activo del catalogo correspondiente.");
    }

    /// <summary>
    /// Que la direccion escrita corresponda a la geografia conocida.
    ///
    /// <para><b>No recibe organizacion, y ese es el cambio.</b> Pais, estado y municipio salen
    /// ahora de las tablas compartidas, iguales para todas las empresas, asi que preguntar «de
    /// quien» dejo de tener sentido. Antes vivian en <c>BusinessCatalogItems</c> por organizacion
    /// y habia que resolver el arbol a mano; ese codigo se fue con la tabla.</para>
    ///
    /// <para><b>Sigue sin validar lo que no cambio.</b> Una direccion capturada hace meses puede
    /// nombrar un municipio que despues se desactivo; reescribir el telefono de esa ficha no puede
    /// exigir que se corrija la direccion.</para>
    /// </summary>
    public async Task AddressAsync(string? country, string? state, string? city,
        string? oldCountry, string? oldState, string? oldCity, CancellationToken token)
    {
        if (Same(country, oldCountry) && Same(state, oldState) && Same(city, oldCity)) return;
        var problema = await geography.ValidateAddressAsync(country, state, city, token);
        if (problema is not null) throw new ResourceConflictException(problema);
    }

    private static bool Same(string? left, string? right) =>
        CatalogName.Normalize(left) == CatalogName.Normalize(right);
}
