using GestIA.Domain.Clients;
using GestIA.Domain.Common;
using GestIA.Domain.Requests;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Documents;

public sealed record BusinessDocumentProfile(
    BusinessDocumentOwnerType OwnerType,
    Guid OwnerId,
    string Category,
    string Title,
    BusinessDocumentStatus Status,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string StorageReference,
    bool IsSensitive,
    string? Notes);

public sealed class BusinessDocument : AuditableEntity
{
    private BusinessDocument()
    {
    }

    public Guid IdBusinessDocument { get; private set; }
    public Guid IdOrganization { get; private set; }
    public BusinessDocumentOwnerType OwnerType { get; private set; }
    public Guid OwnerId { get; private set; }
    public Guid? IdClient { get; private set; }
    public Guid? IdServiceContract { get; private set; }
    public Guid? IdService { get; private set; }
    public Guid? IdEmployee { get; private set; }
    public Guid? IdEmployeeEvaluation { get; private set; }
    public Guid? IdOperationalRequest { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public BusinessDocumentStatus Status { get; private set; }
    public DateOnly? IssuedDate { get; private set; }
    public DateOnly? ExpiresDate { get; private set; }
    public string StorageReference { get; private set; } = string.Empty;
    public bool IsSensitive { get; private set; }
    public string? Notes { get; private set; }
    public string? ReviewNotes { get; private set; }
    public DateTime? ReviewedAt { get; private set; }
    public Guid? ReviewedBy { get; private set; }
    public string? ReviewedByName { get; private set; }
    public Client? Client { get; private set; }
    public ServiceContract? ServiceContract { get; private set; }
    public Service? Service { get; private set; }
    public Employee? Employee { get; private set; }
    public EmployeeEvaluation? EmployeeEvaluation { get; private set; }
    public OperationalRequest? OperationalRequest { get; private set; }

    public static BusinessDocument Create(
        Guid idOrganization,
        BusinessDocumentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var document = new BusinessDocument
        {
            IdBusinessDocument = Guid.NewGuid(),
            IdOrganization = idOrganization
        };
        document.ApplyProfile(profile);
        document.Status = BusinessDocumentStatus.PendingReview;
        document.RegisterCreation(actorId, actorName, occurredAt);
        return document;
    }

    public void UpdateProfile(
        BusinessDocumentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (profile.OwnerType != OwnerType || profile.OwnerId != OwnerId)
        {
            throw new DomainRuleException("The document owner cannot be changed.");
        }

        if (IsSensitive && !profile.IsSensitive)
        {
            throw new DomainRuleException("A sensitive document cannot be declassified through a profile edit.");
        }

        ApplyProfile(profile);
        Status = BusinessDocumentStatus.PendingReview;
        ReviewNotes = null;
        ReviewedAt = null;
        ReviewedBy = null;
        ReviewedByName = null;
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    public void Review(BusinessDocumentStatus status, string? reviewNotes, Guid actorId, string actorName, DateTime occurredAt)
    {
        if (status is not BusinessDocumentStatus.Validated and not BusinessDocumentStatus.Rejected)
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        if (status == BusinessDocumentStatus.Rejected && string.IsNullOrWhiteSpace(reviewNotes))
        {
            throw new ArgumentException("Review notes are required when rejecting a document.", nameof(reviewNotes));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(actorName);
        Status = status;
        ReviewNotes = string.IsNullOrWhiteSpace(reviewNotes) ? null : reviewNotes.Trim();
        ReviewedAt = occurredAt.Kind == DateTimeKind.Local ? occurredAt.ToUniversalTime() : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        ReviewedBy = actorId;
        ReviewedByName = actorName.Trim();
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    public void Archive(Guid actorId, string actorName, DateTime occurredAt)
    {
        Status = BusinessDocumentStatus.Archived;
        Deactivate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(BusinessDocumentProfile profile)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Category);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Title);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.StorageReference);

        if (profile.OwnerId == Guid.Empty)
        {
            throw new ArgumentException("OwnerId is required.", nameof(profile));
        }

        if (profile.ExpiresDate < profile.IssuedDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        OwnerType = profile.OwnerType;
        OwnerId = profile.OwnerId;
        IdClient = profile.OwnerType == BusinessDocumentOwnerType.Client ? profile.OwnerId : null;
        IdServiceContract = profile.OwnerType == BusinessDocumentOwnerType.ServiceContract ? profile.OwnerId : null;
        IdService = profile.OwnerType == BusinessDocumentOwnerType.Service ? profile.OwnerId : null;
        IdEmployee = profile.OwnerType == BusinessDocumentOwnerType.Employee ? profile.OwnerId : null;
        IdEmployeeEvaluation = profile.OwnerType == BusinessDocumentOwnerType.EmployeeEvaluation ? profile.OwnerId : null;
        IdOperationalRequest = profile.OwnerType == BusinessDocumentOwnerType.OperationalRequest ? profile.OwnerId : null;
        Category = profile.Category.Trim();
        Title = profile.Title.Trim();
        Status = profile.Status;
        IssuedDate = profile.IssuedDate;
        ExpiresDate = profile.ExpiresDate;
        StorageReference = profile.StorageReference.Trim();
        IsSensitive = profile.IsSensitive;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
