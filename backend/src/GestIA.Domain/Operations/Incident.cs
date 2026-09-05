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
