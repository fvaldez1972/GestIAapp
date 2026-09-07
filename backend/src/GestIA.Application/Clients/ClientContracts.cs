using GestIA.Application.Common;

namespace GestIA.Application.Clients;

/// <summary>
/// El alta de un cliente.
///
/// <para><c>CodeClient</c> es opcional: cuando no viene, <b>el servidor lo genera</b> con la forma
/// <c>CLI-01</c>. Es un identificador visible que después sirve para buscar, pero que nadie
/// necesita inventar al dar de alta, y pedirlo en el formulario sólo agregaba un campo que el
/// usuario no sabe llenar.</para>
/// </summary>
public sealed record CreateClientRequest(
    Guid IdOrganization,
    string? CodeClient,
    string LegalName,
    string? TradeName,
    string Rfc,
    string? Nationality,
    string? TaxActivity,
    string? TaxAddress,
    DateOnly? PublicRegistryDate,
    string? CommercialRegistryFolio,
    string? EmployerRegistrationNumber,
    DateOnly? IncorporationDate,
    string? IncorporationDeedNumber,
    string? LegalRepresentativeInstrumentNumber);

public sealed record UpdateClientRequest(
    Guid IdOrganization,
    string LegalName,
    string? TradeName,
    string Rfc,
    string? Nationality,
    string? TaxActivity,
    string? TaxAddress,
    DateOnly? PublicRegistryDate,
    string? CommercialRegistryFolio,
    string? EmployerRegistrationNumber,
    DateOnly? IncorporationDate,
    string? IncorporationDeedNumber,
    string? LegalRepresentativeInstrumentNumber);

public sealed record ClientResponse(
    Guid IdClient,
    Guid IdOrganization,
    string OrganizationName,
    string CodeClient,
    string LegalName,
    string? TradeName,
    string Rfc,
    string? Nationality,
    string? TaxActivity,
    string? TaxAddress,
    DateOnly? PublicRegistryDate,
    string? CommercialRegistryFolio,
    string? EmployerRegistrationNumber,
    DateOnly? IncorporationDate,
    string? IncorporationDeedNumber,
    string? LegalRepresentativeInstrumentNumber,
    bool Active,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record ClientListQuery(
    Guid IdOrganization,
    string? Search = null,
    ClientStatusFilter Status = ClientStatusFilter.Active,
    ClientSitePresenceFilter SitePresence = ClientSitePresenceFilter.Any,
    string? Municipality = null,
    int Page = 1,
    int PageSize = 20);


/// <summary>
/// Los tres modos del listado, con la misma forma que en Servicios.
///
/// <para><c>Active</c> es el de omisión. <c>All</c> apaga el borrado lógico <b>y sólo ése</b>: el
/// filtro de organización sigue mandando.</para>
/// </summary>
public enum ClientStatusFilter
{
    Active,
    Inactive,
    All
}

/// <summary>
/// Si el cliente tiene sede.
///
/// <para>No es un detalle de catálogo: <b>la sede es el prerrequisito para crear servicios</b>,
/// porque el servicio se liga a una sede. Poder listar los que no la tienen es poder cerrar el
/// hueco antes de que alguien tropiece con él en la pantalla siguiente.</para>
/// </summary>
public enum ClientSitePresenceFilter
{
    Any,
    WithSite,
    WithoutSite
}

public sealed record ClientSearchCriteria(
    Guid IdOrganization,
    string? Search,
    ClientStatusFilter Status,
    ClientSitePresenceFilter SitePresence,
    string? Municipality,
    int Skip,
    int Take);

/// <summary>
/// Un cliente en el listado.
///
/// <para>Trae resueltos los conteos que la tabla muestra. Sin ellos, saber si un cliente tiene
/// sede costaría una consulta por fila, y es justo el dato que decide si el paso siguiente se
/// puede dar.</para>
/// </summary>
public sealed record ClientListItemResponse(
    Guid IdClient,
    Guid IdOrganization,
    string CodeClient,
    string LegalName,
    string? TradeName,
    string Rfc,
    bool Active,
    DateTime CreatedAt,
    int SiteCount,
    int SitesWithoutContact,
    int ContactCount,
    int ServiceCount,
    string? MainSiteName,
    string? MainSiteMunicipality,
    string? MainSiteState);

public sealed record ClientSearchResult(
    IReadOnlyList<ClientResponse> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public PagedResult<ClientResponse> ToPagedResult() =>
        new(Items, TotalCount, Page, PageSize);
}
