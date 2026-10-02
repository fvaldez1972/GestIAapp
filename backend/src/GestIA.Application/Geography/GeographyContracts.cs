namespace GestIA.Application.Geography;

/// <summary>
/// Un lugar de la geografía compartida, como lo necesita un desplegable: su clave y su nombre.
///
/// <para><b>Viaja con las dos cosas aunque las direcciones guarden el nombre.</b> El nombre es lo
/// que hoy conservan <c>ClientSites</c> y <c>Employees</c>, así que sin él la pantalla no podría
/// guardar lo que ya guarda; y la clave viaja porque es lo estable —«Ciudad de México» se llamó
/// «Distrito Federal» y la clave 09 no cambió—, y es lo que permitirá convertir esas columnas en
/// llaves foráneas el día que se decida.</para>
/// </summary>
public sealed record GeoPlace(string Code, string Name);

/// <summary>
/// Lo que resuelve un código postal.
///
/// <para>Devuelve el estado y el municipio ya resueltos, y la lista de colonias de ese código. Es
/// lo que permite escribir cinco dígitos en vez de encadenar cuatro desplegables.</para>
/// </summary>
public sealed record PostalCodeLookup(
    string PostalCode,
    string CountryCode,
    GeoPlace State,
    GeoPlace Municipality,
    IReadOnlyList<PostalCodeNeighborhood> Neighborhoods);

public sealed record PostalCodeNeighborhood(string Name, string? SettlementType);
