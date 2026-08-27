using GestIA.Application.Common;

namespace GestIA.Application.Clients;

public sealed record CreateClientRequest(
    Guid IdOrganization,
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
    int Page = 1,
    int PageSize = 20);

public sealed record ClientSearchCriteria(
    Guid IdOrganization,
    string? Search,
    int Skip,
    int Take);

public sealed record ClientSearchResult(
    IReadOnlyList<ClientResponse> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public PagedResult<ClientResponse> ToPagedResult() =>
        new(Items, TotalCount, Page, PageSize);
}
