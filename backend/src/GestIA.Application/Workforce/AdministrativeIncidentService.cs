using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

public interface IAdministrativeIncidentService
{
    Task<IReadOnlyList<AdministrativeIncidentResponse>> ListAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<AdministrativeIncidentResponse> CreateAsync(
        CreateAdministrativeIncidentRequest request,
        CancellationToken cancellationToken);

    Task<AdministrativeIncidentResponse> UpdateAsync(
        Guid idAdministrativeIncident,
        UpdateAdministrativeIncidentRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idAdministrativeIncident,
        CancellationToken cancellationToken);
}

public interface IAdministrativeIncidentRepository
{
    Task<IReadOnlyList<AdministrativeIncident>> ListAsync(Guid idEmployee, CancellationToken cancellationToken);

    Task<AdministrativeIncident?> GetAsync(
        Guid idEmployee,
        Guid idAdministrativeIncident,
        CancellationToken cancellationToken);

    Task AddAsync(AdministrativeIncident incident, CancellationToken cancellationToken);

    /// <summary>La entrada del catálogo, si existe, está activa y es del tipo correcto.</summary>
    Task<BusinessCatalogItem?> GetIncidentTypeAsync(
        Guid idOrganization,
        Guid idCatalogItem,
        CancellationToken cancellationToken);

    Task<bool> EmployeeExistsAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken);
}

/// <summary>
/// Las incidencias administrativas del expediente.
///
/// <para><b>No se confunden con las de la operación diaria.</b> Una incidencia operativa describe
/// lo que pasó en un turno y vive atada a un servicio; ésta describe un hecho de la relación
/// laboral —un acta, una llamada de atención— y vive atada a la persona. Tienen endpoints
/// distintos, pantallas distintas y permisos distintos, y compartir tabla habría hecho que un
/// filtro por servicio arrastrara actas administrativas.</para>
/// </summary>
public sealed class AdministrativeIncidentService(
    IAdministrativeIncidentRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IAdministrativeIncidentService
{
    public async Task<IReadOnlyList<AdministrativeIncidentResponse>> ListAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var incidents = await repository.ListAsync(idEmployee, cancellationToken);
        return incidents.Select(incident => Map(incident)).ToArray();
    }

    public async Task<AdministrativeIncidentResponse> CreateAsync(
        CreateAdministrativeIncidentRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var tipo = await EnsureIncidentTypeAsync(
            request.IdOrganization, request.IdIncidentTypeCatalogItem, cancellationToken);
        var profile = Validate(request.IdIncidentTypeCatalogItem, request.OccurredDate, request.Details);

        var incident = AdministrativeIncident.Create(
            request.IdOrganization,
            request.IdEmployee,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddAsync(incident, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(incident, tipo);
    }

    public async Task<AdministrativeIncidentResponse> UpdateAsync(
        Guid idAdministrativeIncident,
        UpdateAdministrativeIncidentRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var tipo = await EnsureIncidentTypeAsync(
            request.IdOrganization, request.IdIncidentTypeCatalogItem, cancellationToken);
        var profile = Validate(request.IdIncidentTypeCatalogItem, request.OccurredDate, request.Details);

        var incident = await repository.GetAsync(request.IdEmployee, idAdministrativeIncident, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la incidencia administrativa solicitada.");

        incident.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(incident, tipo);
    }

    public async Task DeactivateAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idAdministrativeIncident,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var incident = await repository.GetAsync(idEmployee, idAdministrativeIncident, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la incidencia administrativa solicitada.");

        incident.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// La fecha no puede ser del futuro.
    ///
    /// <para>Es una fecha de <b>ocurrencia</b>: describe algo que ya pasó. Permitir mañana dejaría
    /// registrar un acta por un hecho que todavía no sucedió, y esa fila bloquearía asignaciones
    /// por algo que quizá no ocurra.</para>
    /// </summary>
    private AdministrativeIncidentProfile Validate(Guid idIncidentType, DateOnly occurredDate, string details)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var texto = InputValidation.Required(details, nameof(details), 2000, errors);

        if (occurredDate > clock.Today)
        {
            errors[nameof(occurredDate)] = ["La fecha de ocurrencia no puede ser futura."];
        }

        InputValidation.ThrowIfInvalid(errors);
        return new AdministrativeIncidentProfile(idIncidentType, occurredDate, texto);
    }

    private async Task<BusinessCatalogItem> EnsureIncidentTypeAsync(
        Guid idOrganization,
        Guid idCatalogItem,
        CancellationToken cancellationToken) =>
        await repository.GetIncidentTypeAsync(idOrganization, idCatalogItem, cancellationToken)
        ?? throw new ResourceConflictException(
            "Selecciona un tipo activo del catálogo de incidencias administrativas.");

    private async Task EnsureEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        if (!await repository.EmployeeExistsAsync(idOrganization, idEmployee, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró la persona solicitada.");
        }
    }

    private static AdministrativeIncidentResponse Map(
        AdministrativeIncident incident,
        BusinessCatalogItem? tipo = null)
    {
        var catalogo = incident.IncidentTypeCatalogItem ?? tipo;

        return new AdministrativeIncidentResponse(
            incident.IdAdministrativeIncident,
            incident.IdEmployee,
            incident.IdIncidentTypeCatalogItem,
            catalogo?.Name ?? "Tipo no encontrado",
            // Sin marca decidida, informativa: es el mismo cierre que usa la elegibilidad, y por la
            // misma razón. Estrenar el catálogo impidiendo asignar a quien tenga cualquier
            // incidencia sería peor que dejar constancia hasta que alguien la marque.
            catalogo?.IsBlocking ?? false,
            incident.OccurredDate,
            incident.Details,
            incident.Active);
    }
}
