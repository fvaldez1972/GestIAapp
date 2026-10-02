using GestIA.Application.Catalogs;
using GestIA.Application.Common;
using GestIA.Application.Geography;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.UnitTests;

public sealed class FormCatalogValidatorTests
{
    private static readonly Guid Org = Guid.NewGuid();
    private static readonly CancellationToken Token = CancellationToken.None;

    /// <summary>
    /// La direccion se valida contra la geografia compartida, y <b>no se valida cuando no cambio</b>.
    ///
    /// <para>La segunda mitad es la que importa y la que se ha roto antes: una ficha capturada hace
    /// meses puede nombrar un municipio que despues se desactivo. Si guardar un telefono revalidara
    /// la direccion, esa ficha quedaria imposible de editar. Por eso el caso «no cambio» pregunta
    /// con una geografia que rechaza todo: si el validador la consultara, fallaria.</para>
    /// </summary>
    [Fact]
    public async Task AddressDelegatesToSharedGeographyAndSkipsWhatDidNotChange()
    {
        var geografia = new GeografiaFalsa();
        var validator = new FormCatalogValidator(null!, geografia);

        // Control: cuando la geografia no encuentra problema, no hay excepcion.
        geografia.Problema = null;
        await validator.AddressAsync("MX", "Nuevo Leon", "Monterrey", null, null, null, Token);
        Assert.Equal(1, geografia.Consultas);
        Assert.Equal(("MX", "Nuevo Leon", "Monterrey"), geografia.Ultima);

        // El problema que reporta la geografia sale como conflicto, con su mismo texto.
        geografia.Problema = "Selecciona un estado activo del pais.";
        var error = await Assert.ThrowsAsync<ResourceConflictException>(
            () => validator.AddressAsync("MX", "Nuevo Leon", "Monterrey", null, null, null, Token));
        Assert.Equal("Selecciona un estado activo del pais.", error.Message);

        // Y lo que no cambio no se consulta, aunque la geografia siga rechazando.
        var consultas = geografia.Consultas;
        await validator.AddressAsync("MX", "Nuevo Leon", "Monterrey", "MX", "NUEVO LEON", "Monterrey", Token);
        Assert.Equal(consultas, geografia.Consultas);
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

    private sealed class GeografiaFalsa : IGeographyService
    {
        public string? Problema { get; set; }
        public int Consultas { get; private set; }
        public (string? Country, string? State, string? Municipality) Ultima { get; private set; }

        public Task<string?> ValidateAddressAsync(string? country, string? state, string? municipality, CancellationToken cancellationToken)
        {
            Consultas++;
            Ultima = (country, state, municipality);
            return Task.FromResult(Problema);
        }

        public Task<IReadOnlyList<GeoPlace>> ListCountriesAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<IReadOnlyList<GeoPlace>> ListStatesAsync(string country, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<IReadOnlyList<GeoPlace>> ListMunicipalitiesAsync(string country, string state, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<PostalCodeLookup?> LookupPostalCodeAsync(string postalCode, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
