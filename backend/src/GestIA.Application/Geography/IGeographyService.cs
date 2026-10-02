namespace GestIA.Application.Geography;

/// <summary>
/// La geografía compartida, para quien la dibuja y para quien la valida.
///
/// <para><b>No recibe organización en ningún método, y eso es el punto.</b> Países, estados y
/// municipios son los mismos para todas: pedirle una organización sugeriría que puede devolver
/// cosas distintas según quién pregunte, que es justo lo que se retiró.</para>
/// </summary>
public interface IGeographyService
{
    Task<IReadOnlyList<GeoPlace>> ListCountriesAsync(CancellationToken cancellationToken);

    /// <param name="country">Clave ISO o nombre. Se acepta lo que la pantalla tenga a mano.</param>
    Task<IReadOnlyList<GeoPlace>> ListStatesAsync(string country, CancellationToken cancellationToken);

    /// <param name="state">Clave del INEGI o nombre del estado.</param>
    Task<IReadOnlyList<GeoPlace>> ListMunicipalitiesAsync(
        string country,
        string state,
        CancellationToken cancellationToken);

    /// <summary>
    /// Qué hay en un código postal: su estado, su municipio y sus colonias.
    ///
    /// <para>Devuelve <c>null</c> cuando el código no está en el catálogo, que es distinto de que
    /// no exista: el padrón se publica cada tanto y los fraccionamientos nuevos tardan en entrar.
    /// Por eso la pantalla conserva los desplegables como respaldo en vez de impedir la captura.</para>
    /// </summary>
    Task<PostalCodeLookup?> LookupPostalCodeAsync(string postalCode, CancellationToken cancellationToken);

    /// <summary>
    /// Si una dirección escrita corresponde a la geografía conocida.
    ///
    /// <para>Se compara por nombre plegado porque es lo que las direcciones guardan. Devuelve el
    /// primer problema encontrado, o <c>null</c> si la dirección es válida.</para>
    /// </summary>
    Task<string?> ValidateAddressAsync(
        string? country,
        string? state,
        string? municipality,
        CancellationToken cancellationToken);
}
