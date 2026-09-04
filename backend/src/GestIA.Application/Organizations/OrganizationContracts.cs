namespace GestIA.Application.Organizations;

public sealed record CreateOrganizationRequest(
    string CodeOrganization,
    string LegalName,
    string? Rfc);

public sealed record UpdateOrganizationRequest(
    string CodeOrganization,
    string LegalName,
    string? Rfc);

public sealed record OrganizationResponse(
    Guid IdOrganization,
    string CodeOrganization,
    string LegalName,
    string? Rfc,
    bool Active);

public sealed record OrganizationClientSummaryResponse(
    Guid IdClient,
    string CodeClient,
    string LegalName,
    string? TradeName,
    string Rfc,
    bool Active);

public sealed record OrganizationGovernanceSummaryResponse(
    OrganizationResponse Organization,
    IReadOnlyList<OrganizationClientSummaryResponse> Clients,
    int UsersCount,
    int AdminsCount);
