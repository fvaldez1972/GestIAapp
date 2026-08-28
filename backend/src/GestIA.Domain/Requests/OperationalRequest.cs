using GestIA.Domain.Clients;
using GestIA.Domain.Common;
using GestIA.Domain.Organizations;
using GestIA.Domain.Services;

namespace GestIA.Domain.Requests;

public sealed class OperationalRequest : AuditableEntity
{
    private OperationalRequest()
    {
    }

    public Guid IdOperationalRequest { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid? IdClient { get; private set; }
    public Guid? IdService { get; private set; }
    public string CodeOperationalRequest { get; private set; } = string.Empty;
    public OperationalRequestType RequestType { get; private set; }
    public OperationalRequestStatus Status { get; private set; }
    public OperationalRequestPriority Priority { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string RequestedByName { get; private set; } = string.Empty;
    public DateOnly? NeededByDate { get; private set; }
    public string? ResolutionNotes { get; private set; }
    public Organization Organization { get; private set; } = null!;
    public Client? Client { get; private set; }
    public Service? Service { get; private set; }

    public static OperationalRequest Create(
        Guid idOrganization,
        Guid? idClient,
        Guid? idService,
        string codeOperationalRequest,
        OperationalRequestType requestType,
        OperationalRequestPriority priority,
        string title,
        string description,
        string requestedByName,
        DateOnly? neededByDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeOperationalRequest);
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(description);
        ArgumentException.ThrowIfNullOrWhiteSpace(requestedByName);

        var request = new OperationalRequest
        {
            IdOperationalRequest = Guid.NewGuid(),
            IdOrganization = idOrganization,
            IdClient = idClient,
            IdService = idService,
            CodeOperationalRequest = codeOperationalRequest.Trim().ToUpperInvariant(),
            RequestType = requestType,
            Status = OperationalRequestStatus.Submitted,
            Priority = priority,
            Title = title.Trim(),
            Description = description.Trim(),
            RequestedByName = requestedByName.Trim(),
            NeededByDate = neededByDate
        };
        request.RegisterCreation(actorId, actorName, occurredAt);
        return request;
    }

    public void UpdateDetails(
        Guid? idClient,
        Guid? idService,
        OperationalRequestType requestType,
        OperationalRequestPriority priority,
        string title,
        string description,
        string requestedByName,
        DateOnly? neededByDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(description);
        ArgumentException.ThrowIfNullOrWhiteSpace(requestedByName);

        IdClient = idClient;
        IdService = idService;
        RequestType = requestType;
        Priority = priority;
        Title = title.Trim();
        Description = description.Trim();
        RequestedByName = requestedByName.Trim();
        NeededByDate = neededByDate;
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    public void ChangeStatus(
        OperationalRequestStatus status,
        string? resolutionNotes,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        Status = status;
        ResolutionNotes = string.IsNullOrWhiteSpace(resolutionNotes) ? null : resolutionNotes.Trim();
        RegisterUpdate(actorId, actorName, occurredAt);
    }
}
