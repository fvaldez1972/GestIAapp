namespace GestIA.Application.Organizations;

/// <summary>
/// El alta de una organizacion. <c>CodeOrganization</c> es opcional: sin el, lo pone el servidor
/// con la forma <c>ORG-01</c>, igual que en el alta con administrador.
/// </summary>
public sealed record CreateOrganizationRequest(
    string? CodeOrganization,
    string LegalName,
    string? Rfc);

/// <summary>
/// La edicion de una organizacion.
///
/// <para><c>CodeOrganization</c> es opcional: sin el, la organizacion conserva el que ya tiene. El
/// codigo lo pone el servidor al dar de alta y no se captura ni se corrige desde la pantalla, asi
/// que pedirlo aqui obligaba a devolver un valor que nadie habia decidido, y abria la puerta a
/// cambiarlo por accidente al guardar cualquier otra cosa.</para>
/// </summary>
public sealed record UpdateOrganizationRequest(
    string? CodeOrganization,
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
