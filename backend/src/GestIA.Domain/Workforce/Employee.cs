using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Workforce;

public sealed class Employee : AuditableEntity
{
    private readonly List<EmployeeDocument> documents = [];
    private readonly List<EmployeeEvaluation> evaluations = [];

    private Employee()
    {
    }

    private Employee(
        Guid idEmployee,
        Guid idOrganization,
        string codeEmployee,
        string fullName,
        string? jobTitle,
        DateOnly hireDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeEmployee);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        IdEmployee = idEmployee;
        IdOrganization = idOrganization;
        CodeEmployee = codeEmployee.Trim();
        Status = EmployeeStatus.Active;
        FullName = fullName.Trim();
        JobTitle = string.IsNullOrWhiteSpace(jobTitle) ? null : jobTitle.Trim();
        HireDate = hireDate;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployee { get; private set; }
    public Guid IdOrganization { get; private set; }
    public string CodeEmployee { get; private set; } = string.Empty;
    public EmployeeStatus Status { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? JobTitle { get; private set; }
    public DateOnly HireDate { get; private set; }
    public DateOnly? BirthDate { get; private set; }
    public string? BirthPlace { get; private set; }
    public string? Sex { get; private set; }
    public string? MaritalStatus { get; private set; }
    public string? Rfc { get; private set; }
    public string? Curp { get; private set; }
    public string? SocialSecurityNumber { get; private set; }
    public string? VoterIdNumber { get; private set; }
    public string? DriverLicenseNumber { get; private set; }
    public string? MilitaryServiceCardNumber { get; private set; }
    public string? Email { get; private set; }
    public string? MobilePhone { get; private set; }
    public string? HomePhone { get; private set; }
    public string? EmergencyContactName { get; private set; }
    public string? EmergencyContactPhone { get; private set; }
    public string? Address { get; private set; }
    public string? Municipality { get; private set; }
    public string? State { get; private set; }
    public string? PostalCode { get; private set; }
    public string? HousingType { get; private set; }
    public DateOnly? ResidenceSinceDate { get; private set; }
    public Organization Organization { get; private set; } = null!;
    public IReadOnlyCollection<EmployeeDocument> Documents => documents;
    public IReadOnlyCollection<EmployeeEvaluation> Evaluations => evaluations;

    public static Employee Create(
        Guid idOrganization,
        string codeEmployee,
        string fullName,
        string? jobTitle,
        DateOnly hireDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(
            Guid.NewGuid(),
            idOrganization,
            codeEmployee,
            fullName,
            jobTitle,
            hireDate,
            actorId,
            actorName,
            occurredAt);
}
