namespace GestIA.Application.Organizations;

public sealed record InitialOrganizationAdminRequest(
    string DisplayName,
    string Email,
    string Password);

public sealed record CreateOrganizationWithAdminRequest(
    string CodeOrganization,
    string LegalName,
    string? Rfc,
    InitialOrganizationAdminRequest Admin);

public sealed record OrganizationProvisioningResponse(
    OrganizationResponse Organization,
    Guid IdAdminUser,
    string AdminEmail,
    string AdminDisplayName);
