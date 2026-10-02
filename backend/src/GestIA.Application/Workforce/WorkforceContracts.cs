using GestIA.Application.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

public sealed record EmployeeQuery(
    Guid IdOrganization,
    string? Search = null,
    EmployeeStatus? Status = null,
    int Page = 1,
    int PageSize = 20);

public sealed record CreateEmployeeRequest(
    Guid IdOrganization,
    string CodeEmployee,
    string FirstName,
    string LastNamePaternal,
    string? LastNameMaternal,
    string? JobTitle,
    DateOnly HireDate,
    DateOnly? BirthDate,
    string? BirthPlace,
    string? Sex,
    string? MaritalStatus,
    string? Rfc,
    string? Curp,
    string? SocialSecurityNumber,
    string? VoterIdNumber,
    string? DriverLicenseNumber,
    string? MilitaryServiceCardNumber,
    string? Email,
    string? MobilePhone,
    string? HomePhone,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    /// <summary>Qué es de la persona: madre, cónyuge, hermano. Texto libre.</summary>
    string? EmergencyContactRelationship,
    string? Address,
    /// <summary>La vialidad, sin el número.</summary>
    string? Street,
    /// <summary>El número, alfanumérico: admite «45-A» o «123 int. 4».</summary>
    string? StreetNumber,
    string? Neighborhood,
    string? Municipality,
    string? State,
    string? PostalCode,
    string? HousingType,
    DateOnly? ResidenceSinceDate,
    string? CountryCode = null,
    Guid? IdJobPositionCatalogItem = null,
    /// <summary>Hasta dónde estudió, del catálogo. Nulo es «no se sabe».</summary>
    Guid? IdEducationLevelCatalogItem = null);

public sealed record UpdateEmployeeRequest(
    Guid IdOrganization,
    string FirstName,
    string LastNamePaternal,
    string? LastNameMaternal,
    string? JobTitle,
    DateOnly HireDate,
    DateOnly? BirthDate,
    string? BirthPlace,
    string? Sex,
    string? MaritalStatus,
    string? Rfc,
    string? Curp,
    string? SocialSecurityNumber,
    string? VoterIdNumber,
    string? DriverLicenseNumber,
    string? MilitaryServiceCardNumber,
    string? Email,
    string? MobilePhone,
    string? HomePhone,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    /// <summary>Qué es de la persona: madre, cónyuge, hermano. Texto libre.</summary>
    string? EmergencyContactRelationship,
    string? Address,
    /// <summary>La vialidad, sin el número.</summary>
    string? Street,
    /// <summary>El número, alfanumérico: admite «45-A» o «123 int. 4».</summary>
    string? StreetNumber,
    string? Neighborhood,
    string? Municipality,
    string? State,
    string? PostalCode,
    string? HousingType,
    DateOnly? ResidenceSinceDate,
    string? CountryCode = null,
    Guid? IdJobPositionCatalogItem = null,
    /// <summary>Hasta dónde estudió, del catálogo. Nulo es «no se sabe».</summary>
    Guid? IdEducationLevelCatalogItem = null);

public sealed record ChangeEmployeeStatusRequest(Guid IdOrganization, EmployeeStatus Status);

/// <summary>
/// La contratación de quien estaba en candidatura: abre su primer periodo laboral.
///
/// <para>Hasta RQ-07 no existía ninguna acción que llevara a alguien de candidata a activa, así que
/// los expedientes en candidatura no tenían salida. Ésta es esa salida.</para>
/// </summary>
public sealed record HireEmployeeRequest(Guid IdOrganization, DateOnly StartDate);

/// <summary>
/// La baja: cierra el periodo abierto con su fecha y su motivo.
///
/// <para><b>El motivo es obligatorio</b> y es el motivo del hecho —por qué la persona deja de
/// trabajar—, no el motivo de una corrección. Va vacío en el formulario: nunca se prellena ni se
/// sugiere.</para>
/// </summary>
public sealed record TerminateEmployeeRequest(
    Guid IdOrganization,
    DateOnly EndDate,
    string TerminationReason);

/// <summary>El reingreso: abre un periodo nuevo, con su propia fecha de ingreso.</summary>
public sealed record RehireEmployeeRequest(Guid IdOrganization, DateOnly StartDate);

