using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public sealed record CreateClientContactRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid? IdClientZone,
    /// <summary>General o Zone. Con Zone, la zona es obligatoria y tiene que ser del cliente.</summary>
    ClientContactScope Scope,
    /// <summary>El propósito, contra el catálogo <c>ContactPurpose</c>.</summary>
    Guid? IdPurposeCatalogItem,
    /// <summary>El puesto, contra el catálogo <c>ContactJobPosition</c>.</summary>
    Guid? IdContactJobPositionCatalogItem,
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
    /// <summary>General o Zone. Con Zone, la zona es obligatoria y tiene que ser del cliente.</summary>
    ClientContactScope Scope,
    /// <summary>El propósito, contra el catálogo <c>ContactPurpose</c>.</summary>
    Guid? IdPurposeCatalogItem,
    /// <summary>El puesto, contra el catálogo <c>ContactJobPosition</c>.</summary>
    Guid? IdContactJobPositionCatalogItem,
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
    /// <summary>General o Zone. Con Zone, la zona es obligatoria y tiene que ser del cliente.</summary>
    ClientContactScope Scope,
    /// <summary>El propósito, contra el catálogo <c>ContactPurpose</c>.</summary>
    Guid? IdPurposeCatalogItem,
    /// <summary>El puesto, contra el catálogo <c>ContactJobPosition</c>.</summary>
    Guid? IdContactJobPositionCatalogItem,
    string? ClientZoneName,
    string? PurposeName,
    string? ContactJobPositionName,
    ClientContactPurpose Purpose,
    string FullName,
    string? JobTitle,
    string? Email,
    string? Phone,
    string? MobilePhone,
    bool IsPrimary,
    bool Active);
