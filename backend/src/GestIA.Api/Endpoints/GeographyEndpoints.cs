using GestIA.Api.Security;
using GestIA.Application.Geography;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

/// <summary>
/// La geografía compartida.
///
/// <para><b>Ningún endpoint recibe organización, y por eso ninguno pasa por
/// <c>OrganizationAccessGuard</c>.</b> Eso se ve raro al lado del resto de la API, donde el guard
/// es lo primero de cada método, así que conviene decir por qué: el guard existe para impedir que
/// alguien lea datos de otra empresa, y aquí no hay datos de ninguna empresa. Un municipio de
/// México es el mismo para todas.</para>
///
/// <para><b>Sí exigen sesión y permiso de lectura.</b> No es información secreta —es un catálogo
/// público— pero tampoco hay razón para servirla a quien no ha entrado, y dejarla abierta sería
/// una excepción que alguien copiaría a un endpoint que sí importa.</para>
/// </summary>
public static class GeographyEndpoints
{
    public static IEndpointRouteBuilder MapGeographyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/geography").WithTags("Geography");

        group.MapGet("/countries", async (
            IGeographyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ListCountriesAsync(cancellationToken)))
            .RequirePermission(SecurityPermissions.CatalogsRead)
            .WithName("ListGeoCountries");

        group.MapGet("/states", async (
            string country,
            IGeographyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ListStatesAsync(country, cancellationToken)))
            .RequirePermission(SecurityPermissions.CatalogsRead)
            .WithName("ListGeoStates");

        group.MapGet("/municipalities", async (
            string country,
            string state,
            IGeographyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ListMunicipalitiesAsync(country, state, cancellationToken)))
            .RequirePermission(SecurityPermissions.CatalogsRead)
            .WithName("ListGeoMunicipalities");

        // Responde 404 cuando el código no está en el padrón, que NO es lo mismo que decir que no
        // existe: el catálogo se publica cada tanto y los fraccionamientos nuevos tardan en entrar.
        // Por eso la pantalla se queda con los desplegables en vez de impedir la captura.
        group.MapGet("/postal-codes/{postalCode}", async (
            string postalCode,
            IGeographyService service,
            CancellationToken cancellationToken) =>
        {
            var resultado = await service.LookupPostalCodeAsync(postalCode, cancellationToken);
            return resultado is null ? Results.NotFound() : Results.Ok(resultado);
        })
            .RequirePermission(SecurityPermissions.CatalogsRead)
            .WithName("LookupPostalCode");

        return endpoints;
    }
}
