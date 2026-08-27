namespace GestIA.Application.Clients;

public sealed record CreateClientSiteRequest(
    Guid IdOrganization,
    Guid IdClient,
    string CodeClientSite,
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

public sealed record UpdateClientSiteRequest(
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

public sealed record ClientSiteResponse(
    Guid IdClientSite,
    Guid IdClient,
    string CodeClientSite,
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
