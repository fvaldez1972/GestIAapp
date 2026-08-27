namespace GestIA.Application.Organizations;

public sealed record CreateOrganizationRequest(
    string CodeOrganization,
    string LegalName,
    string? Rfc);

public sealed record OrganizationResponse(
    Guid IdOrganization,
    string CodeOrganization,
    string LegalName,
    string? Rfc,
    bool Active);
