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
    string? CountryCode = null,
    Guid? IdJobPositionCatalogItem = null);

public sealed record UpdateEmployeeRequest(
    Guid IdOrganization,
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
    string? CountryCode = null,
    Guid? IdJobPositionCatalogItem = null);

public sealed record ChangeEmployeeStatusRequest(Guid IdOrganization, EmployeeStatus Status);

public sealed record EmployeeResponse(
    Guid IdEmployee,
    Guid IdOrganization,
    string CodeEmployee,
    EmployeeStatus Status,
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
    Guid? IdJobPositionCatalogItem);

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
