using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;

namespace GestIA.Domain.Workforce;

public sealed record ServiceAssignmentProfile(
    Guid IdPosition,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    string? Notes);

public sealed class ServiceAssignment : AuditableEntity
{
    private ServiceAssignment()
    {
    }

    private ServiceAssignment(
        Guid idServiceAssignment,
        Guid idEmployee,
        Guid idService,
        ServiceAssignmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdServiceAssignment = idServiceAssignment;
        IdEmployee = idEmployee;
        IdService = idService;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdServiceAssignment { get; private set; }
    public Guid IdEmployee { get; private set; }
    public Guid IdService { get; private set; }
    public Guid? IdPosition { get; private set; }
    public ServiceAssignmentType AssignmentType { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public bool IsPrimary { get; private set; }
    public string? Notes { get; private set; }
    public Employee Employee { get; private set; } = null!;
    public Service Service { get; private set; } = null!;
    public Position? Position { get; private set; }

    public static ServiceAssignment Create(
        Guid idEmployee,
        Guid idService,
        ServiceAssignmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(
            Guid.NewGuid(),
            idEmployee,
            idService,
            profile,
            actorId,
            actorName,
            occurredAt);

    public void UpdateProfile(
        ServiceAssignmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ServiceAssignmentProfile profile)
    {
        if (profile.IdPosition == Guid.Empty)
        {
            throw new ArgumentException("La posición es obligatoria.", nameof(profile));
        }

        if (profile.EndDate < profile.StartDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "La fecha final no puede ser menor que la inicial.");
        }

        IdPosition = profile.IdPosition;
        AssignmentType = profile.AssignmentType;
        StartDate = profile.StartDate;
        EndDate = profile.EndDate;
        IsPrimary = profile.IsPrimary;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
