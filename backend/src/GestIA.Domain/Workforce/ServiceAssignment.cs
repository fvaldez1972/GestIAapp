using GestIA.Domain.Common;
using GestIA.Domain.Services;

namespace GestIA.Domain.Workforce;

public sealed class ServiceAssignment : AuditableEntity
{
    private ServiceAssignment()
    {
    }

    private ServiceAssignment(
        Guid idServiceAssignment,
        Guid idEmployee,
        Guid idService,
        ServiceAssignmentType assignmentType,
        DateOnly startDate,
        DateOnly? endDate,
        bool isPrimary,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (endDate < startDate)
        {
            throw new ArgumentOutOfRangeException(nameof(endDate));
        }

        IdServiceAssignment = idServiceAssignment;
        IdEmployee = idEmployee;
        IdService = idService;
        AssignmentType = assignmentType;
        StartDate = startDate;
        EndDate = endDate;
        IsPrimary = isPrimary;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdServiceAssignment { get; private set; }
    public Guid IdEmployee { get; private set; }
    public Guid IdService { get; private set; }
    public ServiceAssignmentType AssignmentType { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public bool IsPrimary { get; private set; }
    public string? Notes { get; private set; }
    public Employee Employee { get; private set; } = null!;
    public Service Service { get; private set; } = null!;

    public static ServiceAssignment Create(
        Guid idEmployee,
        Guid idService,
        ServiceAssignmentType assignmentType,
        DateOnly startDate,
        DateOnly? endDate,
        bool isPrimary,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(
            Guid.NewGuid(),
            idEmployee,
            idService,
            assignmentType,
            startDate,
            endDate,
            isPrimary,
            actorId,
            actorName,
            occurredAt);
}
