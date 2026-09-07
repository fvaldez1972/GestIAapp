using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Operations;

public sealed record IncidentProfile(
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    string Description,
    string? ResolutionNotes);

public sealed class Incident : AuditableEntity, IOrganizationScopedEntity
{
    private Incident()
    {
    }

    private Incident(
        Guid idIncident,
        Guid idOrganization,
        Guid idService,
        IncidentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdIncident = idIncident;
        IdOrganization = idOrganization;
        IdService = idService;
        ApplyProfile(profile);
        Status = IncidentStatus.Open;
        ResolutionNotes = null;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdIncident { get; private set; }
    public Guid IdOrganization { get; private set; }

    /// <summary>
    /// Token de concurrencia. Lo genera y lo mantiene SQL Server; nadie lo asigna.
    ///
    /// <para><b>Para qué sirve, si las escrituras operativas ya corren en transacciones
    /// serializables.</b> La transacción protege contra escrituras que se cruzan <i>dentro</i> de
    /// la base. La pérdida que este token detecta vive <i>fuera</i>: el supervisor B abrió la
    /// pantalla a las 10:01, A guardó a las 10:05, y B guarda a las 10:06 con lo que tenía en
    /// pantalla desde antes. La transacción de B lee el registro ya actualizado por A y lo pisa
    /// con datos viejos, correctamente y sin error. El desfase está en el navegador, y por eso el
    /// token tiene que viajar en la respuesta y volver en la petición.</para>
    ///
    /// <para>Y aquí importa más que en otras tablas: esta entidad lleva bitácora, así que una
    /// pérdida silenciosa dejaría un historial que registra un cambio que otro pisó.</para>
    /// </summary>
    public byte[] RowVersion { get; private set; } = [];
    public Guid IdService { get; private set; }
    public Guid? IdScheduledShift { get; private set; }
    public Guid? IdEmployee { get; private set; }
    public DateOnly IncidentDate { get; private set; }
    public string IncidentType { get; private set; } = string.Empty;
    public IncidentSeverity Severity { get; private set; }
    public IncidentStatus Status { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string? ResolutionNotes { get; private set; }
    public Service Service { get; private set; } = null!;
    public ScheduledShift? ScheduledShift { get; private set; }
    public Employee? Employee { get; private set; }

    public static Incident Create(
        Guid idOrganization,
        Guid idService,
        IncidentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idService, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        IncidentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var allowed = Status == profile.Status || (Status, profile.Status) switch
        {
            (IncidentStatus.Open, IncidentStatus.InReview or IncidentStatus.Resolved or IncidentStatus.Cancelled) => true,
            (IncidentStatus.InReview, IncidentStatus.Resolved or IncidentStatus.Cancelled) => true,
            _ => false
        };
        if (!allowed)
        {
            throw new DomainRuleException("La incidencia cerrada no puede cambiar de estado.");
        }

        if (profile.Status is IncidentStatus.Resolved or IncidentStatus.Cancelled && string.IsNullOrWhiteSpace(profile.ResolutionNotes))
        {
            throw new DomainRuleException("Registra la resolución antes de cerrar la incidencia.");
        }

        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(IncidentProfile profile)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.IncidentType);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Description);
        IdScheduledShift = profile.IdScheduledShift;
        IdEmployee = profile.IdEmployee;
        IncidentDate = profile.IncidentDate;
        IncidentType = profile.IncidentType.Trim();
        Severity = profile.Severity;
        Status = profile.Status;
        Description = profile.Description.Trim();
        ResolutionNotes = string.IsNullOrWhiteSpace(profile.ResolutionNotes) ? null : profile.ResolutionNotes.Trim();
    }
}
