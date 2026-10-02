namespace GestIA.Application.Security;

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthSessionResponse(
    string AccessToken,
    DateTime ExpiresAt,
    AuthUserResponse User,
    IReadOnlyList<OrganizationAccessResponse> Organizations,
    IReadOnlyList<string> Permissions);

public sealed record AuthUserResponse(Guid IdUser, string Email, string DisplayName);

public sealed record OrganizationAccessResponse(Guid IdOrganization, string CodeOrganization, string LegalName);

public sealed record AuthenticatedUserAccess(
    Guid IdUser,
    string Email,
    string DisplayName,
    string PasswordHash,
    string PasswordSalt,
    int PasswordIterations,
    IReadOnlyList<OrganizationAccessResponse> Organizations,
    IReadOnlyList<string> Permissions);
