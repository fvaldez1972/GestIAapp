using GestIA.Domain.Catalogs;
using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

public sealed record EmployeeDocumentProfile(
    EmployeeDocumentType DocumentType,
    EmployeeDocumentStatus Status,
    Guid? IdDocumentCategoryCatalogItem,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes,
    Guid? IdBusinessDocument = null,
    bool IsSensitive = false);

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
    /// <summary>
    /// De qué es el documento, como enum. <b>Rastro heredado desde el 19 de septiembre de 2026.</b>
    ///
    /// <para>La categoría de verdad vive ahora en <see cref="IdDocumentCategoryCatalogItem"/>, contra
    /// un catálogo que la organización edita. Esta columna se conserva llena mientras queden filas
    /// sin identificador y se retira cuando no queden; nada decide por ella.</para>
    /// </summary>
    public EmployeeDocumentType DocumentType { get; private set; }

    /// <summary>
    /// La categoría del documento, por identificador contra el catálogo
    /// <c>EmployeeDocumentCategory</c>.
    ///
    /// <para><b>Es nulable, y eso significa algo distinto de «no cumple».</b> Un nulo dice que la
    /// fila nació antes de la conversión y todavía no se emparejó con su entrada del catálogo. La
    /// elegibilidad no bloquea por un nulo: es el mismo criterio que ya rige en
    /// <c>IdJobPositionCatalogItem</c>.</para>
    /// </summary>
    public Guid? IdDocumentCategoryCatalogItem { get; private set; }

    /// <summary>La entrada del catálogo, para poder nombrarla sin una consulta aparte.</summary>
    public BusinessCatalogItem? DocumentCategoryCatalogItem { get; private set; }

    public EmployeeDocumentStatus Status { get; private set; }
    public string? DocumentNumber { get; private set; }
    public DateOnly? ReceivedDate { get; private set; }
    public DateOnly? IssuedDate { get; private set; }
    public DateOnly? ExpiresDate { get; private set; }
    public string? StorageReference { get; private set; }

    /// <summary>
    /// El archivo que cubre este requisito, cuando se subió desde el expediente.
    ///
    /// <para><b>Por qué hacía falta.</b> El expediente guarda el archivo como
    /// <c>BusinessDocument</c> —con su historial, su revisión y su permiso de sensibles— y la
    /// vigencia documental se calcula sobre esta tabla. Las dos filas existían sin ninguna liga, así
    /// que desde el requisito no se podía llegar al archivo que lo cubre.</para>
    ///
    /// <para><b>No se usó <c>StorageReference</c> para esto.</b> Esa columna la sirve una ruta
    /// heredada del prototipo, y guardar ahí un identificador le habría dado un significado que no
    /// tiene: dos cosas distintas compartiendo una columna es exactamente lo que el proyecto viene
    /// deshaciendo.</para>
    ///
    /// <para><b>Es nulable, y el nulo significa algo:</b> «este requisito se registró sin pasar por
    /// la carga de un archivo». Los documentos que ya existían no tienen archivo ligado y no se les
    /// inventa uno.</para>
    /// </summary>
    public Guid? IdBusinessDocument { get; private set; }

    public string? Notes { get; private set; }

    /// <summary>
    /// Si el documento lleva datos personales que piden trato especial.
    ///
    /// <para>Hoy es una clasificación y no un permiso: marca el papel para que quien administre la
    /// organización sepa qué está guardando. Convertirla en una restricción de acceso es una
    /// decisión aparte, con su propia comprobación en el servidor, y marcar la casilla no debe
    /// hacer creer que esa restricción ya existe.</para>
    /// </summary>
    public bool IsSensitive { get; private set; }
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
        IdDocumentCategoryCatalogItem = profile.IdDocumentCategoryCatalogItem;
        Status = profile.Status;
        DocumentNumber = Normalize(profile.DocumentNumber);
        ReceivedDate = profile.ReceivedDate;
        IssuedDate = profile.IssuedDate;
        ExpiresDate = profile.ExpiresDate;
        StorageReference = Normalize(profile.StorageReference);
        IdBusinessDocument = profile.IdBusinessDocument;
        IsSensitive = profile.IsSensitive;
        Notes = Normalize(profile.Notes);
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
