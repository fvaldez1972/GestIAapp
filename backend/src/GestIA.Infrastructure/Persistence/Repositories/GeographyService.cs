using GestIA.Application.Geography;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

/// <summary>
/// La geografía compartida, leída de sus tablas.
///
/// <para><b>Ninguna consulta filtra por organización</b>, y no porque se haya olvidado: estas tablas
/// no llevan esa columna. Son los mismos 2 478 municipios para todas las empresas.</para>
///
/// <para><b>Se acepta la clave o el nombre en las entradas.</b> Las direcciones que ya existen
/// guardan el nombre del estado y del municipio como texto —«Nuevo León», no «19»—, así que exigir
/// la clave habría obligado a traducir en cada pantalla. La comparación por nombre la hace SQL
/// Server con una intercalación que ignora mayúsculas y acentos —ver <c>SinAcentos</c>—, de modo
/// que «Nuevo Leon» y «NUEVO LEÓN» son el mismo estado.</para>
/// </summary>
public sealed class GeographyService(GestIaDbContext dbContext) : IGeographyService
{
    /// <summary>
    /// La intercalación con la que se comparan los nombres: <b>sin distinguir mayúsculas ni
    /// acentos</b>.
    ///
    /// <para>La base es <c>SQL_Latin1_General_CP1_CI_AS</c>: ya ignora las mayúsculas, pero
    /// <b>no</b> los acentos. Sin esto, una dirección que alguien escribió «Nuevo Leon» o «Merida»
    /// no encontraría su estado, y el mensaje diría «selecciona un estado activo» delante de un
    /// estado que existe y está activo.</para>
    ///
    /// <para>La comparación la hace SQL Server, no la aplicación: traer 2 478 municipios para
    /// plegarlos en memoria sería pedir la tabla entera para responder una pregunta.</para>
    /// </summary>
    private const string SinAcentos = "Latin1_General_CI_AI";

    public async Task<IReadOnlyList<GeoPlace>> ListCountriesAsync(CancellationToken cancellationToken) =>
        await dbContext.GeoCountries
            .AsNoTracking()
            .Where(country => country.Active)
            .OrderBy(country => country.Name)
            .Select(country => new GeoPlace(country.Code, country.Name))
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<GeoPlace>> ListStatesAsync(
        string country,
        CancellationToken cancellationToken)
    {
        var idCountry = await ResolveCountryAsync(country, cancellationToken);

        if (idCountry is null)
        {
            return [];
        }

        return await dbContext.GeoStates
            .AsNoTracking()
            .Where(state => state.Active && state.IdGeoCountry == idCountry)
            .OrderBy(state => state.Name)
            .Select(state => new GeoPlace(state.Code, state.Name))
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<GeoPlace>> ListMunicipalitiesAsync(
        string country,
        string state,
        CancellationToken cancellationToken)
    {
        var idState = await ResolveStateAsync(country, state, cancellationToken);

        if (idState is null)
        {
            return [];
        }

        return await dbContext.GeoMunicipalities
            .AsNoTracking()
            .Where(municipality => municipality.Active && municipality.IdGeoState == idState)
            .OrderBy(municipality => municipality.Name)
            .Select(municipality => new GeoPlace(municipality.Code, municipality.Name))
            .ToArrayAsync(cancellationToken);
    }

    public async Task<PostalCodeLookup?> LookupPostalCodeAsync(
        string postalCode,
        CancellationToken cancellationToken)
    {
        var codigo = (postalCode ?? string.Empty).Trim();

        if (codigo.Length != 5 || !codigo.All(char.IsAsciiDigit))
        {
            return null;
        }

        var filas = await dbContext.GeoPostalCodes
            .AsNoTracking()
            .Where(entry => entry.Active && entry.PostalCode == codigo)
            .Join(
                dbContext.GeoMunicipalities.AsNoTracking(),
                entry => entry.IdGeoMunicipality,
                municipality => municipality.IdGeoMunicipality,
                (entry, municipality) => new { entry, municipality })
            .Join(
                dbContext.GeoStates.AsNoTracking(),
                fila => fila.municipality.IdGeoState,
                state => state.IdGeoState,
                (fila, state) => new { fila.entry, fila.municipality, state })
            .Join(
                dbContext.GeoCountries.AsNoTracking(),
                fila => fila.state.IdGeoCountry,
                country => country.IdGeoCountry,
                (fila, country) => new { fila.entry, fila.municipality, fila.state, country })
            .OrderBy(fila => fila.entry.Neighborhood)
            .ToArrayAsync(cancellationToken);

        if (filas.Length == 0)
        {
            return null;
        }

        // Un código postal puede cruzar municipios en unos pocos casos. Se responde con el del
        // primer asentamiento en vez de inventar un criterio: la pantalla deja corregirlo, y
        // callarlo eligiendo «el más frecuente» daría una respuesta que nadie puede comprobar.
        var primera = filas[0];

        return new PostalCodeLookup(
            codigo,
            primera.country.Code,
            new GeoPlace(primera.state.Code, primera.state.Name),
            new GeoPlace(primera.municipality.Code, primera.municipality.Name),
            [.. filas.Select(fila => new PostalCodeNeighborhood(fila.entry.Neighborhood, fila.entry.SettlementType))]);
    }

    public async Task<string?> ValidateAddressAsync(
        string? country,
        string? state,
        string? municipality,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(country) &&
            string.IsNullOrWhiteSpace(state) &&
            string.IsNullOrWhiteSpace(municipality))
        {
            return null;
        }

        var idCountry = await ResolveCountryAsync(country ?? string.Empty, cancellationToken);

        if (idCountry is null)
        {
            return "Selecciona un país activo.";
        }

        if (string.IsNullOrWhiteSpace(state) && string.IsNullOrWhiteSpace(municipality))
        {
            return null;
        }

        var idState = await ResolveStateAsync(country ?? string.Empty, state ?? string.Empty, cancellationToken);

        if (idState is null)
        {
            return "Selecciona un estado activo del país.";
        }

        if (string.IsNullOrWhiteSpace(municipality))
        {
            return null;
        }

        var nombre = municipality.Trim();
        var existe = await dbContext.GeoMunicipalities
            .AsNoTracking()
            .AnyAsync(
                item => item.Active
                    && item.IdGeoState == idState
                    && EF.Functions.Collate(item.Name, SinAcentos) == nombre,
                cancellationToken);

        return existe ? null : "Selecciona un municipio activo del estado.";
    }

    private async Task<Guid?> ResolveCountryAsync(string country, CancellationToken cancellationToken)
    {
        var valor = (country ?? string.Empty).Trim();

        if (valor.Length == 0)
        {
            return null;
        }

        return await dbContext.GeoCountries
            .AsNoTracking()
            .Where(item => item.Active
                && (item.Code == valor || EF.Functions.Collate(item.Name, SinAcentos) == valor))
            .Select(item => (Guid?)item.IdGeoCountry)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<Guid?> ResolveStateAsync(
        string country,
        string state,
        CancellationToken cancellationToken)
    {
        var idCountry = await ResolveCountryAsync(country, cancellationToken);

        if (idCountry is null)
        {
            return null;
        }

        var valor = (state ?? string.Empty).Trim();

        if (valor.Length == 0)
        {
            return null;
        }

        return await dbContext.GeoStates
            .AsNoTracking()
            .Where(item => item.Active
                && item.IdGeoCountry == idCountry
                && (item.Code == valor || EF.Functions.Collate(item.Name, SinAcentos) == valor))
            .Select(item => (Guid?)item.IdGeoState)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