/// <summary>La prueba psicométrica realizada y aprobada. Se puede registrar desde la candidatura.</summary>
public sealed record RegisterPsychometricTestRequest(Guid IdOrganization, DateOnly ApprovedDate);

public sealed record PsychometricTestResponse(
    Guid IdEmployeePsychometricTest,
    Guid IdEmployee,
    DateOnly ApprovedDate,
    /// <summary>La fecha de la baja que la venció. Nula mientras siga vigente.</summary>
    DateOnly? ExpiredOnDate,
    bool IsValid,
    DateTime CreatedAt,
    string CreatedByName);

/// <summary>
/// Lo que una baja dejó vencido, agrupado por la baja que lo venció.
///
/// <para>Los documentos y las evaluaciones traen su vigencia original, que es la que tenían antes de
/// que la baja la cortara.</para>
/// </summary>
public sealed record TerminationExpirationGroup(
    DateOnly EndDate,
    string? TerminationReason,
    IReadOnlyList<TerminationExpirationItem> Documents,
    IReadOnlyList<TerminationExpirationItem> Evaluations,
    bool PsychometricTestExpired,
    DateOnly? PsychometricTestApprovedDate);

public sealed record TerminationExpirationItem(
    Guid IdItem,
    string Name,
    DateOnly? OriginalExpiresDate);

/// <summary>
/// Un periodo laboral, para pintar el historial de la ficha.
///
/// <para><c>TerminationReason</c> llega sólo en los periodos cerrados, y es texto que alguien
/// escribió: se muestra tal cual.</para>
/// </summary>
public sealed record EmploymentPeriodResponse(
    Guid IdEmploymentPeriod,
    Guid IdEmployee,
    DateOnly StartDate,
    DateOnly? EndDate,
    string? TerminationReason,
    bool IsOpen,
    bool Active,
    DateTime CreatedAt,
    string CreatedByName,
    DateTime? UpdatedAt,
    string? UpdatedByName);

public sealed record EmployeeResponse(
    Guid IdEmployee,
    Guid IdOrganization,
    string CodeEmployee,
    EmployeeStatus Status,
    string FirstName,
    string LastNamePaternal,
    string? LastNameMaternal,
    /// <summary>Derivado de las tres partes. Sigue aquí porque lo leen listas, búsqueda y orden.</summary>
    string FullName,
    string? JobTitle,
    DateOnly HireDate,
    DateOnly? BirthDate,
    string? BirthPlace,
    string? Sex,
    string? MaritalStatus,
    string? Rfc,
    string? Curp,
    string? SocialSecurityNumber,
    string? VoterIdNumber,
    string? DriverLicenseNumber,
    string? MilitaryServiceCardNumber,
    string? Email,
    string? MobilePhone,
    string? HomePhone,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    /// <summary>Qué es de la persona: madre, cónyuge, hermano. Texto libre.</summary>
    string? EmergencyContactRelationship,
    string? Address,
    /// <summary>La vialidad, sin el número.</summary>
    string? Street,
    /// <summary>El número, alfanumérico: admite «45-A» o «123 int. 4».</summary>
    string? StreetNumber,
    string? Neighborhood,
    string? Municipality,
    string? State,
    string? PostalCode,
    string? HousingType,
    DateOnly? ResidenceSinceDate,
    bool Active,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string? CountryCode,
    // Sin valor por defecto, y a proposito. Con `= null` los dos mapeos de esta respuesta se
    // olvidaron de pasar el puesto durante semanas: compilaba, respondia 200, y el campo llegaba
    // nulo en todos los empleados. La columna de uso de Catalogos decia "Nadie lo tiene" siempre.
    // Sin defecto, el compilador senala cada sitio que no lo pasa.
    Guid? IdJobPositionCatalogItem,
    // Sin valor por defecto por la misma razon de arriba.
    Guid? IdEducationLevelCatalogItem);

public sealed record CreateEmployeeDocumentRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    EmployeeDocumentType DocumentType,
    /// <summary>
    /// La categoría del documento, contra el catálogo <c>EmployeeDocumentCategory</c>. Nula sólo en
    /// expedientes anteriores a la conversión del 19 de septiembre de 2026.
    /// </summary>
    Guid? IdDocumentCategoryCatalogItem,
    EmployeeDocumentStatus Status,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes,
    /// <summary>El archivo que cubre el requisito, cuando se subió desde el expediente.</summary>
    Guid? IdBusinessDocument = null);

public sealed record UpdateEmployeeDocumentRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    EmployeeDocumentType DocumentType,
    /// <summary>
    /// La categoría del documento, contra el catálogo <c>EmployeeDocumentCategory</c>. Nula sólo en
    /// expedientes anteriores a la conversión del 19 de septiembre de 2026.
    /// </summary>
    Guid? IdDocumentCategoryCatalogItem,
    EmployeeDocumentStatus Status,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes,
    Guid? IdBusinessDocument = null);

public sealed record EmployeeDocumentResponse(
    Guid IdEmployeeDocument,
    Guid IdEmployee,
    EmployeeDocumentType DocumentType,
    /// <summary>
    /// La categoría del documento, contra el catálogo <c>EmployeeDocumentCategory</c>. Nula sólo en
    /// expedientes anteriores a la conversión del 19 de septiembre de 2026.
    /// </summary>
    Guid? IdDocumentCategoryCatalogItem,
    string? DocumentCategoryName,
    EmployeeDocumentStatus Status,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes,
    bool Active,
    /// <summary>El archivo que cubre el requisito. Nulo si el requisito se registró sin archivo.</summary>
    Guid? IdBusinessDocument);

public sealed record CreateEmployeeEvaluationRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    EmployeeEvaluationType EvaluationType,
    /// <summary>
    /// La categoría de la evaluación, contra el catálogo <c>EmployeeEvaluationCategory</c>.
    /// </summary>
    Guid? IdEvaluationCategoryCatalogItem,
    EmployeeEvaluationResult Result,
    DateOnly EvaluatedDate,
    DateOnly? ExpiresDate,
    string? CertificateNumber,
    string? StorageReference,
    string? Notes);

public sealed record UpdateEmployeeEvaluationRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    EmployeeEvaluationType EvaluationType,
    /// <summary>
    /// La categoría de la evaluación, contra el catálogo <c>EmployeeEvaluationCategory</c>.
    /// </summary>
    Guid? IdEvaluationCategoryCatalogItem,
    EmployeeEvaluationResult Result,
    DateOnly EvaluatedDate,
    DateOnly? ExpiresDate,
    string? CertificateNumber,
    string? StorageReference,
    string? Notes);

public sealed record EmployeeEvaluationResponse(
    Guid IdEmployeeEvaluation,
    Guid IdEmployee,
    EmployeeEvaluationType EvaluationType,
    /// <summary>
    /// La categoría de la evaluación, contra el catálogo <c>EmployeeEvaluationCategory</c>.
    /// </summary>
    Guid? IdEvaluationCategoryCatalogItem,
    string? EvaluationCategoryName,
    EmployeeEvaluationResult Result,
    DateOnly EvaluatedDate,
    DateOnly? ExpiresDate,
    string? CertificateNumber,
    string? StorageReference,
    string? Notes,
    bool Active);

public sealed record EmployeeDetailResponse(
    EmployeeResponse Employee,
    IReadOnlyList<EmployeeDocumentResponse> Documents,
    IReadOnlyList<EmployeeEvaluationResponse> Evaluations);

public sealed record EmployeeListResult(
    IReadOnlyList<EmployeeResponse> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public PagedResult<EmployeeResponse> ToPagedResult() => new(Items, TotalCount, Page, PageSize);
}

/// <summary>
/// Lo que deja una baja, además del expediente.
///
/// <para><b>Los turnos ya proyectados no se borran y hay que decirlo.</b> Una versión publicada de la
/// planeación es inmutable, así que la baja no los cancela: los cuenta y los devuelve con su primer y
/// último día, para que la pantalla avise de que hay huecos que cubrir. Callarlo dejaría turnos a
/// nombre de alguien que ya no trabaja, y nadie se enteraría hasta el día del turno.</para>
/// </summary>
public sealed record TerminateEmployeeResult(
    EmployeeResponse Employee,
    int ClosedAssignments,
    int FutureShifts,
    DateOnly? FirstFutureShiftDate,
    DateOnly? LastFutureShiftDate,
    int ExpiredDocuments,
    int ExpiredEvaluations);
