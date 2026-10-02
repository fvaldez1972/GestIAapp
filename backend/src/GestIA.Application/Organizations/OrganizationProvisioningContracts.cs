namespace GestIA.Application.Organizations;

public sealed record InitialOrganizationAdminRequest(
    string DisplayName,
    string Email,
    string Password);

/// <summary>
/// El alta de una organizacion junto con su administrador inicial.
///
/// <para><c>CodeOrganization</c> es opcional: cuando no viene, lo pone el servidor con la forma
/// <c>ORG-01</c>. El codigo es un identificador de conveniencia, no la clave del registro, y
/// pedirselo a quien da de alta una empresa le hace inventar una convencion que el sistema ya
/// tiene. Cuando si viene, se respeta y se valida como siempre.</para>
/// </summary>
public sealed record CreateOrganizationWithAdminRequest(
    string? CodeOrganization,
    string LegalName,
    string? Rfc,
    InitialOrganizationAdminRequest Admin);

public sealed record OrganizationProvisioningResponse(
    OrganizationResponse Organization,
    Guid IdAdminUser,
    string AdminEmail,
    string AdminDisplayName);
