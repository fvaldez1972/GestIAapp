namespace GestIA.Application.Workforce;

public sealed record CreateAdministrativeIncidentRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    Guid IdIncidentTypeCatalogItem,
    DateOnly OccurredDate,
    string Details);

public sealed record UpdateAdministrativeIncidentRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    Guid IdIncidentTypeCatalogItem,
    DateOnly OccurredDate,
    string Details);

public sealed record AdministrativeIncidentResponse(
    Guid IdAdministrativeIncident,
    Guid IdEmployee,
    Guid IdIncidentTypeCatalogItem,
    string IncidentTypeName,
    /// <summary>
    /// Si tener una incidencia de este tipo impide asignar, según la marca de su entrada del
    /// catálogo. Viene resuelta para que la pantalla no tenga que cargar el catálogo entero.
    /// </summary>
    bool IsBlocking,
    DateOnly OccurredDate,
    string Details,
    bool Active);
