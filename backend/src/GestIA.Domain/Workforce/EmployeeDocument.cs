using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

public sealed record EmployeeDocumentProfile(
    EmployeeDocumentType DocumentType,
    EmployeeDocumentStatus Status,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes);

public sealed class EmployeeDocument : AuditableEntity
{
    private EmployeeDocument()
    {
    }

    private EmployeeDocument(
        Guid idEmployeeDocument,
        Guid idEmployee,
        EmployeeDocumentType documentType,
        EmployeeDocumentStatus status,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmployeeDocument = idEmployeeDocument;
        IdEmployee = idEmployee;
        DocumentType = documentType;
        Status = status;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployeeDocument { get; private set; }
    public Guid IdEmployee { get; private set; }
    public EmployeeDocumentType DocumentType { get; private set; }
    public EmployeeDocumentStatus Status { get; private set; }
    public string? DocumentNumber { get; private set; }
    public DateOnly? ReceivedDate { get; private set; }
    public DateOnly? IssuedDate { get; private set; }
    public DateOnly? ExpiresDate { get; private set; }
    public string? StorageReference { get; private set; }
    public string? Notes { get; private set; }
    public Employee Employee { get; private set; } = null!;

    public static EmployeeDocument Create(
        Guid idEmployee,
        EmployeeDocumentType documentType,
        EmployeeDocumentStatus status,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idEmployee, documentType, status, actorId, actorName, occurredAt);

    public static EmployeeDocument Create(
        Guid idEmployee,
        EmployeeDocumentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var document = Create(
            idEmployee,
            profile.DocumentType,
            profile.Status,
            actorId,
            actorName,
            occurredAt);
        document.ApplyProfile(profile);
        return document;
    }

    public void UpdateProfile(
        EmployeeDocumentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(EmployeeDocumentProfile profile)
    {
        if (profile.ExpiresDate < profile.IssuedDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        DocumentType = profile.DocumentType;
        Status = profile.Status;
        DocumentNumber = Normalize(profile.DocumentNumber);
        ReceivedDate = profile.ReceivedDate;
        IssuedDate = profile.IssuedDate;
        ExpiresDate = profile.ExpiresDate;
        StorageReference = Normalize(profile.StorageReference);
        Notes = Normalize(profile.Notes);
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
