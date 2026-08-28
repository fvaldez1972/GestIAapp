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
    string? Address,
    string? Municipality,
    string? State,
    string? PostalCode,
    string? HousingType,
    DateOnly? ResidenceSinceDate);

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
    string? Address,
    string? Municipality,
    string? State,
    string? PostalCode,
    string? HousingType,
    DateOnly? ResidenceSinceDate);

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
    string? Address,
    string? Municipality,
    string? State,
    string? PostalCode,
    string? HousingType,
    DateOnly? ResidenceSinceDate,
    bool Active,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record CreateEmployeeDocumentRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    EmployeeDocumentType DocumentType,
    EmployeeDocumentStatus Status,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes);

public sealed record UpdateEmployeeDocumentRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    EmployeeDocumentType DocumentType,
    EmployeeDocumentStatus Status,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes);

public sealed record EmployeeDocumentResponse(
    Guid IdEmployeeDocument,
    Guid IdEmployee,
    EmployeeDocumentType DocumentType,
    EmployeeDocumentStatus Status,
    string? DocumentNumber,
    DateOnly? ReceivedDate,
    DateOnly? IssuedDate,
    DateOnly? ExpiresDate,
    string? StorageReference,
    string? Notes,
    bool Active);

public sealed record CreateEmployeeEvaluationRequest(
    Guid IdOrganization,
    Guid IdEmployee,
    EmployeeEvaluationType EvaluationType,
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
