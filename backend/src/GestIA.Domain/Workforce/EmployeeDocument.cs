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

/// <summary>
/// Lleva su propia <c>IdOrganization</c> aunque la alcanzaría por su padre.
///
/// <para>Está denormalizada a propósito, y la decisión se tomó al revés de lo que dijo la tanda A.
/// Entonces la alternativa era "una columna redundante contra ningún costo". Con el filtro global
/// de la tanda B la alternativa pasó a ser un filtro por navegación, y eso hace que <b>el filtro
/// del hijo dependa del filtro del padre</b>: apagar uno sin el otro da resultados que hay que
/// razonar caso por caso, que es justo lo que el filtro global vino a evitar.</para>
///
/// <para>Es seguro porque la organización del padre es <b>inmutable</b>, y eso no es una
/// suposición: <c>OrganizationScopeTests</c> falla si alguien expone una vía de cambiarla.</para>
/// </summary>
public sealed class EmployeeDocument : AuditableEntity, IOrganizationScopedEntity
{
    private EmployeeDocument()
    {
    }

    private EmployeeDocument(
        Guid idEmployeeDocument,
        Guid idOrganization,
        Guid idEmployee,
        EmployeeDocumentType documentType,
        EmployeeDocumentStatus status,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmployeeDocument = idEmployeeDocument;
        IdOrganization = idOrganization;
        IdEmployee = idEmployee;
        DocumentType = documentType;
        Status = status;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployeeDocument { get; private set; }
    public Guid IdOrganization { get; private set; }
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
        Guid idOrganization,
        Guid idEmployee,
        EmployeeDocumentType documentType,
        EmployeeDocumentStatus status,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idEmployee, documentType, status, actorId, actorName, occurredAt);

    public static EmployeeDocument Create(
        Guid idOrganization,
        Guid idEmployee,
        EmployeeDocumentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var document = Create(
            idOrganization,
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
