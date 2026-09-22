namespace GestIA.Application.Clients;

/// <summary>
/// Los contratos de la Zona del cliente.
///
/// <para><b>Aquí se dice Zona y en el dominio se dice <c>ClientSite</c>, y eso es deliberado.</b> El
/// renombrado del 19 de septiembre de 2026 alcanza a todo lo que cruza el cable o se le enseña a una
/// persona; la entidad y la tabla se quedaron como estaban porque renombrarlas sería una migración
/// sobre datos vivos sin ganancia funcional. La frontera está en el mapeo: de <c>ClientSite</c>
/// hacia arriba, Zona.</para>
/// </summary>
public sealed record CreateClientZoneRequest(
    Guid IdOrganization,
    Guid IdClient,
    string CodeClientZone,
    string Name,
    string Street,
    string? ExteriorNumber,
    string? InteriorNumber,
    string? Neighborhood,
    string Municipality,
    string State,
    string PostalCode,
    string? CountryCode,
    string? AccessInstructions,
    string? TimeZoneId);

public sealed record UpdateClientZoneRequest(
    Guid IdOrganization,
    Guid IdClient,
    string Name,
    string Street,
    string? ExteriorNumber,
    string? InteriorNumber,
    string? Neighborhood,
    string Municipality,
    string State,
    string PostalCode,
    string? CountryCode,
    string? AccessInstructions,
    string? TimeZoneId);

public sealed record ClientZoneResponse(
    Guid IdClientZone,
    Guid IdClient,
    string CodeClientZone,
    string Name,
    string Street,
    string? ExteriorNumber,
    string? InteriorNumber,
    string? Neighborhood,
    string Municipality,
    string State,
    string PostalCode,
    string CountryCode,
    string? AccessInstructions,
    string? TimeZoneId,
    bool Active);

/// <summary>
/// Una zona vista desde fuera de la ficha de su cliente, con el cliente al lado.
///
/// <para>Es lo que permite verlas todas juntas. Va aparte de <see cref="ClientZoneResponse"/> y no
/// como un campo opcional suyo porque dentro de la ficha el cliente ya se sabe: agregarlo allí
/// obligaría a repetirlo en cada fila para decir lo que el encabezado ya dice.</para>
/// </summary>
public sealed record OrganizationClientZoneResponse(
    Guid IdClientZone,
    Guid IdClient,
    string ClientName,
    string CodeClientZone,
    string Name,
    string Street,
    string? ExteriorNumber,
    string? InteriorNumber,
    string? Neighborhood,
    string Municipality,
    string State,
    string PostalCode,
    string CountryCode,
    string? AccessInstructions,
    string? TimeZoneId,
    bool Active);
