namespace GestIA.Application.Support;

public sealed record StartSupportSessionRequest(
    Guid IdOrganization,
    string Reason,
    int DurationMinutes = 60);

public sealed record SupportSessionResponse(
    Guid IdSupportSession,
    Guid IdOrganization,
    string OrganizationName,
    string Reason,
    DateTime StartsAt,
    DateTime ExpiresAt,
    DateTime? EndedAt,
    string StartedBy,
    bool Active);
