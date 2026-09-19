using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public sealed record CreateClientContactRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid? IdClientZone,
    ClientContactPurpose Purpose,
    string FullName,
    string? JobTitle,
    string? Email,
    string? Phone,
    string? MobilePhone,
    bool IsPrimary);

public sealed record UpdateClientContactRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid? IdClientZone,
    ClientContactPurpose Purpose,
    string FullName,
    string? JobTitle,
    string? Email,
    string? Phone,
    string? MobilePhone,
    bool IsPrimary);

public sealed record ClientContactResponse(
    Guid IdClientContact,
    Guid IdClient,
    Guid? IdClientZone,
    string? ClientZoneName,
    ClientContactPurpose Purpose,
    string FullName,
    string? JobTitle,
    string? Email,
    string? Phone,
    string? MobilePhone,
    bool IsPrimary,
    bool Active);
