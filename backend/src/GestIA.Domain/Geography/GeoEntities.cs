namespace GestIA.Domain.Geography;

/// <summary>
/// La geografía, <b>compartida por todas las organizaciones</b>.
///
/// <para><b>Ninguna de estas entidades declara <c>IOrganizationScopedEntity</c>, y es a propósito.</b>
/// Hasta el 22 de septiembre de 2026 los países, estados y municipios vivían en
/// <c>BusinessCatalogItems</c>, que es multiempresa: eran 2 478 municipios <b>repetidos ocho
/// veces</b>, una copia por organización, de unos datos que son los mismos para todas. Con las
/// colonias eso pasaba de incómodo a inviable —unas 145 000 por organización, medio giga con ocho
/// empresas— y el alta de una organización nueva habría insertado 147 000 filas.</para>
///
/// <para><b>Quedar fuera del filtro global es la decisión, no un olvido.</b> El filtro de este
/// proyecto falla cerrado: una entidad con alcance devuelve cero filas si no hay organización
/// fijada. Estas no lo llevan porque no pertenecen a nadie, y por eso mismo <b>no guardan nada de
/// nadie</b>: un país no dice qué empresa lo usa. Si alguien les agrega una columna de organización
/// «para que sean consistentes», vuelve el problema que esto vino a resolver; hay una prueba que
/// falla si pasa.</para>
///
/// <para><b>Nada apunta a ellas todavía.</b> Las direcciones de zonas y de personal guardan el
/// <b>nombre</b> del estado y del municipio como texto, no su identificador. Por eso sacar la
/// geografía del catálogo no rompió ninguna llave foránea, y por eso convertir esas columnas en
/// claves foráneas es una decisión aparte, para otro día.</para>
/// </summary>
public sealed class GeoCountry
{
    private GeoCountry()
    {
    }

    public GeoCountry(Guid idGeoCountry, string code, string name)
    {
        IdGeoCountry = idGeoCountry;
        Code = code;
        Name = name;
        Active = true;
    }

    public Guid IdGeoCountry { get; private set; }

    /// <summary>Clave ISO 3166-1 alfa-2. Es un estándar externo, no una clave de este sistema.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;
    public bool Active { get; private set; } = true;
}

/// <summary>Un estado o entidad federativa. Ver <see cref="GeoCountry"/> para por qué es compartido.</summary>
public sealed class GeoState
{
    private GeoState()
    {
    }

    public GeoState(Guid idGeoState, Guid idGeoCountry, string code, string name)
    {
        IdGeoState = idGeoState;
        IdGeoCountry = idGeoCountry;
        Code = code;
        Name = name;
        Active = true;
    }

    public Guid IdGeoState { get; private set; }
    public Guid IdGeoCountry { get; private set; }

    /// <summary>Clave del catálogo único del INEGI: «01» a «32» para México.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;
    public bool Active { get; private set; } = true;
}

/// <summary>Un municipio o alcaldía. Ver <see cref="GeoCountry"/> para por qué es compartido.</summary>
public sealed class GeoMunicipality
{
    private GeoMunicipality()
    {
    }

    public GeoMunicipality(Guid idGeoMunicipality, Guid idGeoState, string code, string name)
    {
        IdGeoMunicipality = idGeoMunicipality;
        IdGeoState = idGeoState;
        Code = code;
        Name = name;
        Active = true;
    }

    public Guid IdGeoMunicipality { get; private set; }
    public Guid IdGeoState { get; private set; }

    /// <summary>Clave del INEGI de cinco dígitos: los dos del estado más los tres del municipio.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;
    public bool Active { get; private set; } = true;
}

/// <summary>
/// Una colonia con su código postal.
///
/// <para><b>Nace vacía.</b> Los países, estados y municipios salen del catálogo único del INEGI, que
/// ya vive en el repositorio. Las colonias son de <b>SEPOMEX</b> —el padrón de asentamientos que
/// acompaña al catálogo de códigos postales— y ese archivo no está aquí todavía.</para>
///
/// <para><b>Un código postal tiene varias colonias, y una colonia puede repetirse en municipios
/// distintos.</b> Por eso la fila es la pareja código postal + colonia, y no ninguno de los dos por
/// separado. La unicidad es sobre los tres: municipio, código postal y nombre.</para>
///
/// <para><b>Por qué esta tabla y no un cuarto desplegable.</b> Encadenar país, estado, municipio y
/// colonia obliga a cuatro elecciones para escribir una dirección. Con el código postal se escribe
/// uno y se resuelven los otros tres, que es como funciona cualquier formulario mexicano.</para>
/// </summary>
public sealed class GeoPostalCode
{
    private GeoPostalCode()
    {
    }

    public GeoPostalCode(
        Guid idGeoPostalCode,
        Guid idGeoMunicipality,
        string postalCode,
        string neighborhood,
        string? settlementType)
    {
        IdGeoPostalCode = idGeoPostalCode;
        IdGeoMunicipality = idGeoMunicipality;
        PostalCode = postalCode;
        Neighborhood = neighborhood;
        SettlementType = settlementType;
        Active = true;
    }

    public Guid IdGeoPostalCode { get; private set; }
    public Guid IdGeoMunicipality { get; private set; }

    /// <summary>Cinco dígitos. Se guarda como texto porque «06700» no es el número 6700.</summary>
    public string PostalCode { get; private set; } = string.Empty;

    public string Neighborhood { get; private set; } = string.Empty;

    /// <summary>Colonia, fraccionamiento, barrio… Lo dice SEPOMEX y ayuda a distinguir homónimas.</summary>
    public string? SettlementType { get; private set; }

    public bool Active { get; private set; } = true;
}
