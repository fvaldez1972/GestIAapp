using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

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
}
