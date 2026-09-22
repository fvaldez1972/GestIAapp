using GestIA.Application.Geography;
using GestIA.Domain.Geography;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// La geografía compartida, leída como la leen las pantallas.
///
/// <para><b>Por qué contra SQL Server y no en memoria.</b> Lo que se comprueba aquí es en buena
/// parte cosa del servidor: la comparación de nombres se hace con una intercalación que ignora
/// acentos —<c>Latin1_General_CI_AI</c>— porque la base del proyecto es <b>sensible a acentos</b>.
/// Un proveedor en memoria compara con las reglas de .NET y diría que «Merida» y «Mérida» son
/// distintas o iguales según su propio criterio, no según el que va a correr en producción. Esa es
/// exactamente la pregunta que se está haciendo.</para>
///
/// <para>Contra una base temporal propia, creada y desechada por la prueba. Nunca toca
/// <c>db-gestia-dev</c>.</para>
/// </summary>
public sealed class GeographyLookupTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;

    private static readonly Guid IdMexico = Guid.NewGuid();
    private static readonly Guid IdNuevoLeon = Guid.NewGuid();
    private static readonly Guid IdYucatan = Guid.NewGuid();
    private static readonly Guid IdMonterrey = Guid.NewGuid();
    private static readonly Guid IdMerida = Guid.NewGuid();
    private static readonly Guid IdCelestun = Guid.NewGuid();

    /// <summary>
    /// Una dirección escrita sin acentos encuentra su estado y su municipio.
    ///
    /// <para>Es el caso que decidió la implementación. La base es
    /// <c>SQL_Latin1_General_CP1_CI_AS</c>: ignora mayúsculas pero <b>no</b> acentos, así que sin la
    /// intercalación explícita «Nuevo Leon» no encontraría «Nuevo León» y el mensaje diría
    /// «selecciona un estado activo» delante de un estado que existe y está activo.</para>
    ///
    /// <para>El control va en la misma prueba: un municipio que <b>no</b> pertenece a ese estado
    /// tiene que ser rechazado. Sin él, «acepta todo» pasaría igual.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AnAddressWrittenWithoutAccentsStillFindsItsPlace()
    {
        await SeedAsync();
        var geografia = Servicio();

        Assert.Null(await geografia.ValidateAddressAsync("MX", "Nuevo Leon", "Monterrey", Token));
        Assert.Null(await geografia.ValidateAddressAsync("MX", "YUCATAN", "merida", Token));

        // Control: el municipio correcto del estado equivocado no pasa.
        Assert.Equal(
            "Selecciona un municipio activo del estado.",
            await geografia.ValidateAddressAsync("MX", "Yucatan", "Monterrey", Token));
    }

    /// <summary>
    /// Se acepta la clave tanto como el nombre.
    ///
    /// <para>Las direcciones guardadas traen <c>CountryCode</c> = «MX» y el estado por nombre. Si el
    /// servicio exigiera una sola de las dos formas, la mitad de las fichas existentes dejarían de
    /// validar el día que se guarde cualquier otro campo.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task EitherTheCodeOrTheNameIdentifiesAPlace()
    {
        await SeedAsync();
        var geografia = Servicio();

        Assert.Null(await geografia.ValidateAddressAsync("MX", "19", "Monterrey", Token));
        Assert.Null(await geografia.ValidateAddressAsync("México", "Nuevo León", "Monterrey", Token));

        // Control: una clave que no existe se rechaza, así que no está aceptando cualquier texto.
        Assert.Equal(
            "Selecciona un estado activo del país.",
            await geografia.ValidateAddressAsync("MX", "99", "Monterrey", Token));
    }

    /// <summary>
    /// Un estado desactivado deja de servir, y el control es el mismo estado antes de desactivarlo.
    ///
    /// <para>Sin el antes, «rechaza el estado inactivo» no distinguiría una desactivación que
    /// funciona de un estado que nunca se sembró bien.</para>
    ///
    /// <para><b>Devuelve el estado a como estaba.</b> Las pruebas de esta clase comparten una sola
    /// base —la del fixture— y ésta es la única que escribe. La primera versión no restauraba, y
    /// las otras dos pruebas que nombran Yucatán fallaron según el orden en que xUnit las corrió:
    /// no por lo que comprueban, sino por lo que ésta había dejado atrás.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task ADeactivatedStateStopsBeingAnOption()
    {
        await SeedAsync();

        Assert.Null(await Servicio().ValidateAddressAsync("MX", "Yucatan", "Merida", Token));

        await CambiarYucatanAsync(activo: false);
        try
        {
            Assert.Equal(
                "Selecciona un estado activo del país.",
                await Servicio().ValidateAddressAsync("MX", "Yucatan", "Merida", Token));

            // Y el otro estado sigue sirviendo: se desactivó uno, no la tabla.
            Assert.Null(await Servicio().ValidateAddressAsync("MX", "Nuevo Leon", "Monterrey", Token));
        }
        finally
        {
            await CambiarYucatanAsync(activo: true);
        }
    }

    private async Task CambiarYucatanAsync(bool activo)
    {
        await using var contexto = database.Context();
        await contexto.Database.ExecuteSqlRawAsync(
            "UPDATE GeoStates SET Active = {0} WHERE IdGeoState = {1}", [activo, IdYucatan], Token);
    }

    /// <summary>
    /// Los desplegables encadenan: los municipios de un estado son sólo los suyos.
    /// </summary>
    [OperationalSqlFact]
    public async Task EachListIsLimitedToItsParent()
    {
        await SeedAsync();
        var geografia = Servicio();

        var estados = await geografia.ListStatesAsync("MX", Token);
        Assert.Equal(["Nuevo León", "Yucatán"], estados.Select(estado => estado.Name));

        var municipios = await geografia.ListMunicipalitiesAsync("MX", "Nuevo León", Token);
        Assert.Equal(["Monterrey"], municipios.Select(municipio => municipio.Name));

        // Control: los del otro estado existen, y son otros.
        Assert.Equal(
            ["Celestún", "Mérida"],
            (await geografia.ListMunicipalitiesAsync("MX", "Yucatán", Token)).Select(municipio => municipio.Name));

        // Y un país que no existe devuelve vacío, no todo.
        Assert.Empty(await geografia.ListStatesAsync("US", Token));
    }

    /// <summary>
    /// Escribir cinco dígitos resuelve estado, municipio y colonias.
    ///
    /// <para>Es la razón de ser de la tabla de códigos postales: una captura en vez de cuatro
    /// desplegables encadenados.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task APostalCodeResolvesItsPlaceAndItsNeighborhoods()
    {
        await SeedAsync();
        var geografia = Servicio();

        var resuelto = await geografia.LookupPostalCodeAsync("64000", Token);

        Assert.NotNull(resuelto);
        Assert.Equal("MX", resuelto.CountryCode);
        Assert.Equal("Nuevo León", resuelto.State.Name);
        Assert.Equal("Monterrey", resuelto.Municipality.Name);
        Assert.Equal(["Centro", "Obispado"], resuelto.Neighborhoods.Select(colonia => colonia.Name));
        Assert.Equal("Colonia", resuelto.Neighborhoods[1].SettlementType);

        // Control: un código que no está en el padrón responde que no sabe, no el primero que haya.
        Assert.Null(await geografia.LookupPostalCodeAsync("99999", Token));

        // Y lo que no es un código postal tampoco consulta la tabla.
        Assert.Null(await geografia.LookupPostalCodeAsync("640", Token));
    }

    /// <summary>
    /// Una dirección vacía no es una dirección inválida.
    ///
    /// <para>El personal y las zonas pueden guardarse sin dirección; exigirla aquí convertiría una
    /// validación de coherencia en un campo obligatorio que nadie pidió.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AnEmptyAddressIsNotRejected()
    {
        await SeedAsync();
        var geografia = Servicio();

        Assert.Null(await geografia.ValidateAddressAsync(null, null, null, Token));
        Assert.Null(await geografia.ValidateAddressAsync("MX", null, null, Token));
        Assert.Null(await geografia.ValidateAddressAsync("MX", "Nuevo León", null, Token));
    }

    private GeographyService Servicio() => new(database.Context());

    /// <summary>
    /// Una geografía mínima con acentos de verdad.
    ///
    /// <para>La siembra real de 2 478 municipios vive en la migración, y estas pruebas corren sobre
    /// un esquema creado del modelo, sin migraciones. Se siembra a mano lo justo para preguntar lo
    /// que se quiere preguntar: dos estados —uno para el control—, sus municipios y un código
    /// postal con dos colonias.</para>
    /// </summary>
    private async Task SeedAsync()
    {
        await using var contexto = database.Context();

        if (await contexto.GeoCountries.AnyAsync(Token))
        {
            return;
        }

        contexto.Add(new GeoCountry(IdMexico, "MX", "México"));
        contexto.Add(new GeoState(IdNuevoLeon, IdMexico, "19", "Nuevo León"));
        contexto.Add(new GeoState(IdYucatan, IdMexico, "31", "Yucatán"));
        contexto.Add(new GeoMunicipality(IdMonterrey, IdNuevoLeon, "19039", "Monterrey"));
        contexto.Add(new GeoMunicipality(IdMerida, IdYucatan, "31050", "Mérida"));
        contexto.Add(new GeoMunicipality(IdCelestun, IdYucatan, "31013", "Celestún"));
        contexto.Add(new GeoPostalCode(Guid.NewGuid(), IdMonterrey, "64000", "Centro", "Colonia"));
        contexto.Add(new GeoPostalCode(Guid.NewGuid(), IdMonterrey, "64000", "Obispado", "Colonia"));
        await contexto.SaveChangesAsync(Token);
    }
}
